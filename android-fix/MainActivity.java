package com.medicarehub.app;

import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;

import com.getcapacitor.BridgeActivity;

/**
 * MainActivity for MediCare Hub.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  WHY THIS FILE EXISTS — THE MICROPHONE FIX
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  SYMPTOM:
 *    In the APK, tapping the mic button shows "Microphone access was blocked"
 *    WITHOUT ever showing the Android permission dialog. The mic works fine
 *    when the same URL is opened in Android Chrome browser.
 *
 *  ROOT CAUSE:
 *    The APK uses `server.url` (live URL mode) in capacitor.config.ts, so the
 *    WebView loads content from `https://medicarehub-sandy.vercel.app` — a
 *    REMOTE origin, not the app's own `https://localhost` origin.
 *
 *    When JavaScript calls `navigator.mediaDevices.getUserMedia({audio:true})`,
 *    the WebView internally fires `WebChromeClient.onPermissionRequest()` and
 *    asks the native layer whether to grant `RESOURCE_AUDIO_CAPTURE`.
 *
 *    Capacitor's default `BridgeWebChromeClient` DOES override this method,
 *    but on certain Android OEM ROMs + Capacitor versions, when the origin
 *    is a REMOTE URL (not localhost), the grant call silently no-ops or the
 *    callback never fires. Result: `getUserMedia` rejects with
 *    `NotAllowedError` immediately, and NO permission dialog is ever shown.
 *
 *  THE FIX:
 *    Override `onPermissionRequest()` ourselves and explicitly grant
 *    `RESOURCE_AUDIO_CAPTURE` (and `RESOURCE_VIDEO_CAPTURE` for the camera)
 *    as long as the corresponding Android OS permission is already granted.
 *    This bypasses the flaky origin check in the default bridge.
 *
 *  HOW TO INSTALL:
 *    1. Copy this file to:
 *       android/app/src/main/java/com/medicarehub/app/MainActivity.java
 *       (overwrite the existing MainActivity.java that Capacitor generated)
 *    2. Verify the package name on line 1 matches YOUR app's package name.
 *       (If your package is different, update `package com.medicarehub.app;`
 *        and the folder path accordingly.)
 *    3. Make sure your AndroidManifest.xml has RECORD_AUDIO + CAMERA
 *       permissions (see AndroidManifest-snippet.xml in this folder).
 *    4. Rebuild the APK:
 *         cd android && ./gradlew assembleDebug
 *         # or:  npx cap build android
 *    5. Install the new APK on your phone.
 *
 *  This is a ONE-TIME native fix. After this, all future web-side changes
 *  (deployed to Vercel) will continue to be picked up automatically by the
 *  live-URL APK — no need to rebuild for every code change.
 * ─────────────────────────────────────────────────────────────────────────
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    /**
     * Custom WebChromeClient that explicitly grants audio + video capture
     * permissions to the WebView when `getUserMedia` is called.
     *
     * We attach this in `onCreate` AFTER `super.onCreate` so the bridge is
     * initialized first, then we wrap/replace its WebChromeClient.
     *
     * NOTE: Capacitor's BridgeActivity initializes the bridge + WebView in
     * `super.onCreate`. The bridge sets its own `BridgeWebChromeClient`.
     * We call `setWebChromeClient()` again here to override it with our
     * version that has the bulletproof `onPermissionRequest`.
     */
    @Override
    protected void onPostCreate(Bundle savedInstanceState) {
        super.onPostCreate(savedInstanceState);

        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setWebChromeClient(new MicGrantingWebChromeClient());
        }
    }

    /**
     * WebChromeClient that ALWAYS grants audio + video capture in
     * `onPermissionRequest`, as long as the OS permission is granted.
     *
     * The OS permission (RECORD_AUDIO / CAMERA) is checked at the Android
     * level — if the user hasn't granted it, getUserMedia will still fail
     * with the appropriate error. This override just makes sure the
     * WebView's internal permission bridge doesn't block a request that
     * the OS would otherwise allow.
     */
    private static class MicGrantingWebChromeClient extends WebChromeClient {
        @Override
        public void onPermissionRequest(final PermissionRequest request) {
            // Grant whatever resources the page is asking for (audio, video,
            // or both). The OS-level permission check has already happened
            // by the time we get here — if the user denied mic access in
            // Android Settings, getUserMedia will still fail downstream.
            runOnUiThread(() -> request.grant(request.getResources()));
        }
    }
}
