package com.njust.companion;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

final class WidgetDataStore {
    private static final String PREFS_NAME = "njust_widget_data";
    private static final String KEY_PAYLOAD = "payload";

    private WidgetDataStore() {}

    static void savePayload(Context context, String payload) {
        SharedPreferences prefs = context.getApplicationContext()
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_PAYLOAD, payload == null ? "{}" : payload).apply();
    }

    static JSONObject readPayload(Context context) {
        SharedPreferences prefs = context.getApplicationContext()
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY_PAYLOAD, "{}");
        try {
            return new JSONObject(raw == null ? "{}" : raw);
        } catch (Exception ignored) {
            return new JSONObject();
        }
    }
}
