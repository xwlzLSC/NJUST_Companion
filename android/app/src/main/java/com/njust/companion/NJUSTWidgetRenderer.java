package com.njust.companion;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

final class NJUSTWidgetRenderer {
    private NJUSTWidgetRenderer() {}

    static RemoteViews createViews(Context context, String type) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_companion);
        JSONObject data = WidgetDataStore.readPayload(context);

        String normalizedType = type == null ? "overview" : type;
        if ("schedule".equals(normalizedType)) {
            renderSchedule(views, data);
        } else if ("todos".equals(normalizedType)) {
            renderTodos(views, data);
        } else if ("exams".equals(normalizedType)) {
            renderExams(views, data);
        } else {
            renderOverview(views, data);
        }

        views.setTextViewText(R.id.widget_footer, footerText(data));
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            normalizedType.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);
        return views;
    }

    private static void renderSchedule(RemoteViews views, JSONObject data) {
        JSONObject next = data.optJSONObject("nextCourse");
        JSONArray today = data.optJSONArray("todayCourses");
        views.setTextViewText(R.id.widget_kicker, "课程表");
        if (next != null) {
            views.setTextViewText(R.id.widget_title, next.optString("name", "下节课"));
            views.setTextViewText(R.id.widget_line1, join(next.optString("when"), next.optString("room")));
            views.setTextViewText(R.id.widget_line2, next.optString("teacher", "打开应用查看详情"));
        } else {
            views.setTextViewText(R.id.widget_title, "近期没有课程");
            views.setTextViewText(R.id.widget_line1, "同步课表后会自动刷新");
            views.setTextViewText(R.id.widget_line2, "");
        }
        views.setTextViewText(R.id.widget_line3, todaySummary(today));
    }

    private static void renderTodos(RemoteViews views, JSONObject data) {
        JSONArray todos = data.optJSONArray("todos");
        JSONObject first = firstObject(todos);
        views.setTextViewText(R.id.widget_kicker, "待办");
        if (first != null) {
            views.setTextViewText(R.id.widget_title, first.optString("title", "待办事件"));
            views.setTextViewText(R.id.widget_line1, first.optString("due", "未设置时间"));
            views.setTextViewText(R.id.widget_line2, first.optString("note", ""));
        } else {
            views.setTextViewText(R.id.widget_title, "暂无待办");
            views.setTextViewText(R.id.widget_line1, "打开应用新建待办事件");
            views.setTextViewText(R.id.widget_line2, "");
        }
        views.setTextViewText(R.id.widget_line3, countText(data, "todos", "待处理"));
    }

    private static void renderExams(RemoteViews views, JSONObject data) {
        JSONArray exams = data.optJSONArray("exams");
        JSONObject first = firstObject(exams);
        views.setTextViewText(R.id.widget_kicker, "考试安排");
        if (first != null) {
            views.setTextViewText(R.id.widget_title, first.optString("name", "考试"));
            views.setTextViewText(R.id.widget_line1, join(first.optString("date"), first.optString("time")));
            views.setTextViewText(R.id.widget_line2, first.optString("room", "考场待定"));
            views.setTextViewText(R.id.widget_line3, first.optInt("countdown", 0) == 0 ? "今天考试" : "还剩 " + first.optInt("countdown") + " 天");
        } else {
            views.setTextViewText(R.id.widget_title, "暂无近期考试");
            views.setTextViewText(R.id.widget_line1, "同步考试安排后会自动刷新");
            views.setTextViewText(R.id.widget_line2, "");
            views.setTextViewText(R.id.widget_line3, "");
        }
    }

    private static void renderOverview(RemoteViews views, JSONObject data) {
        JSONObject next = data.optJSONObject("nextCourse");
        JSONObject todo = firstObject(data.optJSONArray("todos"));
        JSONObject exam = firstObject(data.optJSONArray("exams"));
        views.setTextViewText(R.id.widget_kicker, "南理教务助手");
        views.setTextViewText(R.id.widget_title, "今日总览");
        views.setTextViewText(R.id.widget_line1, next != null ? "课：" + next.optString("name", "下节课") : "课：近期无课");
        views.setTextViewText(R.id.widget_line2, todo != null ? "办：" + todo.optString("title", "待办") : "办：暂无待办");
        views.setTextViewText(R.id.widget_line3, exam != null ? "考：" + exam.optString("name", "考试") : "考：暂无近期考试");
    }

    private static JSONObject firstObject(JSONArray array) {
        if (array == null || array.length() == 0) return null;
        return array.optJSONObject(0);
    }

    private static String todaySummary(JSONArray today) {
        if (today == null || today.length() == 0) return "今日无课";
        StringBuilder builder = new StringBuilder("今日 ");
        int max = Math.min(today.length(), 2);
        for (int i = 0; i < max; i++) {
            JSONObject item = today.optJSONObject(i);
            if (item == null) continue;
            if (i > 0) builder.append(" / ");
            builder.append(item.optString("name", "课程"));
        }
        if (today.length() > max) builder.append(" 等 ").append(today.length()).append(" 门");
        return builder.toString();
    }

    private static String countText(JSONObject data, String key, String suffix) {
        JSONObject counts = data.optJSONObject("counts");
        int count = counts == null ? 0 : counts.optInt(key, 0);
        return count + " 件" + suffix;
    }

    private static String footerText(JSONObject data) {
        String updatedAt = data.optString("updatedAt", "");
        String updatedAtText = data.optString("updatedAtText", "");
        String semester = data.optString("semester", "");
        int week = data.optInt("currentWeek", 0);
        String update = updatedAtText.length() > 0
            ? "更新 " + updatedAtText
            : updatedAt.length() >= 16 ? "更新 " + updatedAt.substring(11, 16) : "等待同步";
        if (week > 0 && semester.length() > 0) return "第 " + week + " 周 · " + semester + " · " + update;
        if (week > 0) return "第 " + week + " 周 · " + update;
        return update;
    }

    private static String join(String left, String right) {
        boolean hasLeft = left != null && left.length() > 0;
        boolean hasRight = right != null && right.length() > 0;
        if (hasLeft && hasRight) return left + " · " + right;
        if (hasLeft) return left;
        if (hasRight) return right;
        return "";
    }
}
