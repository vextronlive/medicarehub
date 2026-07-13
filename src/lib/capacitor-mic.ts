"use client"

/**
 * Microphone acquisition helper — PURE WEB STANDARD, no native bridge calls.
 *
 * Why no Capacitor Permissions plugin call?
 * ---------------------------------------------------------------
 * Earlier we tried calling `Capacitor.Plugins.Permissions.request()`
 * BEFORE `getUserMedia()` to "prime" the Android permission bridge.
 * That actually MADE THINGS WORSE in many Capacitor APKs:
 *
 *   • When the native Permissions plugin is installed, calling
 *     `request({ name: "microphone" })` consumes the Android runtime
 *     permission dialog. The subsequent `getUserMedia()` then expects
 *     the WebView's own `WebChromeClient.onPermissionRequest()` to
 *     fire for `RESOURCE_AUDIO_CAPTURE` — but on some Capacitor
 *     versions + live-URL (`server.url`) setups that callback never
 *     fires, so `getUserMedia` rejects with `NotAllowedError` even
 *     though the OS permission is already granted.
 *
 *   • When the native Permissions plugin is NOT installed, the priming
 *     call is a useless round-trip that just delays the real call.
 *
 * Fix: go straight to `navigator.mediaDevices.getUserMedia()`. In
 * Capacitor v3+ the default `BridgeWebChromeClient.onPermissionRequest`
 * AUTOMATICALLY grants `RESOURCE_AUDIO_CAPTURE` as long as:
 *   1. `android.permission.RECORD_AUDIO` is declared in AndroidManifest.xml
 *   2. The user has granted the runtime permission (Android Settings → App).
 *
 * We also retry once after a short delay — the WebView's
 * `onPermissionRequest` callback has a known first-call timing issue
 * on some Android OEM ROMs where it needs a second nudge.
 *
 * Constraints are kept as simple as possible (`{ audio: true }`).
 * Detailed constraints like `echoCancellation` / `noiseSuppression`
 * can cause `OverconstrainedError` or silent `NotReadableError` on
 * older Android WebViews.
 */

// ─── Capacitor detection (for messaging only — no native calls) ───────

interface CapacitorGlobal {
  isNativePlatform?: () => boolean
  getPlatform?: () => "android" | "ios" | "web"
}

function getCapacitor(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
  return cap || null
}

/** True if running inside a Capacitor native APK (not a regular browser). */
export function isCapacitorNative(): boolean {
  const cap = getCapacitor()
  return !!(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform())
}

/** True if running inside an Android Capacitor APK specifically. */
export function isAndroidNative(): boolean {
  const cap = getCapacitor()
  return !!(cap && typeof cap.getPlatform === "function" && cap.getPlatform() === "android")
}

/** True if running inside an iOS Capacitor APK. */
export function isIosNative(): boolean {
  const cap = getCapacitor()
  return !!(cap && typeof cap.getPlatform === "function" && cap.getPlatform() === "ios")
}

// ─── Settings deep-link (best-effort, messaging only) ─────────────────

/**
 * Best-effort attempt to deep-link into Android app settings.
 * Uses the Capacitor `App` plugin if it's registered; otherwise
 * returns false so the caller can show manual instructions.
 * This does NOT touch microphone permission — it's just a convenience
 * for the user to reach the Settings → Permissions screen.
 */
export async function openAndroidAppSettings(): Promise<boolean> {
  if (typeof window === "undefined") return false
  const cap = getCapacitor()
  const app = (cap as { Plugins?: Record<string, unknown> })?.Plugins
    ?.App as
    | { openUrl?: (opts: { url: string }) => Promise<unknown> }
    | undefined
  if (!cap || !app || typeof app.openUrl !== "function") return false
  try {
    await app.openUrl({ url: "android.settings.APPLICATION_DETAILS_SETTINGS" })
    return true
  } catch {
    try {
      await app.openUrl({ url: "package:com.medicarehub.app" })
      return true
    } catch {
      return false
    }
  }
}

// ─── Context-aware messaging ──────────────────────────────────────────

/**
 * Human-friendly "microphone blocked" message tailored to the platform.
 * APK users get Android-settings guidance; browser users get the
 * lock-icon guidance that actually applies to them.
 */
export function getMicBlockedMessage(error?: DOMException | Error | unknown): string {
  const name = (error as { name?: string })?.name
  const msg = (error as { message?: string })?.message

  if (isAndroidNative()) {
    return (
      "Microphone access was blocked by Android. Please open " +
      "Android Settings → Apps → MediCare Hub → Permissions → " +
      "Microphone → select \"Allow only while using the app\", then " +
      "come back and tap \"Try again\". " +
      (name ? `(Technical: ${name}${msg ? " — " + msg : ""})` : "")
    )
  }
  if (isIosNative()) {
    return (
      "Microphone access was blocked by iOS. Please open iOS Settings → " +
      "MediCare Hub → turn on Microphone, then return and tap \"Try again\"."
    )
  }
  return (
    "Microphone access was blocked. Click the lock icon in your browser " +
    "address bar and allow microphone access, then try again." +
    (name ? ` (Technical: ${name})` : "")
  )
}

// ─── The actual microphone acquisition (pure web standard) ────────────

/**
 * Acquire a microphone MediaStream using ONLY `navigator.mediaDevices.getUserMedia`.
 *
 * Strategy (maximizes compatibility with Capacitor WebView + Android):
 *   1. Try the simplest constraint `{ audio: true }` first.
 *   2. If it throws `NotAllowedError`, wait 400ms and retry ONCE — this
 *      works around a known first-call timing issue with the WebView's
 *      `onPermissionRequest` bridge on some Android OEM ROMs.
 *   3. If still failing, try once more with explicit "no constraints"
 *      audio object (some WebViews reject the boolean form).
 *
 * No native plugin calls. No file-input fallback. Just the web standard.
 */
export async function acquireMicrophoneStream(): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new DOMException(
      "This device does not support microphone access.",
      "NotSupportedError"
    )
  }

  // Ordered list of constraint strategies, simplest first.
  const strategies: Array<MediaStreamConstraints> = [
    { audio: true, video: false },
    { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false },
    { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false },
  ]

  let lastErr: unknown = null

  for (let i = 0; i < strategies.length; i++) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(strategies[i])
      return stream
    } catch (err) {
      lastErr = err
      const name = (err as DOMException)?.name

      // NotAllowedError is the common WebView bridge issue.
      // Retry: give the WebView's onPermissionRequest a second chance
      // to fire. Only retry on the FIRST strategy (simplest one).
      if (name === "NotAllowedError" && i === 0) {
        await new Promise((r) => setTimeout(r, 400))
        try {
          const stream = await navigator.mediaDevices.getUserMedia(strategies[0])
          return stream
        } catch (retryErr) {
          lastErr = retryErr
          // Hard-denied — no point trying the other strategies, they'll
          // also fail with NotAllowedError. Bail out now with the real
          // reason so the user gets the right guidance.
          break
        }
      }

      // OverconstrainedError → try the next (looser) strategy.
      if (name === "OverconstrainedError" || name === "NotReadableError") {
        continue
      }

      // Any other error → bail.
      break
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new DOMException(
        "Could not access microphone. Please check your device settings.",
        "NotReadableError"
      )
}
