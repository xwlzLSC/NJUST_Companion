package com.njust.companion;

import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * Android 壳入口：注册网页会调用的原生插件，再交给 Capacitor 创建 WebView。
 * 插件注册名必须与 js/native-sync.js、js/app.js 中的 registerPlugin 名称一致。
 * 升级迁移只刷新网页资源缓存，不删除用户的 IndexedDB、登录凭据或离线课表。
 */
public class MainActivity extends BridgeActivity {
    private static final String PREFS_NAME = "njust_runtime";
    private static final String KEY_LAST_RUNTIME_VERSION = "last_runtime_version_code";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppUpdatePlugin.class);
        registerPlugin(NJUSTWidgetPlugin.class);
        registerPlugin(SecureCredentialsPlugin.class);
        registerPlugin(SchoolSessionPlugin.class);
        registerPlugin(WechatBridgePlugin.class);
        super.onCreate(savedInstanceState);
        migrateWebRuntimeOnAppUpgrade();
    }

    /** 新 versionCode 安装后清理旧 Service Worker/静态缓存，防止仍显示上版 UI。 */
    private void migrateWebRuntimeOnAppUpgrade() {
        long currentVersionCode = getCurrentVersionCode();
        if (currentVersionCode <= 0) {
            return;
        }

        SharedPreferences preferences = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        long previousVersionCode = preferences.getLong(KEY_LAST_RUNTIME_VERSION, 0L);
        preferences.edit().putLong(KEY_LAST_RUNTIME_VERSION, currentVersionCode).apply();

        if (previousVersionCode <= 0L || previousVersionCode == currentVersionCode) {
            return;
        }

        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        WebView webView = getBridge().getWebView();
        webView.post(() -> {
            webView.clearCache(true);
            webView.evaluateJavascript(
                "(async()=>{try{" +
                    "if('serviceWorker' in navigator){" +
                      "const regs=await navigator.serviceWorker.getRegistrations();" +
                      "await Promise.all(regs.map(reg=>reg.unregister().catch(()=>false)));" +
                    "}" +
                    "if('caches' in window){" +
                      "const keys=await caches.keys();" +
                      "await Promise.all(keys.map(key=>caches.delete(key).catch(()=>false)));" +
                    "}" +
                  "}catch(e){}finally{" +
                    "window.location.reload();" +
                  "}})();",
                (ValueCallback<String>) null
            );
        });
    }

    private long getCurrentVersionCode() {
        try {
            PackageManager packageManager = getPackageManager();
            PackageInfo packageInfo;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                packageInfo = packageManager.getPackageInfo(
                    getPackageName(),
                    PackageManager.PackageInfoFlags.of(0)
                );
            } else {
                packageInfo = packageManager.getPackageInfo(getPackageName(), 0);
            }
            return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? packageInfo.getLongVersionCode()
                : packageInfo.versionCode;
        } catch (Exception ignored) {
            return 0L;
        }
    }
}
