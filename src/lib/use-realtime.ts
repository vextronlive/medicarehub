"use client"

import { useEffect, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"
import { useAuthStore } from "@/lib/auth-store"

export interface RealtimeEvent {
  event: string
  payload: Record<string, unknown>
}

interface UseRealtimeOptions {
  /** Called whenever any registered event arrives */
  onEvent?: (event: RealtimeEvent) => void
  /** Map of event-name -> handler */
  handlers?: Record<string, (payload: any) => void>
}

/**
 * Resolve the WebSocket origin for real-time connections.
 *
 * - In the dev sandbox: relative path "/" + "?XTransformPort=3003" (Caddy gateway routes
 *   to the notifications mini-service on port 3003).
 * - In production (deployed web or APK): uses NEXT_PUBLIC_WS_URL if set, otherwise
 *   falls back to the same-origin (deployed server handles WS natively).
 * - In an APK with a remote backend: NEXT_PUBLIC_WS_URL should be set to the deployed
 *   server's WebSocket URL (e.g. "wss://api.medicarehub.com").
 */
function getWsUrl(): string {
  // Runtime override (e.g. injected by Capacitor)
  if (typeof window !== "undefined") {
    const runtime = (window as unknown as { __WS_URL__?: string }).__WS_URL__
    if (runtime) return runtime
  }
  // Build-time env var
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL
  // Dev sandbox: use the gateway with XTransformPort
  return "/?XTransformPort=3003"
}

/**
 * Connects to the MediCare Hub notifications WebSocket service
 * and identifies the current user. Re-connects when the user changes.
 *
 * Returns the connection status and the most-recent online count.
 */
export function useRealtime(options: UseRealtimeOptions = {}) {
  const user = useAuthStore((s) => s.user)
  const [isConnected, setIsConnected] = useState(false)
  const [onlineCount, setOnlineCount] = useState<number | null>(null)
  const socketRef = useRef<Socket | null>(null)
  // Keep latest handlers in a ref so the socket listeners always see fresh values.
  // Use refs but only mutate them in effects (not during render).
  const handlersRef = useRef<Record<string, (payload: any) => void>>({})
  const onEventRef = useRef<((e: RealtimeEvent) => void) | undefined>(undefined)

  // Update handler refs whenever the options change (in an effect, not during render)
  useEffect(() => {
    handlersRef.current = options.handlers || {}
    onEventRef.current = options.onEvent
  }, [options.handlers, options.onEvent])

  useEffect(() => {
    // No user? Make sure we're disconnected. We avoid setState during render
    // by queuing it as a microtask after the early-return guard.
    if (!user) {
      const s = socketRef.current
      if (s) {
        socketRef.current = null
        s.disconnect()
      }
      // Defer state updates so they happen outside the synchronous effect body
      queueMicrotask(() => {
        setIsConnected(false)
        setOnlineCount(null)
      })
      return
    }
    // Connect — uses getWsUrl() which resolves to the sandbox gateway in dev
    // or NEXT_PUBLIC_WS_URL in production/APK builds.
    const socket = io(getWsUrl(), {
      transports: ["websocket", "polling"],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      timeout: 10000,
    })
    socketRef.current = socket

    const handleEvent = (event: string, payload: any) => {
      onEventRef.current?.({ event, payload: payload || {} })
      const h = handlersRef.current[event]
      if (h) h(payload)
    }

    // List of all real-time event types we listen to
    const EVENTS = [
      "notification:new",
      "appointment:status_changed",
      "appointment:created",
      "refill:new",
      "refill:status_changed",
      "lab_order:new",
      "lab_order:status_changed",
      "telemedicine:started",
      "telemedicine:ended",
      "record:created",
      "rating:new",
      "referral:new",
      "chat:message",
      "presence:update",
    ] as const
    for (const ev of EVENTS) {
      socket.on(ev, (p: any) => handleEvent(ev, p))
    }

    const onConnect = () => {
      setIsConnected(true)
      // Identify ourselves so the server can route targeted events to us
      socket.emit("identify", { userId: user.id, role: user.role })
    }
    const onDisconnect = () => setIsConnected(false)
    const onPresence = (data: { online?: number }) => {
      if (typeof data?.online === "number") setOnlineCount(data.online)
    }
    socket.on("connect", onConnect)
    socket.on("disconnect", onDisconnect)
    socket.on("presence:update", onPresence)

    return () => {
      socket.off("connect", onConnect)
      socket.off("disconnect", onDisconnect)
      socket.off("presence:update", onPresence)
      for (const ev of EVENTS) socket.off(ev)
      socket.disconnect()
      socketRef.current = null
    }
  }, [user?.id, user?.role])

  return { isConnected, onlineCount }
}


