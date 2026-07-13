import "server-only"

/**
 * Server-side helper to emit real-time events to the WebSocket mini-service.
 * Falls back silently if the service is unreachable (so the app keeps working
 * even if the WS service is down).
 */

const WS_SERVICE_URL =
  process.env.WS_SERVICE_URL || "http://127.0.0.1:3003"

type EmitTarget =
  | { type: "user"; id: string }
  | { type: "role"; id: string }
  | { type: "global" }

interface EmitOptions {
  event: string
  payload?: Record<string, unknown>
  target: EmitTarget
}

/**
 * Fire-and-forget emit.  Returns true on success, false on failure (silently).
 */
export async function emitToWS({
  event,
  payload,
  target,
}: EmitOptions): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(`${WS_SERVICE_URL}/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, payload, target }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) return false
    const data = (await res.json()) as { ok?: boolean }
    return Boolean(data?.ok)
  } catch {
    // Service down or unreachable — non-fatal
    return false
  }
}

/** Notify a single user (targeted). */
export function notifyUser(
  userId: string,
  event: string,
  payload: Record<string, unknown>
) {
  return emitToWS({ event, payload, target: { type: "user", id: userId } })
}

/** Notify all users of a given role. */
export function notifyRole(
  role: "PATIENT" | "DOCTOR" | "ORGANIZATION",
  event: string,
  payload: Record<string, unknown>
) {
  return emitToWS({ event, payload, target: { type: "role", id: role } })
}

/** Broadcast to everyone. */
export function broadcast(
  event: string,
  payload: Record<string, unknown>
) {
  return emitToWS({ event, payload, target: { type: "global" } })
}
