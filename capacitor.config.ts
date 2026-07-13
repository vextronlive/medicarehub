import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for MediCare Hub.
 *
 * Two ways to package the updated app:
 *
 * 1) LIVE URL (recommended — picks up new changes automatically):
 *    - Keep `server.url` pointing to your Vercel deployment.
 *    - The APK is just a thin wrapper; every code push to Vercel is
 *      reflected immediately without rebuilding the APK.
 *
 * 2) STATIC BUNDLE (offline-friendly):
 *    - Run `bun run build` then copy `.next/standalone` + `.next/static`
 *      + `public/` into the `android/app/src/main/assets/public` folder.
 *    - Remove `server.url` below.
 *    - Rebuild APK. Required for offline use, but must be re-synced
 *      every time you change code.
 */
const config: CapacitorConfig = {
  appId: "com.medicarehub.app",
  appName: "MediCare Hub",
  webDir: "public",
  bundledWebRuntime: false,
  server: {
    // 👇 Your live Vercel deployment — APK loads all code from here.
    url: "https://medicarehub-sandy.vercel.app",
    cleartext: true,
    androidScheme: "https",
    // Allow WebView navigation to the Vercel domain + its subdomains.
    // (This is for navigation; the actual getUserMedia permission grant
    // is handled by the native MainActivity.java override in android-fix/.)
    allowNavigation: [
      "medicarehub-sandy.vercel.app",
      "*.vercel.app",
    ],
  },
  android: {
    allowMixedContent: true,
    backgroundColor: "#0f766e",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#0f766e",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: false,
    },
    BiometricAuth: {
      disableBackupCode: false,
    },
  },
  permissions: [
    "android.permission.INTERNET",
    "android.permission.ACCESS_NETWORK_STATE",
    "android.permission.USE_BIOMETRIC",
    "android.permission.USE_FINGERPRINT",
    "android.permission.CAMERA",
    "android.permission.RECORD_AUDIO",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.ACCESS_COARSE_LOCATION",
  ],
};

export default config;
