"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api"
import { useAuthStore } from "@/lib/auth-store"
import { useRealtime } from "@/lib/use-realtime"
import {
  Bell,
  Calendar,
  ShieldAlert,
  FileText,
  Users,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Radio,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  timestamp: string
  severity: "info" | "warning" | "success" | "urgent"
  read: boolean
}

const SEVERITY_STYLES: Record<
  Notification["severity"],
  { dot: string; icon: typeof Info; iconBg: string }
> = {
  urgent: { dot: "bg-rose-500", icon: AlertTriangle, iconBg: "bg-rose-50 text-rose-600" },
  warning: { dot: "bg-amber-500", icon: AlertTriangle, iconBg: "bg-amber-50 text-amber-600" },
  success: { dot: "bg-emerald-500", icon: CheckCircle2, iconBg: "bg-emerald-50 text-emerald-600" },
  info: { dot: "bg-sky-500", icon: Info, iconBg: "bg-sky-50 text-sky-600" },
}

const TYPE_ICON: Record<string, typeof Bell> = {
  appointment: Calendar,
  insurance: ShieldAlert,
  record: FileText,
  referral: Users,
}

export function NotificationsBell() {
  const user = useAuthStore((s) => s.user)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [viewed, setViewed] = useState(false)
  const [liveCount, setLiveCount] = useState<number | null>(null)
  const lastFetchRef = useRef(0)

  const reload = useCallback(async () => {
    if (!user) return
    try {
      const res = await apiFetch<{ notifications: Notification[]; unreadCount: number }>(
        `/api/notifications?userId=${user.id}&role=${user.role}`
      )
      setNotifications(res.notifications || [])
      setUnreadCount(viewed ? 0 : res.unreadCount || 0)
      lastFetchRef.current = Date.now()
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [user, viewed])

  useEffect(() => {
    reload()
    const interval = setInterval(reload, 60000)
    return () => clearInterval(interval)
  }, [reload])

  // Real-time WebSocket integration
  useRealtime({
    handlers: {
      "appointment:status_changed": (p: any) => {
        toast.success(
          `Appointment ${p?.newStatus?.toLowerCase()}`,
          {
            description: `Token updated — refresh to see the latest.`,
          }
        )
        // Auto-refresh the notifications list
        reload()
      },
      "appointment:created": () => {
        reload()
      },
      "refill:status_changed": (p: any) => {
        toast.info("Refill update", {
          description: `Your refill request is now ${p?.newStatus?.toLowerCase()}.`,
        })
        reload()
      },
      "refill:new": () => {
        reload()
      },
      "lab_order:status_changed": (p: any) => {
        toast.info("Lab order update", {
          description: `Order ${p?.orderNumber} is now ${p?.newStatus?.toLowerCase()}.`,
        })
        reload()
      },
      "lab_order:new": () => {
        reload()
      },
      "chat:message": () => {
        // Don't toast — chat tab will show it. Just refresh the bell count.
        reload()
      },
      "presence:update": (p: any) => {
        if (typeof p?.online === "number") setLiveCount(p.online)
      },
    },
  })

  function handleOpenChange(o: boolean) {
    setOpen(o)
    if (o) {
      setViewed(true)
      setUnreadCount(0)
    }
  }

  const count = viewed ? 0 : unreadCount

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full hover:bg-muted"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">
              {count > 9 ? "9+" : count}
            </span>
          )}
          {count > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 animate-ping rounded-full bg-rose-400" />
          )}
          {liveCount != null && liveCount > 0 && (
            <span
              className="absolute -bottom-0.5 -left-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[8px] font-bold text-white ring-2 ring-background"
              title={`${liveCount} user${liveCount === 1 ? "" : "s"} online`}
            >
              {liveCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[calc(100vw-2rem)] max-w-sm p-0 sm:w-96"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold">Notifications</h3>
          </div>
          <div className="flex items-center gap-2">
            {liveCount != null && liveCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                <Radio className="h-2.5 w-2.5 animate-pulse" />
                {liveCount} live
              </span>
            )}
            {unreadCount > 0 && !viewed && (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600">
                {unreadCount} new
              </span>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-2.5 w-full animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-sm font-medium">You&apos;re all caught up!</p>
              <p className="text-xs text-muted-foreground">
                No new notifications right now.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const sev = SEVERITY_STYLES[n.severity]
                const SevIcon = sev.icon
                const TypeIcon = TYPE_ICON[n.type] || Bell
                return (
                  <div
                    key={n.id}
                    className="flex gap-3 px-4 py-3 transition hover:bg-muted/40"
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        sev.iconBg
                      )}
                    >
                      <TypeIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{n.title}</p>
                        <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", sev.dot)} />
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {n.message}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={() => {
                setViewed(true)
                setUnreadCount(0)
              }}
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Mark all as read
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
