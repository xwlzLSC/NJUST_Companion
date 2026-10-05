package com.njust.companion;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * “记住密码”的原生边界。密钥保存在 Android Keystore，密码经 AES-GCM 加密后存储。
 * 每次加密使用 Cipher 生成的新 IV，读取时密文与 IV 必须配套。
 * 不得把该存储改成明文 SharedPreferences/localStorage，也不得将解密结果写日志。
 */
@CapacitorPlugin(name = "SecureCredentials")
public class SecureCredentialsPlugin extends Plugin {
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "njust_companion_login_v1";
    private static final String PREFS = "njust_secure_credentials";
    private static final String USERNAME = "username";
    private static final String PASSWORD = "password";
    private static final String IV = "iv";

    @PluginMethod
    /** 同步提交持久化结果，只有真正保存成功才向网页返回 saved=true。 */
    public void save(PluginCall call) {
        String username = call.getString("username", "").trim();
        String password = call.getString("password", "");
        if (username.isEmpty() || password.isEmpty()) {
            call.reject("账号或密码为空");
            return;
        }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
            byte[] encrypted = cipher.doFinal(password.getBytes(StandardCharsets.UTF_8));
            boolean saved = getPrefs().edit()
                .putString(USERNAME, username)
                .putString(PASSWORD, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .putString(IV, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .commit();
            if (!saved) throw new IllegalStateException("Credentials not saved");
            JSObject result = new JSObject();
            result.put("saved", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("安全保存登录凭据失败", error);
        }
    }

    @PluginMethod
    /** 未保存过凭据返回空值；损坏/无法解密时交给调用方提示，而非编造密码。 */
    public void load(PluginCall call) {
        SharedPreferences prefs = getPrefs();
        String username = prefs.getString(USERNAME, "");
        String encryptedText = prefs.getString(PASSWORD, "");
        String ivText = prefs.getString(IV, "");
        JSObject result = new JSObject();
        if (username.isEmpty() || encryptedText.isEmpty() || ivText.isEmpty()) {
            result.put("username", "");
            result.put("password", "");
            call.resolve(result);
            return;
        }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                Cipher.DECRYPT_MODE,
                getOrCreateKey(),
                new GCMParameterSpec(128, Base64.decode(ivText, Base64.NO_WRAP))
            );
            byte[] decrypted = cipher.doFinal(Base64.decode(encryptedText, Base64.NO_WRAP));
            result.put("username", username);
            result.put("password", new String(decrypted, StandardCharsets.UTF_8));
            call.resolve(result);
        } catch (Exception error) {
            // A restored backup cannot use a key from another device. Clear the
            // unusable ciphertext instead of leaving auto-login permanently stuck.
            getPrefs().edit().clear().apply();
            call.reject("读取安全登录凭据失败", error);
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        if (!getPrefs().edit().clear().commit()) {
            call.reject("安全清除登录凭据失败，请重试");
            return;
        }
        JSObject result = new JSObject();
        result.put("cleared", true);
        call.resolve(result);
    }

    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        generator.init(new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
         .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
         .setRandomizedEncryptionRequired(true)
         .build());
        return generator.generateKey();
    }
}
