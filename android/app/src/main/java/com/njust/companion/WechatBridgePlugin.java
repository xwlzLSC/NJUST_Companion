package com.njust.companion;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.util.UUID;

@CapacitorPlugin(name = "WechatBridge", permissions = {
    @Permission(alias = "legacyAlbum", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
})
/**
 * APK 与微信之间的系统交互：复制授权链接、打开微信、保存二维码以及返回事件。
 * 这里不实现学校登录；打开微信/保存图片成功不代表学校已经授权，须由 JS 层继续检查。
 * 每个 PluginCall 必须 resolve/reject，IO 放在后台，启动 Activity 在主线程，避免页面卡住。
 */
public class WechatBridgePlugin extends Plugin {
    private boolean waitingForWechat;

    // 兼容旧网页调用名：仍经过 copyLinkAndOpenWechat 的学校授权地址校验。
    @PluginMethod
    public void shareLink(PluginCall call) {
        copyLinkAndOpenWechat(call);
    }

    @PluginMethod
    /** 仅接受学校短时 uuid 授权地址；禁止任意 URI、用户信息、端口和额外查询参数。 */
    public void copyLinkAndOpenWechat(PluginCall call) {
        String url = call.getString("url", "");
        Uri target = Uri.parse(url);
        String uuid = target.isHierarchical() ? target.getQueryParameter("uuid") : null;
        if (!target.isHierarchical() || !"https".equals(target.getScheme())
            || !"ids.njust.edu.cn".equals(target.getHost())
            || target.getPort() != -1
            || target.getUserInfo() != null
            || !"/authserver/qrCode/qrCodeLogin.do".equals(target.getPath())
            || target.getFragment() != null
            || target.getQueryParameterNames().size() != 1
            || target.getQueryParameters("uuid").size() != 1
            || uuid == null
            || !uuid.matches("^[A-Za-z0-9_-]{16,64}$")) {
            call.reject("学校授权链接无效，请重新获取");
            return;
        }
        // WeChat's exported share activity is not a reliable ACTION_SEND
        // text/plain target. Copy on the foreground user gesture and open its
        // ordinary launcher instead; do not rely on private WeChat activities.
        getActivity().runOnUiThread(() -> {
            boolean copied = false;
            try {
                ClipboardManager clipboard = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
                if (clipboard == null) throw new IllegalStateException("Clipboard unavailable");
                ClipData clip = ClipData.newPlainText("智慧理工一次性授权链接", url);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    android.os.PersistableBundle extras = new android.os.PersistableBundle();
                    extras.putBoolean(android.content.ClipDescription.EXTRA_IS_SENSITIVE, true);
                    clip.getDescription().setExtras(extras);
                }
                clipboard.setPrimaryClip(clip);
                copied = true;
                Intent launch = getContext().getPackageManager().getLaunchIntentForPackage("com.tencent.mm");
                if (launch == null) { linkResult(call, true, false); return; }
                waitingForWechat = true;
                getActivity().startActivity(launch);
                linkResult(call, true, true);
            } catch (Exception error) {
                waitingForWechat = false;
                if (copied) linkResult(call, true, false);
                else call.reject("复制授权链接失败，请手动复制后打开微信");
            }
        });
    }

    private void linkResult(PluginCall call, boolean copied, boolean opened) {
        JSObject result = new JSObject();
        result.put("copied", copied);
        result.put("opened", opened);
        result.put("mode", "clipboard");
        call.resolve(result);
    }

    @PluginMethod
    public void openWechat(PluginCall call) {
        Intent launch = getContext().getPackageManager().getLaunchIntentForPackage("com.tencent.mm");
        if (launch == null) {
            call.reject("未检测到微信，请先安装微信或改用账号密码登录");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                waitingForWechat = true;
                getActivity().startActivity(launch);
                JSObject result = new JSObject();
                result.put("opened", true);
                call.resolve(result);
            } catch (Exception error) {
                waitingForWechat = false;
                call.reject("打开微信失败，请手动打开微信扫一扫");
            }
        });
    }

    @PluginMethod
    /** 图片校验与相册权限分开处理；Android 10+ 只写本应用新增图片。 */
    public void saveQrImage(PluginCall call) {
        String image = call.getString("imageDataUrl", "");
        if (image.length() > 160000 || !image.matches("^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$")) {
            call.reject("二维码图片无效，请重新获取");
            return;
        }
        // Android 10+ writes only the image owned by this app; never request
        // access to the user's existing photos. Legacy permission is maxSdk 28.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
            && getPermissionState("legacyAlbum") != PermissionState.GRANTED) {
            requestPermissionForAlias("legacyAlbum", call, "albumPermissionResult");
            return;
        }
        writeQrImage(call);
    }

    @PermissionCallback
    private void albumPermissionResult(PluginCall call) {
        if (getPermissionState("legacyAlbum") != PermissionState.GRANTED) {
            call.reject("未允许保存图片，可以改用微信链接登录");
            return;
        }
        writeQrImage(call);
    }

    /** 失败只删除本次创建的未完成图片，不碰用户已有相册内容。 */
    private void writeQrImage(PluginCall call) {
        execute(() -> {
            ContentResolver resolver = getContext().getContentResolver();
            Uri created = null;
            try {
                String image = call.getString("imageDataUrl", "");
                boolean png = image.startsWith("data:image/png;");
                byte[] bytes = Base64.decode(image.substring(image.indexOf(',') + 1), Base64.NO_WRAP);
                BitmapFactory.Options bounds = new BitmapFactory.Options();
                bounds.inJustDecodeBounds = true;
                BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
                String mime = png ? "image/png" : "image/jpeg";
                if (bytes.length < 32 || bytes.length > 120000 || bounds.outWidth < 1 || bounds.outHeight < 1
                    || bounds.outWidth > 2048 || bounds.outHeight > 2048 || !mime.equals(bounds.outMimeType)) {
                    throw new IllegalArgumentException("Invalid QR image");
                }
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, "NJUST-Wechat-" + UUID.randomUUID() + (png ? ".png" : ".jpg"));
                values.put(MediaStore.Images.Media.MIME_TYPE, mime);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/NJUSTCompanion");
                    values.put(MediaStore.Images.Media.IS_PENDING, 1);
                }
                created = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (created == null) throw new IllegalStateException("Album unavailable");
                try (OutputStream stream = resolver.openOutputStream(created)) {
                    if (stream == null) throw new IllegalStateException("Album unavailable");
                    stream.write(bytes);
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues ready = new ContentValues();
                    ready.put(MediaStore.Images.Media.IS_PENDING, 0);
                    resolver.update(created, ready, null, null);
                }
                JSObject result = new JSObject();
                result.put("saved", true);
                call.resolve(result);
            } catch (Exception error) {
                // Remove only the incomplete row just created by this request.
                if (created != null) {
                    try { resolver.delete(created, null, null); } catch (Exception ignored) { }
                }
                call.reject("保存二维码失败，请检查可用空间，或改用微信链接登录");
            }
        });
    }

    @Override
    protected void handleOnResume() {
        if (waitingForWechat) {
            waitingForWechat = false;
            notifyListeners("appReturned", new JSObject());
        }
    }
}
