"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { format, parseISO, differenceInSeconds } from "date-fns"
import {
  Siren,
  AlertTriangle,
  Heart,
  Wind,
  ArrowDown,
  Car,
  Stethoscope,
  MapPin,
  Phone,
  X,
  Check,
  Clock,
  Shield,
  Activity,
  AlertOctagon,
  Loader2,
  Navigation,
} from "lucide-react"
import { toast } from "sonner"

import { useAuthStore } from "@/lib/auth-store"
import { apiFetch } from "@/lib/api"
import {
  SectionHeader,
  EmptyState,
  StatCard,
} from "@/components/dashboard/shared/primitives"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

// ============== Types ==============
type AlertType =
  | "MEDICAL"
  | "ACCIDENT"
  | "CARDIAC"
  | "BREATHING"
  | "FALL"
  | "OTHER"

type AlertSeverity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL"

type AlertStatus = "ACTIVE" | "RESOLVED" | "CANCELLED"

interface EmergencyAlert {
  id: string
  patientId: string
  type: AlertType
  severity: AlertSeverity
  status: AlertStatus
  lat: string | null
  lng: string | null
  addressSnapshot: string | null
  description: string | null
  notifiedContacts: string | null
  resolvedAt: string | null
  createdAt: string
}

interface NotifiedContact {
  name: string
  phone?: string
  role?: string
}

interface AccountDetail {
  id: string
  name: string
  mobile: string
  bloodGroup?: string | null
  emergencyName?: string | null
  emergencyMobile?: string | null
  city?: string | null
  state?: string | null
}

// ============== Constants ==============
const TYPE_OPTIONS: {
  value: AlertType
  label: string
  icon: typeof Siren
  color: string
}[] = [
  { value: "MEDICAL", label: "Medical", icon: Stethoscope, color: "emerald" },
  { value: "ACCIDENT", label: "Accident", icon: Car, color: "amber" },
  { value: "CARDIAC", label: "Cardiac", icon: Heart, color: "rose" },
  { value: "BREATHING", label: "Breathing", icon: Wind, color: "sky" },
  { value: "FALL", label: "Fall", icon: ArrowDown, color: "violet" },
  { value: "OTHER", label: "Other", icon: AlertTriangle, color: "slate" },
]

const SEVERITY_OPTIONS: {
  value: AlertSeverity
  label: string
  color: string
}[] = [
  { value: "LOW", label: "Low", color: "slate" },
  { value: "MODERATE", label: "Moderate", color: "amber" },
  { value: "HIGH", label: "High", color: "orange" },
  { value: "CRITICAL", label: "Critical", color: "rose" },
]

const TYPE_ICON_BG: Record<string, string> = {
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  violet:
    "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400",
}

const TYPE_CARD_SELECTED_BG: Record<string, string> = {
  emerald: "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10",
  amber: "border-amber-500 bg-amber-50 dark:bg-amber-500/10",
  rose: "border-rose-500 bg-rose-50 dark:bg-rose-500/10",
  sky: "border-sky-500 bg-sky-50 dark:bg-sky-500/10",
  violet: "border-violet-500 bg-violet-50 dark:bg-violet-500/10",
  slate: "border-slate-500 bg-slate-50 dark:bg-slate-500/10",
}

const SEVERITY_BADGE: Record<AlertSeverity, string> = {
  LOW: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-700",
  MODERATE:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-900/50",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-900/50",
  CRITICAL:
    "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-900/50",
}

const STATUS_BADGE: Record<AlertStatus, string> = {
  ACTIVE:
    "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-900/50",
  RESOLVED:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-900/50",
  CANCELLED:
    "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-700",
}

// ============== Helpers ==============
function toDate(v: string | Date): Date {
  if (v instanceof Date) return v
  return parseISO(v)
}

function formatDuration(seconds: number): string {
  let s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  s -= h * 3600
  const m = Math.floor(s / 60)
  s -= m * 60
  const mm = String(m).padStart(2, "0")
  const ss = String(s).padStart(2, "0")
  if (h > 0) return `${h}h ${mm}m ${ss}s`
  return `${m}m ${ss}s`
}

function getTypeMeta(type: AlertType) {
  return TYPE_OPTIONS.find((t) => t.value === type) ?? TYPE_OPTIONS[5]
}

function parseContacts(raw: string | null): NotifiedContact[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as NotifiedContact[]
    return []
  } catch {
    return []
  }
}

// ============== Rose Hero (mirrors HeroBanner with rose/red theme) ==============
function RoseHeroBanner({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string
  subtitle: string
  icon: typeof Siren
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-600 via-rose-600 to-red-700 p-6 text-white shadow-lg shadow-rose-500/20">
      {/* Decorative circles */}
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-16 right-20 h-32 w-32 rounded-full bg-red-300/20 blur-2xl" />
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
              <Icon className="h-5 w-5" />
            </div>
          </div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            {title}
          </h1>
          <p className="mt-1 text-sm text-rose-50/90">{subtitle}</p>
        </div>
      </div>
    </div>
  )
}

// ============== SOS Button ==============
function SOSButton({
  onClick,
  disabled,
}: {
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <div className="relative mx-auto flex h-56 w-56 items-center justify-center">
      {/* Expanding ping ring (outermost) */}
      <span className="absolute inline-flex h-48 w-48 animate-ping rounded-full bg-rose-400 opacity-60" />
      {/* Pulsing outer ring */}
      <span className="absolute inline-flex h-52 w-52 animate-pulse rounded-full bg-rose-500/20 ring-4 ring-rose-500/30" />
      {/* Main button */}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label="Press to send SOS emergency alert"
        className={cn(
          "relative flex h-48 w-48 flex-col items-center justify-center gap-1 rounded-full bg-gradient-to-br from-rose-600 to-red-700 text-white shadow-2xl shadow-rose-500/40 transition-transform",
          "hover:scale-[1.03] active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-400 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-60"
        )}
      >
        <Siren className="h-10 w-10" />
        <span className="text-4xl font-black tracking-wider">SOS</span>
        <span className="text-xs font-medium opacity-90">
          Press for emergency
        </span>
      </button>
    </div>
  )
}

// ============== Active Alert Banner ==============
function ActiveAlertBanner({
  alert,
  now,
  onResolve,
  onCancel,
  resolving,
}: {
  alert: EmergencyAlert
  now: number
  onResolve: () => void
  onCancel: () => void
  resolving: boolean
}) {
  const elapsed = differenceInSeconds(now, toDate(alert.createdAt))
  const meta = getTypeMeta(alert.type)
  const Icon = meta.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative animate-pulse overflow-hidden rounded-2xl border border-rose-300 bg-rose-50 p-4 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/30"
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white shadow-md">
          <Siren className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn("border", SEVERITY_BADGE[alert.severity])}>
              <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-600" />
              ACTIVE
            </Badge>
            <span className="flex items-center gap-1.5 font-semibold text-rose-900 dark:text-rose-200">
              <Icon className="h-4 w-4" />
              {meta.label} Emergency
            </span>
            <span className="flex items-center gap-1 text-xs text-rose-700 dark:text-rose-300">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(elapsed)} elapsed
            </span>
          </div>
          {alert.description && (
            <p className="mt-1 text-sm text-rose-800 dark:text-rose-200/80">
              {alert.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            size="sm"
            onClick={onResolve}
            disabled={resolving}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {resolving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Resolve Alert
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={resolving}
            className="border-rose-300 bg-white text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-transparent dark:text-rose-300 dark:hover:bg-rose-950/40"
          >
            <X className="h-4 w-4" />
            Cancel Alert
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

// ============== Alert History Card ==============
function AlertHistoryCard({ alert }: { alert: EmergencyAlert }) {
  const meta = getTypeMeta(alert.type)
  const Icon = meta.icon
  const contacts = parseContacts(alert.notifiedContacts)
  const created = toDate(alert.createdAt)
  const resolved = alert.resolvedAt ? toDate(alert.resolvedAt) : null
  const resolutionSec = resolved
    ? Math.floor((resolved.getTime() - created.getTime()) / 1000)
    : null
  const severityLabel =
    SEVERITY_OPTIONS.find((s) => s.value === alert.severity)?.label ??
    alert.severity

  return (
    <Card className="overflow-hidden rounded-xl shadow-sm transition-all hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              TYPE_ICON_BG[meta.color]
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{meta.label}</span>
              <Badge
                variant="outline"
                className={cn("border", SEVERITY_BADGE[alert.severity])}
              >
                {severityLabel}
              </Badge>
              <Badge
                variant="outline"
                className={cn("border", STATUS_BADGE[alert.status])}
              >
                {alert.status === "ACTIVE" && (
                  <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-600" />
                )}
                {alert.status}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(created, "d MMM yyyy, h:mm a")}
              </span>
              {alert.lat && alert.lng && (
                <a
                  href={`https://www.google.com/maps?q=${alert.lat},${alert.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-rose-600 hover:underline dark:text-rose-400"
                >
                  <MapPin className="h-3 w-3" />
                  Lat {alert.lat}, Lng {alert.lng}
                </a>
              )}
              {resolutionSec !== null && (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3 w-3" />
                  Resolved in {formatDuration(resolutionSec)}
                </span>
              )}
            </div>
            {alert.description && (
              <p className="mt-2 text-sm text-foreground/80">
                {alert.description}
              </p>
            )}
            {contacts.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Notified:</span>
                {contacts.map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-xs"
                  >
                    <Phone className="h-3 w-3" />
                    {c.name}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============== Confirmation Dialog ==============
function ConfirmDialog({
  open,
  onOpenChange,
  type,
  setType,
  severity,
  setSeverity,
  description,
  setDescription,
  onSend,
  submitting,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  type: AlertType
  setType: (t: AlertType) => void
  severity: AlertSeverity
  setSeverity: (s: AlertSeverity) => void
  description: string
  setDescription: (d: string) => void
  onSend: () => void
  submitting: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b border-rose-200 bg-rose-50/50 p-6 pb-4 dark:border-rose-900/40 dark:bg-rose-950/20">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertOctagon className="h-5 w-5 text-rose-600" />
            Confirm Emergency Alert
          </DialogTitle>
          <DialogDescription className="text-sm">
            Select the type and severity of your emergency. Your location and
            contacts will be shared.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          {/* Type */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Emergency Type
            </Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const selected = type === opt.value
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setType(opt.value)}
                    aria-pressed={selected}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all",
                      selected
                        ? TYPE_CARD_SELECTED_BG[opt.color]
                        : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/40"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full",
                        TYPE_ICON_BG[opt.color]
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Severity */}
          <div className="mt-5 space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Severity
            </Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SEVERITY_OPTIONS.map((opt) => {
                const selected = severity === opt.value
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setSeverity(opt.value)}
                    aria-pressed={selected}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-all",
                      selected
                        ? TYPE_CARD_SELECTED_BG[opt.color]
                        : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/40"
                    )}
                  >
                    {opt.value === "CRITICAL" && selected && (
                      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-600" />
                    )}
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Description */}
          <div className="mt-5 space-y-2">
            <Label
              htmlFor="sos-desc"
              className="flex items-center gap-1.5 text-xs font-medium"
            >
              <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
              Description <span className="text-muted-foreground">· optional</span>
            </Label>
            <Textarea
              id="sos-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe what's happening (e.g. chest pain, severe bleeding, difficulty breathing)."
              className="min-h-[80px] resize-y rounded-lg"
            />
          </div>
        </div>

        <DialogFooter className="border-t p-6 pt-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={onSend}
            disabled={submitting}
            className="bg-rose-600 text-white shadow-sm hover:bg-rose-700"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Siren className="h-4 w-4" />
                Send SOS Alert
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============== Main Component ==============
export function EmergencySOS() {
  const user = useAuthStore((s) => s.user)
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([])
  const [account, setAccount] = useState<AccountDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  // dialog form state
  const [type, setType] = useState<AlertType>("MEDICAL")
  const [severity, setSeverity] = useState<AlertSeverity>("HIGH")
  const [description, setDescription] = useState("")

  // live "now" for elapsed time on active alerts
  const [now, setNow] = useState<number>(() => Date.now())

  const loadAlerts = useCallback(async () => {
    if (!user) return
    try {
      const res = await apiFetch<{ alerts: EmergencyAlert[] }>(
        `/api/emergency?patientId=${encodeURIComponent(user.id)}`
      )
      setAlerts(res.alerts ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load alerts.")
    } finally {
      setLoading(false)
    }
  }, [user])

  const loadAccount = useCallback(async () => {
    if (!user) return
    try {
      const res = await apiFetch<{ account: AccountDetail }>(
        `/api/account?id=${encodeURIComponent(user.id)}`
      )
      setAccount(res.account)
    } catch {
      // Non-fatal — emergency contact card will simply show "not set".
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    setLoading(true)
    void loadAlerts()
    void loadAccount()
  }, [user, loadAlerts, loadAccount])

  // Tick every second while there is at least one active alert.
  const hasActive = alerts.some((a) => a.status === "ACTIVE")
  useEffect(() => {
    if (!hasActive) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [hasActive])

  const stats = useMemo(() => {
    const total = alerts.length
    const active = alerts.filter((a) => a.status === "ACTIVE").length
    const resolved = alerts.filter((a) => a.status === "RESOLVED").length
    const counts: Record<string, number> = {}
    for (const a of alerts) counts[a.type] = (counts[a.type] ?? 0) + 1
    let mostCommon: AlertType | null = null
    let max = 0
    for (const a of alerts) {
      if (counts[a.type] > max) {
        max = counts[a.type]
        mostCommon = a.type
      }
    }
    return { total, active, resolved, mostCommon }
  }, [alerts])

  const activeAlerts = useMemo(
    () => alerts.filter((a) => a.status === "ACTIVE"),
    [alerts]
  )

  const handleSend = useCallback(async () => {
    if (!user) return
    setSubmitting(true)
    try {
      // Try to capture GPS location; proceed without it if denied or unavailable.
      let lat: number | null = null
      let lng: number | null = null
      let addressSnapshot: string | null = null

      try {
        const pos = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            if (
              typeof navigator === "undefined" ||
              !navigator.geolocation
            ) {
              reject(new Error("Geolocation unavailable"))
              return
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 8000,
              maximumAge: 60000,
              enableHighAccuracy: false,
            })
          }
        )
        lat = pos.coords.latitude
        lng = pos.coords.longitude
        addressSnapshot = `${lat.toFixed(6)},${lng.toFixed(6)}`
      } catch {
        toast.info("Proceeding without GPS location.")
      }

      const notifiedContacts: NotifiedContact[] = []
      if (account?.emergencyName || account?.emergencyMobile) {
        notifiedContacts.push({
          name: account?.emergencyName || "Emergency Contact",
          phone: account?.emergencyMobile || "",
          role: "Emergency Contact",
        })
      }
      notifiedContacts.push({ name: "Primary Doctor", phone: "" })

      const res = await apiFetch<{ alert: EmergencyAlert }>("/api/emergency", {
        method: "POST",
        body: JSON.stringify({
          patientId: user.id,
          type,
          severity,
          lat,
          lng,
          addressSnapshot,
          description: description.trim() || undefined,
          notifiedContacts,
        }),
      })

      // Nuclear fix: the POST response IS the canonical record.
      // Gate the toast + state update on the response payload so we
      // never show a false "alert sent" toast. Do NOT fire an un-awaited
      // background refetch — Supabase pooler read-after-write lag can
      // cause the refetch to return a list WITHOUT the new alert,
      // which would wholesale-replace state and silently wipe it.
      if (!res?.alert) {
        throw new Error("Server confirmed the save but did not return the record.")
      }
      setAlerts((prev) => [res.alert, ...prev])
      toast.success("🚨 Emergency alert sent. Your contacts have been notified.")
      setDialogOpen(false)
      setDescription("")
      setType("MEDICAL")
      setSeverity("HIGH")
      setNow(Date.now())
      // No background refetch — the POST response above is the source of truth.
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send alert.")
    } finally {
      setSubmitting(false)
    }
  }, [user, account, type, severity, description])

  const handleResolve = useCallback(
    async (id: string, status: AlertStatus) => {
      setResolvingId(id)
      try {
        const res = await apiFetch<{ alert: EmergencyAlert }>("/api/emergency", {
          method: "PATCH",
          body: JSON.stringify({ id, status }),
        })
        // Nuclear fix: the PATCH response IS the canonical record.
        // Gate the toast + state update on the response payload so we
        // never show a false "resolved/cancelled" toast. Do NOT fire an
        // un-awaited background refetch — Supabase pooler read-after-write
        // lag can cause the refetch to return stale data, which would
        // wholesale-replace state and silently wipe the optimistic update.
        if (!res?.alert) {
          throw new Error("Server confirmed the update but did not return the record.")
        }
        setAlerts((prev) => prev.map((a) => (a.id === id ? res.alert : a)))
        toast.success(
          status === "RESOLVED"
            ? "Alert marked as resolved."
            : "Alert cancelled."
        )
        // No background refetch — the PATCH response above is the source of truth.
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update alert.")
      } finally {
        setResolvingId(null)
      }
    },
    []
  )

  if (!user) return null

  const mostCommonLabel =
    stats.mostCommon === null
      ? "—"
      : (TYPE_OPTIONS.find((t) => t.value === stats.mostCommon)?.label ?? "—")

  return (
    <div className="space-y-6">
      {/* Hero (rose/red override of the default emerald HeroBanner) */}
      <RoseHeroBanner
        title="Emergency SOS"
        subtitle="One tap to alert your contacts and share your location"
        icon={Siren}
      />

      {/* Active alert banner */}
      {activeAlerts.length > 0 && (
        <div className="space-y-2">
          {activeAlerts.map((a) => (
            <ActiveAlertBanner
              key={a.id}
              alert={a}
              now={now}
              onResolve={() => handleResolve(a.id, "RESOLVED")}
              onCancel={() => handleResolve(a.id, "CANCELLED")}
              resolving={resolvingId === a.id}
            />
          ))}
        </div>
      )}

      {/* SOS button */}
      <Card className="overflow-hidden rounded-2xl shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 p-8">
          <div className="text-center">
            <h2 className="text-lg font-semibold tracking-tight">
              Need help now?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Press the SOS button to alert your emergency contacts with your
              live location.
            </p>
          </div>
          <SOSButton
            onClick={() => setDialogOpen(true)}
            disabled={submitting}
          />
          <p className="text-xs text-muted-foreground">
            <Shield className="mr-1 inline h-3.5 w-3.5" />
            Use only in genuine emergencies. False alerts may be reviewed.
          </p>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              title="Total Alerts"
              value={stats.total}
              icon={Activity}
              color="bg-rose-50 text-rose-600 dark:bg-rose-500/10"
              accent="from-rose-500 to-red-500"
            />
            <StatCard
              title="Active Now"
              value={stats.active}
              icon={Siren}
              color="bg-orange-50 text-orange-600 dark:bg-orange-500/10"
              accent="from-orange-500 to-rose-500"
            />
            <StatCard
              title="Resolved"
              value={stats.resolved}
              icon={Check}
              color="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
              accent="from-emerald-500 to-teal-500"
            />
            <StatCard
              title="Most Common Type"
              value={mostCommonLabel}
              icon={AlertTriangle}
              color="bg-amber-50 text-amber-600 dark:bg-amber-500/10"
              accent="from-amber-500 to-orange-500"
            />
          </>
        )}
      </div>

      {/* History */}
      <div>
        <SectionHeader
          title="Alert History"
          description="A timeline of your past emergency alerts, most recent first."
          icon={Clock}
        />
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <EmptyState
            icon={Siren}
            title="No alerts yet"
            description="When you trigger an SOS, your alert history will appear here with location, contacts, and resolution time."
          />
        ) : (
          <div className="relative max-h-[480px] space-y-3 overflow-y-auto pr-1">
            {alerts.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.25,
                  delay: Math.min(i * 0.04, 0.4),
                }}
              >
                <AlertHistoryCard alert={a} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Emergency contacts + nearest hospitals */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden rounded-xl shadow-sm transition-all hover:shadow-md">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Phone className="h-4 w-4 text-rose-600" />
              Emergency Contact
            </CardTitle>
            <CardDescription className="text-xs">
              This contact will be notified when you trigger an SOS.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            {account?.emergencyName || account?.emergencyMobile ? (
              <div className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-600 text-white">
                  <Phone className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {account?.emergencyName || "Emergency Contact"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {account?.emergencyMobile || "—"}
                  </p>
                </div>
                {account?.emergencyMobile && (
                  <Button
                    asChild
                    size="sm"
                    className="bg-rose-600 text-white hover:bg-rose-700"
                  >
                    <a href={`tel:${account.emergencyMobile}`}>
                      <Phone className="h-4 w-4" />
                      Quick Dial
                    </a>
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                No emergency contact set. Update your profile to add one.
              </div>
            )}

            {(account?.bloodGroup || user.bloodGroup) && (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400">
                  <Heart className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Blood Group
                  </p>
                  <p className="text-sm font-semibold">
                    {account?.bloodGroup || user.bloodGroup}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-xl shadow-sm transition-all hover:shadow-md">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Navigation className="h-4 w-4 text-rose-600" />
              Nearest Hospitals
            </CardTitle>
            <CardDescription className="text-xs">
              Quick reference in case of a medical emergency.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white">
                  <Siren className="h-4 w-4" />
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-rose-900 dark:text-rose-200">
                    Dial 112 — India National Emergency Number
                  </p>
                  <p className="mt-1 text-rose-800/80 dark:text-rose-200/70">
                    In case of emergency, dial{" "}
                    <strong>112</strong> (India national emergency number) or
                    your nearest hospital.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href="tel:112"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-2.5 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 dark:border-rose-900/40 dark:bg-transparent dark:text-rose-300 dark:hover:bg-rose-950/30"
              >
                <Phone className="h-4 w-4" />
                Call 112
              </a>
              <a
                href="tel:108"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-2.5 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 dark:border-rose-900/40 dark:bg-transparent dark:text-rose-300 dark:hover:bg-rose-950/30"
              >
                <AlertOctagon className="h-4 w-4" />
                Ambulance 108
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        type={type}
        setType={setType}
        severity={severity}
        setSeverity={setSeverity}
        description={description}
        setDescription={setDescription}
        onSend={handleSend}
        submitting={submitting}
      />
    </div>
  )
}

export default EmergencySOS
