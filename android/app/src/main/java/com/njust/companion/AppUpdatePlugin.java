package com.njust.companion;

import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.text.TextUtils;
import android.widget.Toast;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NJUSTAppUpdate")
public class AppUpdatePlugin extends Plugin {
    private BroadcastReceiver downloadReceiver;
    private DownloadManager downloadManager;
    private long pendingDownloadId = -1L;

    @Override
    public void load() {
        super.load();
        downloadManager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        registerDownloadReceiver();
    }

    @Override
    protected void handleOnDestroy() {
        unregisterDownloadReceiver();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void getAppInfo(PluginCall call) {
        try {
            Context context = getContext();
            PackageManager packageManager = context.getPackageManager();
            PackageInfo packageInfo;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                packageInfo = packageManager.getPackageInfo(
                    context.getPackageName(),
                    PackageManager.PackageInfoFlags.of(0)
                );
            } else {
                packageInfo = packageManager.getPackageInfo(context.getPackageName(), 0);
            }

            long versionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? packageInfo.getLongVersionCode()
                : packageInfo.versionCode;

            JSObject result = new JSObject();
            result.put("packageName", context.getPackageName());
            result.put("versionName", packageInfo.versionName == null ? "" : packageInfo.versionName);
            result.put("versionCode", versionCode);
            result.put("canRequestPackageInstalls", canRequestPackageInstalls());
            call.resolve(result);
        } catch (Exception error) {
            call.reject("读取应用版本失败：" + error.getMessage());
        }
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        try {
            Context context = getContext();
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + context.getPackageName())
                );
            } else {
                intent = new Intent(Settings.ACTION_SECURITY_SETTINGS);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("打开安装权限设置失败：" + error.getMessage());
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url", "").trim();
        String fileName = call.getString("fileName", "").trim();
        if (TextUtils.isEmpty(url)) {
            call.reject("缺少更新包下载地址");
            return;
        }

        if (!canRequestPackageInstalls()) {
            call.reject("当前未允许本应用安装更新包", "INSTALL_PERMISSION_REQUIRED");
            return;
        }

        if (downloadManager == null) {
            call.reject("当前设备不支持系统下载服务");
            return;
        }

        if (TextUtils.isEmpty(fileName)) {
            fileName = "NJUST_Companion-release.apk";
        }

        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle("南理教务助手更新包");
            request.setDescription("下载完成后会尝试自动弹出安装");
            request.setMimeType("application/vnd.android.package-archive");
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(true);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
            pendingDownloadId = downloadManager.enqueue(request);

            JSObject result = new JSObject();
            result.put("started", true);
            result.put("downloadId", pendingDownloadId);
            result.put("fileName", fileName);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("开始下载更新失败：" + error.getMessage());
        }
    }

    private boolean canRequestPackageInstalls() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return true;
        }
        return getContext().getPackageManager().canRequestPackageInstalls();
    }

    private void registerDownloadReceiver() {
        if (downloadReceiver != null) {
            return;
        }

        downloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || !DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) {
                    return;
                }
                long downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                if (downloadId <= 0 || downloadId != pendingDownloadId) {
                    return;
                }
                pendingDownloadId = -1L;
                openDownloadedApk(downloadId);
            }
        };

        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.registerReceiver(getContext(), downloadReceiver, filter, ContextCompat.RECEIVER_EXPORTED);
        } else {
            getContext().registerReceiver(downloadReceiver, filter);
        }
    }

    private void unregisterDownloadReceiver() {
        if (downloadReceiver == null) {
            return;
        }
        try {
            getContext().unregisterReceiver(downloadReceiver);
        } catch (Exception ignored) {
            // ignore
        }
        downloadReceiver = null;
    }

    private void openDownloadedApk(long downloadId) {
        if (downloadManager == null) {
            return;
        }

        DownloadManager.Query query = new DownloadManager.Query().setFilterById(downloadId);
        Uri apkUri = null;

        try (Cursor cursor = downloadManager.query(query)) {
            if (cursor == null || !cursor.moveToFirst()) {
                return;
            }

            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            if (status != DownloadManager.STATUS_SUCCESSFUL) {
                Toast.makeText(getContext(), "更新包下载失败，请重试", Toast.LENGTH_LONG).show();
                return;
            }

            apkUri = downloadManager.getUriForDownloadedFile(downloadId);
            if (apkUri == null) {
                String localUri = cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI));
                if (!TextUtils.isEmpty(localUri)) {
                    apkUri = Uri.parse(localUri);
                }
            }
        } catch (Exception error) {
            Toast.makeText(getContext(), "打开更新包失败：" + error.getMessage(), Toast.LENGTH_LONG).show();
            return;
        }

        if (apkUri == null) {
            Toast.makeText(getContext(), "没有找到更新包文件", Toast.LENGTH_LONG).show();
            return;
        }

        Intent installIntent = new Intent(Intent.ACTION_VIEW);
        installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        try {
            getContext().startActivity(installIntent);
        } catch (ActivityNotFoundException error) {
            Toast.makeText(getContext(), "系统没有可用的安装器，请从通知栏打开下载完成的 APK", Toast.LENGTH_LONG).show();
        } catch (Exception error) {
            Toast.makeText(getContext(), "启动安装失败：" + error.getMessage(), Toast.LENGTH_LONG).show();
        }
    }
}
