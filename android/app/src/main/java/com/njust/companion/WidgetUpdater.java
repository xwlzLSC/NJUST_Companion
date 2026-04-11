package com.njust.companion;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;

final class WidgetUpdater {
    private WidgetUpdater() {}

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        updateProvider(context, manager, ScheduleWidgetProvider.class, "schedule");
        updateProvider(context, manager, TodoWidgetProvider.class, "todos");
        updateProvider(context, manager, ExamWidgetProvider.class, "exams");
        updateProvider(context, manager, OverviewWidgetProvider.class, "overview");
    }

    static void updateProvider(Context context, AppWidgetManager manager, Class<?> providerClass, String type) {
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, providerClass));
        if (ids == null || ids.length == 0) return;
        updateWidgets(context, manager, ids, type);
    }

    static void updateWidgets(Context context, AppWidgetManager manager, int[] ids, String type) {
        for (int id : ids) {
            manager.updateAppWidget(id, NJUSTWidgetRenderer.createViews(context, type));
        }
    }
}
