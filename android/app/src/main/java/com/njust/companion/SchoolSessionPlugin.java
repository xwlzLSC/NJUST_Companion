package com.njust.companion;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.webkit.CookieManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.net.CookieHandler;
import java.net.HttpCookie;
import java.net.URI;
import java.io.IOException;
import java.security.KeyStore;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** School-only CookieManager access. CapacitorCookies.getCookies reads
 * document.cookie at localhost, not the url option (and misses HttpOnly).
 * Session cookies are removed by Capacitor on startup; save an encrypted,
 * account-bound snapshot and restore it before checking the school session.
 */
@CapacitorPlugin(name = "SchoolSession")
/**
 * 学校 Cookie 的原生持久化与恢复层，供 APK 清理后台后重新进入使用。
 * 保存时保留服务器实际 Set-Cookie 的域、路径、安全属性和有效期，不猜测永久 Cookie。
 * 会话按 owner 绑定并加密；恢复时先验证身份/有效期/学校 URL 白名单，再写入 CookieManager。
 * Cookie 值不能输出到日志；重定向、Cookie 回调与 UI 线程的关系不能用阻塞等待替代。
 */
public class SchoolSessionPlugin extends Plugin {
    private static final String KEY_ALIAS = "njust_companion_school_session_v1";
    private static final String PREFS = "njust_school_session";
    private static final long MAX_AGE_MS = 30L * 24 * 60 * 60 * 1000;
    private static final String[] URLS = {
        "https://ids.njust.edu.cn/", "https://ids.njust.edu.cn/authserver/",
        "https://bkjw.njust.edu.cn/", "https://bkjw.njust.edu.cn/njlgdx/",
        "http://bkjw.njust.edu.cn/", "http://bkjw.njust.edu.cn/njlgdx/",
        "http://202.119.81.112:8080/", "http://202.119.81.112:8080/njlgdx/",
        "http://202.119.81.113:8080/", "http://202.119.81.113:8080/njlgdx/",
        "http://202.119.81.112:9080/njlgdx/", "http://202.119.81.113:9080/njlgdx/"
    };
    private final Map<String, JSONObject> cookieMetadata = new HashMap<>();

    private final class SessionCookieHandler extends CookieHandler {
        final SchoolSessionPlugin owner = SchoolSessionPlugin.this;
        final CookieHandler delegate;
        SessionCookieHandler(CookieHandler delegate) { this.delegate = delegate; }
        @Override
        public Map<String, List<String>> get(URI uri, Map<String, List<String>> headers) throws IOException {
            return delegate.get(uri, headers);
        }
        @Override
        public void put(URI uri, Map<String, List<String>> headers) throws IOException {
            delegate.put(uri, headers);
            recordCookieHeaders(uri, headers);
        }
    }

    /** 包装现有 CookieHandler 而不替换 Cookie 机制；销毁插件时恢复原始委托。 */
    private synchronized void observeCookieHeaders() {
        CookieHandler current = CookieHandler.getDefault();
        if (current instanceof SessionCookieHandler) {
            SessionCookieHandler existing = (SessionCookieHandler) current;
            if (existing.owner == this) return;
            current = existing.delegate;
        }
        if (current != null) {
            // Retain Capacitor's HTTP/WebView jar. Observe original Set-Cookie
            // attributes rather than guessing TGC domain, path or lifetime.
            CookieHandler.setDefault(new SessionCookieHandler(current));
        }
    }

    @Override
    protected void handleOnDestroy() {
        CookieHandler current = CookieHandler.getDefault();
        if (current instanceof SessionCookieHandler && ((SessionCookieHandler) current).owner == this) {
            CookieHandler.setDefault(((SessionCookieHandler) current).delegate);
        }
        super.handleOnDestroy();
    }

    private void recordCookieHeaders(URI uri, Map<String, List<String>> headers) {
        if (uri == null || headers == null || !allowedUrl(uri.toString())) return;
        for (Map.Entry<String, List<String>> header : headers.entrySet()) {
            if (header.getKey() == null || !header.getKey().equalsIgnoreCase("Set-Cookie") || header.getValue() == null) continue;
            for (String raw : header.getValue()) try {
                for (HttpCookie cookie : HttpCookie.parse(raw)) {
                    if (!validCookie(cookie.getName(), cookie.getValue())) continue;
                    String scope = cookie.getPath();
                    if (scope == null || scope.isEmpty()) {
                        String requestPath = uri.getPath();
                        int lastSlash = requestPath == null ? -1 : requestPath.lastIndexOf('/');
                        scope = lastSlash < 1 ? "/" : requestPath.substring(0, lastSlash);
                    }
                    if (!scope.startsWith("/") || scope.matches("(?s).*[;\\r\\n].*")) continue;
                    String domain = cookie.getDomain() == null ? "" : cookie.getDomain().replaceFirst("^\\.", "").toLowerCase(Locale.ROOT);
                    if (!domain.isEmpty() && !uri.getHost().equals(domain)
                        && !(domain.equals("njust.edu.cn") && uri.getHost().endsWith(".njust.edu.cn"))) continue;
                    String key = uri.getHost() + "|" + domain + "|" + scope + "|" + cookie.getName();
                    synchronized (cookieMetadata) {
                        if (cookie.getMaxAge() == 0) { cookieMetadata.remove(key); continue; }
                        JSONObject entry = new JSONObject();
                        entry.put("url", new URI(uri.getScheme(), null, uri.getHost(), uri.getPort(), scope, null, null).toString());
                        entry.put("name", cookie.getName()); entry.put("value", cookie.getValue());
                        entry.put("path", scope); entry.put("domain", domain);
                        entry.put("secure", cookie.getSecure()); entry.put("httpOnly", cookie.isHttpOnly());
                        long maxAge = cookie.getMaxAge();
                        entry.put("expiresAt", maxAge < 0 ? -1 : System.currentTimeMillis() + Math.min(maxAge, MAX_AGE_MS / 1000) * 1000);
                        cookieMetadata.put(key, entry);
                    }
                }
            } catch (Exception ignored) { /* Never log a raw Set-Cookie header. */ }
        }
    }

    private static final class CookieWrite {
        final String url;
        final String value;
        CookieWrite(String url, String value) { this.url = url; this.value = value; }
    }

    private boolean allowedUrl(String value) {
        Uri url = Uri.parse(value);
        if (!url.isHierarchical() || url.getUserInfo() != null || url.getFragment() != null) return false;
        String host = url.getHost();
        int port = url.getPort();
        if ("ids.njust.edu.cn".equals(host)) return "https".equals(url.getScheme()) && (port == -1 || port == 443);
        if ("bkjw.njust.edu.cn".equals(host)) return ("https".equals(url.getScheme()) && (port == -1 || port == 443))
            || ("http".equals(url.getScheme()) && (port == -1 || port == 80));
        return ("202.119.81.112".equals(host) || "202.119.81.113".equals(host))
            && "http".equals(url.getScheme()) && (port == 8080 || port == 9080);
    }

    private boolean validOwner(String owner) { return !owner.isEmpty() && owner.length() <= 256 && !owner.matches("(?s).*[\\x00-\\x1f\\x7f].*"); }

    private boolean validCookie(String name, String value) {
        return name.matches("[A-Za-z0-9_!#$%&'*+.^`|~-]{1,128}") && value.length() <= 8192
            && !value.matches("(?s).*[;\\x00-\\x20\\x7f].*");
    }

    private JSObject cookiesAt(String url) {
        JSObject result = new JSObject();
        String header = CookieManager.getInstance().getCookie(url);
        if (header == null) return result;
        for (String cookie : header.split(";")) {
            int separator = cookie.indexOf('=');
            if (separator < 1) continue;
            String name = cookie.substring(0, separator).trim();
            String value = cookie.substring(separator + 1).trim();
            // Longer-path cookies occur first. Do not overwrite them with a
            // same-name root cookie, or decode signed/encrypted cookie values.
            if (validCookie(name, value) && !result.has(name)) result.put(name, value);
        }
        return result;
    }

    @PluginMethod
    public void getCookies(PluginCall call) {
        observeCookieHeaders();
        String url = call.getString("url", "");
        if (!allowedUrl(url)) { call.reject("非学校会话地址，已停止读取"); return; }
        execute(() -> {
            try { call.resolve(cookiesAt(url)); }
            catch (Exception ignored) { call.reject("学校会话暂时无法读取，请重试"); }
        });
    }

    @PluginMethod
    /** 保存当前学校会话快照；URL、Cookie 属性和 owner 都是恢复安全边界。 */
    public void saveSession(PluginCall call) {
        observeCookieHeaders();
        String owner = call.getString("owner", "");
        if (!validOwner(owner)) { call.reject("会话身份无效"); return; }
        execute(() -> {
            try {
                JSONArray entries = new JSONArray();
                for (String url : URLS) {
                    JSObject cookies = cookiesAt(url);
                    Uri parsed = Uri.parse(url);
                    if (!"/".equals(parsed.getPath())) {
                        // Root cookies also appear in every nested request.
                        // Do not clone them into a new, longer-path cookie.
                        JSObject rootCookies = cookiesAt(parsed.buildUpon().path("/").build().toString());
                        JSONArray names = cookies.names();
                        if (names != null) for (int i = 0; i < names.length(); i++) {
                            String name = names.getString(i);
                            if (rootCookies.has(name) && cookies.getString(name).equals(rootCookies.getString(name))) cookies.remove(name);
                        }
                    }
                    if (cookies.length() == 0) continue;
                    JSONObject entry = new JSONObject();
                    entry.put("url", url);
                    entry.put("cookies", cookies);
                    entries.put(entry);
                }
                JSObject result = new JSObject();
                if (entries.length() == 0) { result.put("saved", false); call.resolve(result); return; }
                JSONObject snapshot = new JSONObject();
                snapshot.put("version", 1);
                snapshot.put("owner", owner);
                snapshot.put("savedAt", System.currentTimeMillis());
                snapshot.put("entries", entries);
                JSONObject attributes = new JSONObject();
                synchronized (cookieMetadata) {
                    for (Map.Entry<String, JSONObject> entry : cookieMetadata.entrySet()) attributes.put(entry.getKey(), entry.getValue());
                }
                snapshot.put("attributes", attributes);
                byte[] bytes = snapshot.toString().getBytes(StandardCharsets.UTF_8);
                if (bytes.length > 131072) throw new IllegalStateException("Session too large");
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.ENCRYPT_MODE, sessionKey());
                byte[] encrypted = cipher.doFinal(bytes);
                // Commit before resolving: a process kill immediately after a
                // successful login must not lose the last verified snapshot.
                boolean saved = prefs().edit()
                    .putString("data", Base64.encodeToString(encrypted, Base64.NO_WRAP))
                    .putString("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)).commit();
                if (!saved) throw new IllegalStateException("Session not saved");
                CookieManager.getInstance().flush();
                result.put("saved", true);
                call.resolve(result);
            } catch (Exception ignored) {
                // Never include cookie values or account identifiers in errors.
                call.reject("学校会话安全保存失败，下次启动可能需要重新登录");
            }
        });
    }

    @PluginMethod
    /** 只恢复请求 owner 的有效快照；成功写入 Cookie 仍需 JS 层向学校验证登录。 */
    public void restoreSession(PluginCall call) {
        observeCookieHeaders();
        String owner = call.getString("owner", "");
        if (!validOwner(owner)) { call.reject("会话身份无效"); return; }
        execute(() -> {
            try {
                SharedPreferences stored = prefs();
                String data = stored.getString("data", "");
                String iv = stored.getString("iv", "");
                if (data.isEmpty() || iv.isEmpty()) { restoreResult(call, false); return; }
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, sessionKey(), new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
                byte[] bytes = cipher.doFinal(Base64.decode(data, Base64.NO_WRAP));
                if (bytes.length > 131072) throw new IllegalStateException("Invalid session");
                JSONObject snapshot = new JSONObject(new String(bytes, StandardCharsets.UTF_8));
                long age = System.currentTimeMillis() - snapshot.getLong("savedAt");
                if (snapshot.optInt("version") != 1 || age < 0 || age > MAX_AGE_MS) {
                    stored.edit().clear().commit(); restoreResult(call, false); return;
                }
                // A previous account/QR challenge must never be restored into
                // a new account, even if both display '微信授权用户'.
                if (!owner.equals(snapshot.getString("owner"))) { restoreResult(call, false); return; }
                List<CookieWrite> writes = new ArrayList<>();
                Map<String, Boolean> exactNames = new HashMap<>();
                JSONObject attributes = snapshot.optJSONObject("attributes");
                if (attributes != null) {
                    JSONArray keys = attributes.names();
                    if (keys != null) for (int i = 0; i < keys.length(); i++) {
                        String key = keys.getString(i);
                        JSONObject entry = attributes.getJSONObject(key);
                        String url = entry.getString("url");
                        if (!allowedUrl(url)) throw new IllegalStateException("Invalid cookie URL");
                        Uri parsed = Uri.parse(url);
                        String name = entry.getString("name");
                        String value = entry.getString("value");
                        String scope = entry.getString("path");
                        String domain = entry.getString("domain");
                        if (!validCookie(name, value) || !scope.startsWith("/") || scope.matches("(?s).*[;\\r\\n].*")) throw new IllegalStateException("Invalid cookie");
                        if (!domain.isEmpty() && !parsed.getHost().equals(domain)
                            && !(domain.equals("njust.edu.cn") && parsed.getHost().endsWith(".njust.edu.cn"))) throw new IllegalStateException("Invalid domain");
                        exactNames.put(parsed.getHost() + "|" + name, true);
                        long expiresAt = entry.optLong("expiresAt", -1);
                        if (expiresAt >= 0 && expiresAt <= System.currentTimeMillis()) continue;
                        String cookie = name + "=" + value + "; Path=" + scope
                            + (domain.isEmpty() ? "" : "; Domain=" + domain)
                            + (entry.optBoolean("secure") ? "; Secure" : "")
                            + (entry.optBoolean("httpOnly") ? "; HttpOnly" : "");
                        if (expiresAt >= 0) {
                            SimpleDateFormat format = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss 'GMT'", Locale.US);
                            format.setTimeZone(TimeZone.getTimeZone("GMT"));
                            cookie += "; Expires=" + format.format(new Date(expiresAt));
                        }
                        writes.add(new CookieWrite(url, cookie));
                        synchronized (cookieMetadata) { cookieMetadata.put(key, entry); }
                    }
                }
                JSONArray entries = snapshot.getJSONArray("entries");
                for (int i = 0; i < entries.length(); i++) {
                    JSONObject entry = entries.getJSONObject(i);
                    String url = entry.getString("url");
                    if (!allowedUrl(url)) throw new IllegalStateException("Invalid session URL");
                    Uri parsed = Uri.parse(url);
                    // Java servlet session cookies use the context path, not
                    // the trailing-slash request path. A longer duplicate
                    // would mask the server's next rotated JSESSIONID.
                    String path = parsed.getPath();
                    if (path.length() > 1 && path.endsWith("/")) path = path.substring(0, path.length() - 1);
                    JSONObject cookies = entry.getJSONObject("cookies");
                    JSONArray names = cookies.names();
                    if (names == null) continue;
                    for (int j = 0; j < names.length(); j++) {
                        String name = names.getString(j);
                        String value = cookies.getString(name);
                        if (exactNames.containsKey(parsed.getHost() + "|" + name)) continue;
                        if (!validCookie(name, value)) throw new IllegalStateException("Invalid session cookie");
                        // Do not extend the server lifetime or recreate a
                        // browser-persistent cookie. The server validates it.
                        String cookie = name + "=" + value + "; Path=" + path + "; HttpOnly"
                            + ("https".equals(parsed.getScheme()) ? "; Secure" : "");
                        writes.add(new CookieWrite(url, cookie));
                    }
                }
                applyCookies(writes, () -> restoreResult(call, !writes.isEmpty()), call);
            } catch (Exception ignored) {
                // A copied backup cannot decrypt a key from another device.
                prefs().edit().clear().commit();
                restoreResult(call, false);
            }
        });
    }

    @PluginMethod
    public void clearAllCookies(PluginCall call) {
        observeCookieHeaders();
        execute(() -> {
            List<CookieWrite> writes = new ArrayList<>();
            for (String url : URLS) {
                JSObject cookies = cookiesAt(url);
                JSONArray names = cookies.names();
                if (names == null) continue;
                Uri parsed = Uri.parse(url);
                String[] paths = { "/", "/authserver", "/authserver/", "/njlgdx", "/njlgdx/" };
                for (int i = 0; i < names.length(); i++) {
                    String name = names.optString(i);
                    for (String path : paths) {
                        String expired = name + "=; Max-Age=0; Path=" + path
                            + ("https".equals(parsed.getScheme()) ? "; Secure" : "");
                        writes.add(new CookieWrite(url, expired));
                        writes.add(new CookieWrite(url, expired + "; Domain=" + parsed.getHost()));
                        if (parsed.getHost().endsWith(".njust.edu.cn")) {
                            writes.add(new CookieWrite(url, expired + "; Domain=njust.edu.cn"));
                        }
                    }
                }
            }
            prefs().edit().clear().commit();
            synchronized (cookieMetadata) { cookieMetadata.clear(); }
            // Delete only this app's school cookies, not unrelated local data.
            applyCookies(writes, () -> {
                for (String url : URLS) if (cookiesAt(url).length() > 0) {
                    call.reject("学校旧会话未能清除，请重新打开应用后重试"); return;
                }
                JSObject result = new JSObject(); result.put("cleared", true); call.resolve(result);
            }, call, false);
        });
    }

    @PluginMethod
    public void clearSession(PluginCall call) {
        execute(() -> { prefs().edit().clear().commit(); JSObject result = new JSObject(); result.put("cleared", true); call.resolve(result); });
    }

    private void restoreResult(PluginCall call, boolean restored) {
        JSObject result = new JSObject(); result.put("restored", restored); call.resolve(result);
    }

    private void applyCookies(List<CookieWrite> writes, Runnable completed, PluginCall call) {
        applyCookies(writes, completed, call, true);
    }

    private void applyCookies(List<CookieWrite> writes, Runnable completed, PluginCall call, boolean requireAccepted) {
        if (writes.isEmpty()) { completed.run(); return; }
        AtomicInteger remaining = new AtomicInteger(writes.size());
        AtomicBoolean failed = new AtomicBoolean(false);
        getActivity().runOnUiThread(() -> {
            for (CookieWrite write : writes) {
                CookieManager.getInstance().setCookie(write.url, write.value, accepted -> {
                    if (!accepted) failed.set(true);
                    if (remaining.decrementAndGet() == 0) execute(() -> {
                        CookieManager.getInstance().flush();
                        if (requireAccepted && failed.get()) call.reject("学校会话写入失败，请重新登录");
                        else completed.run();
                    });
                });
            }
        });
    }

    private SharedPreferences prefs() { return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    private SecretKey sessionKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (store.containsAlias(KEY_ALIAS)) return ((KeyStore.SecretKeyEntry) store.getEntry(KEY_ALIAS, null)).getSecretKey();
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true).build());
        return generator.generateKey();
    }
}
