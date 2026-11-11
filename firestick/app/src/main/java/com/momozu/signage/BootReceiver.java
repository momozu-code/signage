package com.momozu.signage;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;

/**
 * Opens the player when the Fire Stick starts up (or after the app is updated).
 * Opens it straight away, then again after 15 and 45 seconds, because the Fire TV home screen
 * often comes up after us and covers the app.
 */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
                && !"android.intent.action.QUICKBOOT_POWERON".equals(action)
                && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            return;
        }
        open(context);

        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        long[] delays = {15_000L, 45_000L};
        for (int i = 0; i < delays.length; i++) {
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
            PendingIntent pi = PendingIntent.getActivity(context, 100 + i, openIntent(context), flags);
            try {
                alarms.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, SystemClock.elapsedRealtime() + delays[i], pi);
            } catch (Exception ignored) {
            }
        }
    }

    static Intent openIntent(Context context) {
        Intent open = new Intent(context, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        return open;
    }

    private static void open(Context context) {
        try {
            context.startActivity(openIntent(context));
        } catch (Exception ignored) {
            // Newer Fire OS blocks this unless "Display over other apps" is allowed for the app.
        }
    }
}
