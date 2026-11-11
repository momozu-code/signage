package com.momozu.signage;

import android.annotation.TargetApi;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Full-screen web player for the signage page.
 * Keeps the TV awake, retries when offline, ignores the Back button,
 * and reloads every 12 hours to pick up player updates. Menu button reloads now.
 */
public class MainActivity extends Activity {

    private static final long RETRY_MS = 15_000L;
    private static final long REFRESH_MS = 12L * 60 * 60 * 1000;

    private WebView web;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private final Runnable retry = new Runnable() {
        @Override public void run() { load(); }
    };
    private final Runnable refresh = new Runnable() {
        @Override public void run() {
            if (isOnline()) load();
            handler.postDelayed(this, REFRESH_MS);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_FULLSCREEN);

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setFocusable(false);
        setContentView(web);
        hideSystemUi();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @SuppressWarnings("deprecation")
            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                if (failingUrl != null && failingUrl.equals(BuildConfig.PLAYER_URL)) scheduleRetry();
            }

            @TargetApi(Build.VERSION_CODES.M)
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request != null && request.isForMainFrame()) scheduleRetry();
            }
        });

        askForAutoStartPermissionOnce();
        load();
        handler.postDelayed(refresh, REFRESH_MS);
    }

    private void load() {
        handler.removeCallbacks(retry);
        // Offline: use the copy saved from the last visit so the screen keeps playing.
        web.getSettings().setCacheMode(isOnline()
                ? WebSettings.LOAD_DEFAULT
                : WebSettings.LOAD_CACHE_ELSE_NETWORK);
        web.loadUrl(BuildConfig.PLAYER_URL);
    }

    private void scheduleRetry() {
        handler.removeCallbacks(retry);
        handler.postDelayed(retry, RETRY_MS);
    }

    @SuppressWarnings("deprecation")
    private boolean isOnline() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkInfo info = cm == null ? null : cm.getActiveNetworkInfo();
            return info != null && info.isConnected();
        } catch (Exception e) {
            return true;
        }
    }

    /** Newer Fire OS needs "display over other apps" for the app to open itself after a reboot. */
    private void askForAutoStartPermissionOnce() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return;
        if (Settings.canDrawOverlays(this)) return;
        SharedPreferences prefs = getSharedPreferences("signage", MODE_PRIVATE);
        if (prefs.getBoolean("askedOverlay", false)) return;
        prefs.edit().putBoolean("askedOverlay", true).apply();
        try {
            startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getPackageName())));
        } catch (Exception ignored) {
            // Some Fire OS builds hide this screen; it can be allowed over ADB instead.
        }
    }

    @SuppressWarnings("deprecation")
    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) return true;          // don't close by accident; Home still works
        if (keyCode == KeyEvent.KEYCODE_MENU) { load(); return true; } // reload now
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        hideSystemUi();
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        web.destroy();
        super.onDestroy();
    }
}
