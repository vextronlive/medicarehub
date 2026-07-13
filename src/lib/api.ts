"use client"

/**
 * API base URL resolution.
 *
 * - In the browser (dev or deployed web), relative paths ("/api/...") work.
 * - In an APK (Capacitor/TWA), the frontend is bundled locally but the API
 *   runs on a remote server, so we need an absolute base URL.
 *
 * Priority:
 *   1. NEXT_PUBLIC_API_BASE_URL env var (set at build time for APK builds)
 *   2. window.__API_BASE_URL__ (runtime override, useful for TWA/WebView)
 *   3. "" (empty → relative paths, for same-origin web deployment)
 */
function getApiBase(): string {
  if (typeof window !== "undefined") {
    // Runtime override (e.g. injected by Capacitor config or TWA)
    const runtime = (window as unknown as { __API_BASE_URL__?: string }).__API_BASE_URL__
    if (runtime) return runtime.replace(/\/$/, "")
  }
  // Build-time env var
  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL
  if (envBase) return envBase.replace(/\/$/, "")
  // Same-origin (default for web deployment)
  return ""
}

/**
 * Build a full API URL from a relative path like "/api/auth/login".
 * If the path is already absolute (http/https), it is returned as-is.
 */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const base = getApiBase()
  if (!base) return path // relative — same origin
  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}

/**
 * ApiError — thrown by apiFetch when the server returns a non-2xx response.
 * Carries the HTTP status and the parsed JSON body so callers can read
 * structured fields like `attemptsRemaining`, `retryAfter`, `locked`, etc.
 * Existing callers that only read `error.message` continue to work unchanged.
 */
export class ApiError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("health-auth")
        ? JSON.parse(localStorage.getItem("health-auth") || "{}")?.state?.token
        : null
      : null

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(apiUrl(path), { ...options, headers })
  // 413 / 429 / 502 / 504 may come from the platform (Vercel gateway) BEFORE
  // the route handler runs, often as a non-JSON body. Provide a clear message
  // so the UI toast is actionable instead of "Request failed (413)".
  if (
    res.status === 413 ||
    res.status === 429 ||
    res.status === 502 ||
    res.status === 504
  ) {
    const data = await res.json().catch(() => ({}))
    const fallback: Record<number, string> = {
      413: "The uploaded image is still too large after optimization. Please try a smaller or clearer photo.",
      429: "Too many requests — please wait a moment and try again.",
      502: "The server took too long to respond. Please try again.",
      504: "The server timed out. Please try again.",
    }
    const msg =
      (data && (data.error || data.message)) || fallback[res.status]
    throw new ApiError(
      typeof msg === "string" ? msg : "Request failed",
      res.status,
      data
    )
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      (data && (data.error || data.message)) || `Request failed (${res.status})`
    throw new ApiError(
      typeof msg === "string" ? msg : "Request failed",
      res.status,
      data
    )
  }
  // Defense in depth: some buggy routes might return HTTP 200 with an
  // { error: "..." } body. Treat that as a failure too so callers' catch
  // blocks fire and show the right error toast — instead of silently
  // returning a "successful" empty object that makes the UI show a false
  // "successfully added" toast.
  if (data && typeof data === "object" && "error" in data && data.error) {
    const msg =
      (data && (data.error || data.message)) || "Request failed"
    throw new ApiError(
      typeof msg === "string" ? msg : "Request failed",
      res.status,
      data
    )
  }
  return data as T
}
