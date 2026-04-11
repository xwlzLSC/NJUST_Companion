package com.njust.companion;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NJUSTWidget")
public class NJUSTWidgetPlugin extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        String payload = call.getString("payload", "{}");
        WidgetDataStore.savePayload(getContext(), payload);
        WidgetUpdater.updateAll(getContext());
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void refresh(PluginCall call) {
        WidgetUpdater.updateAll(getContext());
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void pin(PluginCall call) {
        String type = call.getString("type", "overview");
        JSObject result = new JSObject();
        Context context = getContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !manager.isRequestPinAppWidgetSupported()) {
            WidgetUpdater.updateAll(context);
            result.put("pinned", false);
            call.resolve(result);
            return;
        }

        ComponentName provider = getProviderComponent(context, type);
        Intent callbackIntent = new Intent(context, MainActivity.class);
        PendingIntent successCallback = PendingIntent.getActivity(
            context,
            type.hashCode(),
            callbackIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        boolean requested = manager.requestPinAppWidget(provider, null, successCallback);
        result.put("pinned", requested);
        call.resolve(result);
    }

    private ComponentName getProviderComponent(Context context, String type) {
        if ("schedule".equals(type)) return new ComponentName(context, ScheduleWidgetProvider.class);
        if ("todos".equals(type)) return new ComponentName(context, TodoWidgetProvider.class);
        if ("exams".equals(type)) return new ComponentName(context, ExamWidgetProvider.class);
        return new ComponentName(context, OverviewWidgetProvider.class);
    }
}
