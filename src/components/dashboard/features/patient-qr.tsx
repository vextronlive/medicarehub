"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { format, parseISO, differenceInSeconds, differenceInHours } from "date-fns"
import QRCode from "qrcode"
import {
  QrCode,
  ScanLine,
  History,
  ShieldCheck,
  Lock,
  RefreshCw,
  Download,
  Ambulance,
  Clock,
  Stethoscope,
  FileText,
  UserCheck,
  AlertCircle,
  Heart,
  Droplet,
  Phone,
  MapPin,
  Calendar,
  Loader2,
  Copy,
  CheckCircle2,
  Camera,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { useAuthStore } from "@/lib/auth-store"
import { apiFetch, ApiError } from "@/lib/api"
import {
  HeroBanner,
  SectionHeader,
  EmptyState,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

// ============== Types ==============
type QrPurpose = "CHECKIN" | "RECORD_ACCESS" | "EMERGENCY"

interface QrResponse {
  ok: boolean
  qrId: string
  payload: string
  hash: string
  expiresAt: string
  qrData: string
  purpose: QrPurpose
}

interface ScanRecord {
  id: string
  visitType: string | null
  visitDate: string | null
  doctorName: string | null
}

interface ScanPatient {
  id: string
  name: string
  mobile: string | null
  email: string | null
  bloodGroup: string | null
  gender: string | null
  dateOfBirth: string | null
  addressLine: string | null
  city: string | null
  state: string | null
  pincode: string | null
  emergencyName: string | null
  emergencyMobile: string | null
  insurance: {
    provider: string | null
    policy: string | null
    type: string | null
    covered: number | null
  } | null
}

interface ScanResponse {
  ok: boolean
  scanner?: { id: string; role: string; name: string }
  patient?: ScanPatient
  recentRecords?: ScanRecord[]
  qrSummary?: Record<string, unknown>
  summary?: Record<string, unknown>
}

// ============== Purpose Metadata ==============
const PURPOSE_META: Record<
  QrPurpose,
  {
    label: string
    icon: typeof QrCode
    description: string
    accent: string
    ring: string
    iconBg: string
    badge: string
    heroAccent?: string
  }
> = {
  CHECKIN: {
    label: "Check-In",
    icon: Stethoscope,
    description: "Show at the reception desk for fast check-in.",
    accent: "from-emerald-500 to-teal-500",
    ring: "from-emerald-400 via-emerald-500 to-teal-500",
    iconBg:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    badge:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-900/50",
  },
  RECORD_ACCESS: {
    label: "Record Access",
    icon: FileText,
    description: "Show to your doctor to grant record access during a visit.",
    accent: "from-teal-500 to-cyan-500",
    ring: "from-teal-400 via-teal-500 to-cyan-500",
    iconBg:
      "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
    badge:
      "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-400 dark:border-teal-900/50",
  },
  EMERGENCY: {
    label: "Emergency",
    icon: Ambulance,
    description: "Show this in emergencies — unlocks critical info instantly.",
    accent: "from-rose-500 to-red-600",
    ring: "from-rose-400 via-rose-500 to-red-500",
    iconBg: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
    badge:
      "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-900/50",
  },
}

// ============== Helpers ==============
function toDate(v: string | Date): Date {
  if (v instanceof Date) return v
  return parseISO(v)
}

function useCountdown(expiresAt: string | null) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!expiresAt) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  if (!expiresAt) return { h: 0, m: 0, s: 0, expired: true, label: "—" }
  const diff = differenceInSeconds(toDate(expiresAt), new Date())
  if (diff <= 0) return { h: 0, m: 0, s: 0, expired: true, label: "Expired" }
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60
  const label = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return { h, m, s, expired: false, label }
}

function truncateHash(hash: string, max = 16): string {
  if (!hash) return ""
  if (hash.length <= max) return hash
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`
}

// ============== QR Display Card (single purpose) ==============
function QrDisplayCard({
  purpose,
  patientId,
  initial,
}: {
  purpose: QrPurpose
  patientId: string
  initial: QrResponse | null
}) {
  const meta = PURPOSE_META[purpose]
  const Icon = meta.icon
  const [qr, setQr] = useState<QrResponse | null>(initial)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(!initial)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const { label: countdownLabel, expired } = useCountdown(qr?.expiresAt ?? null)

  const fetchQr = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch<QrResponse>(
        `/api/qr/patient?patientId=${encodeURIComponent(patientId)}&purpose=${purpose}`
      )
      setQr(res)
    } catch (e) {
      toast.error((e as Error).message || "Failed to load QR")
    } finally {
      setLoading(false)
    }
  }, [patientId, purpose])

  useEffect(() => {
    if (!initial) fetchQr()
  }, [initial, fetchQr])

  // Generate QR image from qrData
  useEffect(() => {
    if (!qr?.qrData) {
      setDataUrl(null)
      return
    }
    let cancelled = false
    QRCode.toDataURL(qr.qrData, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: purpose === "EMERGENCY" ? "#9f1239" : "#0f172a",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Failed to render QR image")
          setDataUrl(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [qr?.qrData, purpose])

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const res = await apiFetch<QrResponse>(`/api/qr/patient`, {
        method: "POST",
        body: JSON.stringify({ patientId, purpose }),
      })
      setQr(res)
      toast.success(`${meta.label} QR regenerated`)
    } catch (e) {
      toast.error((e as Error).message || "Failed to regenerate QR")
    } finally {
      setRegenerating(false)
    }
  }

  const handleDownload = () => {
    if (!dataUrl) {
      toast.error("QR image not ready yet")
      return
    }
    const a = document.createElement("a")
    a.href = dataUrl
    a.download = `medicare-qr-${purpose.toLowerCase()}-${Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success("QR PNG downloaded")
  }

  const handleCopyHash = async () => {
    if (!qr?.hash) return
    try {
      await navigator.clipboard.writeText(qr.hash)
      setCopied(true)
      toast.success("Payload hash copied")
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error("Clipboard unavailable")
    }
  }

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-1 h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="mx-auto h-64 w-64 rounded-xl" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!qr) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="QR unavailable"
        description="We could not generate this QR code. Try again."
        action={
          <Button onClick={fetchQr} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Retry
          </Button>
        }
      />
    )
  }

  const isEmergency = purpose === "EMERGENCY"

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card
        className={cn(
          "relative overflow-hidden",
          isEmergency &&
            "border-rose-200 shadow-lg shadow-rose-500/10 dark:border-rose-900/50"
        )}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/5",
                  meta.iconBg
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base">{meta.label} QR</CardTitle>
                <CardDescription className="mt-0.5 text-xs">
                  {meta.description}
                </CardDescription>
              </div>
            </div>
            {expired ? (
              <Badge
                variant="outline"
                className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-900/50"
              >
                <Clock className="mr-1 h-3 w-3" />
                Expired
              </Badge>
            ) : (
              <Badge className={cn("border", meta.badge)}>
                <Clock className="mr-1 h-3 w-3" />
                {countdownLabel}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* QR image with gradient ring */}
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="relative">
              {/* Emerald/teal (or rose for emergency) gradient ring */}
              <div
                className={cn(
                  "rounded-3xl bg-gradient-to-br p-[3px] shadow-lg",
                  meta.accent,
                  isEmergency ? "shadow-rose-500/20" : "shadow-emerald-500/20"
                )}
              >
                <div className="rounded-[1.35rem] bg-white p-4 dark:bg-white">
                  {dataUrl ? (
                    <img
                      src={dataUrl}
                      alt={`${meta.label} QR code`}
                      width={256}
                      height={256}
                      className="h-64 w-64"
                    />
                  ) : (
                    <div className="flex h-64 w-64 items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
              {/* Decorative corner pulse */}
              <motion.span
                className={cn(
                  "absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full text-white shadow-md",
                  isEmergency ? "bg-rose-600" : "bg-emerald-600"
                )}
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              >
                <Lock className="h-3 w-3" />
              </motion.span>
            </div>

            {isEmergency && (
              <div className="flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-900/50">
                <Ambulance className="h-3.5 w-3.5" />
                Show this in emergencies — first responders can scan it.
              </div>
            )}
          </div>

          {/* Encrypted payload hash */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Payload hash
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyHash}
                className="h-7 px-2 text-[11px]"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-3 w-3" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <p className="mt-1.5 truncate font-mono text-[11px] text-foreground/80">
              {truncateHash(qr.hash, 24)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-900/50"
              >
                <Lock className="mr-1 h-2.5 w-2.5" />
                AES-256-CBC encrypted
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                Only doctors can decrypt
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleRegenerate}
              disabled={regenerating}
              variant="outline"
              className="w-full"
            >
              {regenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Regenerate
            </Button>
            <Button
              onClick={handleDownload}
              disabled={!dataUrl}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
            >
              <Download className="mr-2 h-4 w-4" />
              Download PNG
            </Button>
          </div>

          {/* Helper footer */}
          <div className="flex items-start gap-2 rounded-md bg-emerald-50/60 p-2.5 text-[11px] text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200/90">
            <Stethoscope className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Doctors scan this QR via their dashboard to instantly access your
              encrypted health summary. Patients scanning themselves see a
              redacted self-view only.
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============== Patient Summary Display (doctor scan result) ==============
function PatientSummaryCard({ data }: { data: ScanResponse }) {
  const patient = data.patient
  if (!patient) {
    // Redacted self-view
    const summary = (data.summary || {}) as {
      name?: string
      bloodGroup?: string
      purpose?: string
      message?: string
      generatedAt?: string
    }
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-500/10"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            Self-view (redacted)
          </p>
        </div>
        <p className="mt-1 text-sm text-amber-800 dark:text-amber-200/90">
          {summary.message ||
            "You scanned your own QR. Doctors see the full summary; you see only this redacted view."}
        </p>
        {summary.generatedAt && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300/80">
            Generated: {format(toDate(summary.generatedAt), "PPpp")}
          </p>
        )}
      </motion.div>
    )
  }

  const records = data.recentRecords || []
  const age = patient.dateOfBirth
    ? new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Verified banner */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-500/10">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-emerald-900 dark:text-emerald-200">
              Verified Patient
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300/80">
              Decrypted by{" "}
              {data.scanner?.name || "doctor"} ·{" "}
              {format(new Date(), "PPpp")}
            </p>
          </div>
        </div>
        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
          <ShieldCheck className="mr-1 h-3 w-3" />
          Access granted
        </Badge>
      </div>

      {/* Patient header */}
      <Card className="overflow-hidden">
        <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-600 p-5 text-white">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-xl font-bold backdrop-blur-sm">
              {patient.name?.slice(0, 1)?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold leading-tight">
                {patient.name}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-emerald-50/90">
                {age && <span>{age} yrs</span>}
                {patient.gender && (
                  <span className="capitalize">{patient.gender}</span>
                )}
                {patient.bloodGroup && (
                  <span className="flex items-center gap-1">
                    <Droplet className="h-3 w-3" />
                    {patient.bloodGroup}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <DetailRow
            icon={Phone}
            label="Mobile"
            value={patient.mobile || "—"}
          />
          <DetailRow
            icon={Heart}
            label="Emergency Contact"
            value={
              patient.emergencyName
                ? `${patient.emergencyName}${patient.emergencyMobile ? ` · ${patient.emergencyMobile}` : ""}`
                : "—"
            }
          />
          <DetailRow
            icon={MapPin}
            label="Address"
            value={
              [patient.addressLine, patient.city, patient.state, patient.pincode]
                .filter(Boolean)
                .join(", ") || "—"
            }
            full
          />
        </CardContent>
      </Card>

      {/* Insurance */}
      {patient.insurance && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Insurance
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <InfoTile label="Provider" value={patient.insurance.provider || "—"} />
            <InfoTile label="Policy" value={patient.insurance.policy || "—"} />
            <InfoTile label="Type" value={patient.insurance.type || "—"} />
            <InfoTile
              label="Covered"
              value={
                patient.insurance.covered
                  ? `₹${Number(patient.insurance.covered).toLocaleString("en-IN")}`
                  : "—"
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Recent records */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Recent Medical Records
          </CardTitle>
          <CardDescription className="text-xs">
            Last {records.length} visits
          </CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No medical records yet.
            </p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {records.map((r, i) => (
                <li
                  key={r.id || i}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-2.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {r.visitType || "Visit"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.doctorName ? `Dr. ${r.doctorName}` : "Unknown doctor"}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {r.visitDate
                      ? format(toDate(r.visitDate), "MMM d, yyyy")
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
  full,
}: {
  icon: typeof Phone
  label: string
  value: string
  full?: boolean
}) {
  return (
    <div className={cn("flex items-start gap-2.5", full && "sm:col-span-2")}>
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium">{value}</p>
    </div>
  )
}

// ============== Scan Tab (doctor only) ==============
function ScanTab({ scannerId }: { scannerId: string }) {
  const [payload, setPayload] = useState("")
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [autoScanning, setAutoScanning] = useState(false)
  const autoScanningRef = useRef(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const scanLoopRef = useRef<number | null>(null)

  const stopCamera = useCallback(() => {
    setCameraOpen(false)
    setAutoScanning(false)
    autoScanningRef.current = false
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current)
      scanLoopRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  // QR decoding loop — captures video frames and decodes with jsQR
  const startScanLoop = useCallback(() => {
    setAutoScanning(true)
    autoScanningRef.current = true
    const loop = () => {
      if (!autoScanningRef.current) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        scanLoopRef.current = requestAnimationFrame(loop)
        return
      }
      const w = video.videoWidth
      const h = video.videoHeight
      if (w === 0 || h === 0) {
        scanLoopRef.current = requestAnimationFrame(loop)
        return
      }
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) {
        scanLoopRef.current = requestAnimationFrame(loop)
        return
      }
      ctx.drawImage(video, 0, 0, w, h)
      try {
        const imgData = ctx.getImageData(0, 0, w, h)
        // jsQR is dynamically imported to keep the bundle small
        import("jsqr").then((mod) => {
          if (!autoScanningRef.current) return
          const code = mod.default(imgData.data, w, h, {
            inversionAttempts: "dontInvert",
          })
          if (code && code.data) {
            // QR found! Set payload and stop scanning
            setPayload(code.data)
            autoScanningRef.current = false
            setAutoScanning(false)
            toast.success("QR code detected! Click 'Decrypt & View Patient' to continue.")
            return
          }
          scanLoopRef.current = requestAnimationFrame(loop)
        }).catch(() => {
          if (autoScanningRef.current) {
            scanLoopRef.current = requestAnimationFrame(loop)
          }
        })
      } catch {
        scanLoopRef.current = requestAnimationFrame(loop)
      }
    }
    scanLoopRef.current = requestAnimationFrame(loop)
  }, [])

  const openCamera = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      streamRef.current = stream
      setCameraOpen(true)
      // Wait for next tick so the video element is mounted
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().then(() => {
            // Start the QR decoding loop once video is playing
            startScanLoop()
          }).catch(() => {})
        }
      }, 100)
      toast.info(
        "Camera opened — point at a patient QR code. It will be detected automatically."
      )
    } catch {
      setError(
        "Camera unavailable. Paste the encrypted payload manually instead."
      )
      toast.error("Could not access camera")
    }
  }

  const handleScan = async () => {
    if (!payload.trim()) {
      toast.error("Paste the encrypted QR payload first")
      return
    }
    setScanning(true)
    setError(null)
    setResult(null)
    try {
      const res = await apiFetch<ScanResponse>(`/api/qr/scan`, {
        method: "POST",
        body: JSON.stringify({ payload: payload.trim(), scannerId }),
      })
      setResult(res)
      toast.success("Patient decrypted")
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setError(
          "Access denied — only doctors can decrypt patient QRs. Patients scanning their own QR see a redacted view."
        )
      } else {
        setError((e as Error).message || "Failed to decrypt QR")
      }
      toast.error("Decryption failed")
    } finally {
      setScanning(false)
    }
  }

  const handleClear = () => {
    setPayload("")
    setResult(null)
    setError(null)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScanLine className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Decrypt Patient QR
          </CardTitle>
          <CardDescription className="text-xs">
            Open the camera and point it at a patient&apos;s QR code — it will
            be detected automatically. Or paste the encrypted payload manually.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="qr-payload" className="text-xs">
              Encrypted payload
            </Label>
            <Textarea
              id="qr-payload"
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              placeholder="Point camera at a QR code, or paste the encrypted string here…"
              className="min-h-[110px] resize-y font-mono text-xs"
            />
          </div>

          {/* Hidden canvas for QR frame capture */}
          <canvas ref={canvasRef} className="hidden" />

          <AnimatePresence>
            {cameraOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="relative rounded-xl border border-emerald-200 bg-black p-2 dark:border-emerald-900/50">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="aspect-video w-full rounded-lg object-cover"
                  />
                  {/* Scanning overlay */}
                  <div className="absolute inset-0 m-3 overflow-hidden rounded-lg border-2 border-dashed border-white/60">
                    {autoScanning && (
                      <motion.div
                        className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]"
                        animate={{ top: ["0%", "100%", "0%"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                  </div>
                  {autoScanning && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600/90 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
                      Scanning for QR code…
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={stopCamera}
                    className="absolute right-3 top-3"
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Stop
                  </Button>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {autoScanning
                    ? "Point the camera at a patient's QR code — detection is automatic."
                    : "Camera ready."}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-500/10 dark:text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleScan}
              disabled={scanning || !payload.trim()}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
            >
              {scanning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ScanLine className="mr-2 h-4 w-4" />
              )}
              Decrypt &amp; View Patient
            </Button>
            {!cameraOpen ? (
              <Button onClick={openCamera} variant="outline" size="sm">
                <Camera className="mr-2 h-4 w-4" />
                Open Camera Scanner
              </Button>
            ) : null}
            {(payload || result) && (
              <Button onClick={handleClear} variant="ghost" size="sm">
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <PatientSummaryCard data={result} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============== History Tab ==============
interface HistoryEntry {
  id: string
  purpose: QrPurpose
  isActive: boolean
  expiresAt: string
  createdAt?: string
  payloadHash: string
}

function HistoryTab({ patientId }: { patientId: string }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activePurpose, setActivePurpose] = useState<QrPurpose>("CHECKIN")
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    // We fetch each purpose's current QR via GET, then assemble a history.
    const purposes: QrPurpose[] = ["CHECKIN", "RECORD_ACCESS", "EMERGENCY"]
    try {
      const results = await Promise.all(
        purposes.map((p) =>
          apiFetch<QrResponse>(
            `/api/qr/patient?patientId=${encodeURIComponent(patientId)}&purpose=${p}`
          ).catch(() => null)
        )
      )
      const list: HistoryEntry[] = results
        .filter(Boolean)
        .map((r) => ({
          id: r!.qrId,
          purpose: r!.purpose,
          isActive: true,
          expiresAt: r!.expiresAt,
          payloadHash: r!.hash,
        }))
      setEntries(list)
    } catch (e) {
      setError((e as Error).message || "Failed to load history")
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          QR History
        </CardTitle>
        <CardDescription className="text-xs">
          Current active QR codes per purpose. Each QR rotates the previous
          one; only one QR per purpose is active at a time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={AlertCircle}
            title="Could not load history"
            description={error}
            action={
              <Button onClick={load} size="sm" variant="outline">
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Retry
              </Button>
            }
          />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={History}
            title="No QR codes yet"
            description="Generate a QR from the My QR Codes tab — it will appear here."
          />
        ) : (
          <ul className="space-y-2">
            {entries.map((e, i) => {
              const meta = PURPOSE_META[e.purpose]
              const Icon = meta.icon
              const expired = differenceInHours(
                toDate(e.expiresAt),
                new Date()
              ) <= 0
              return (
                <motion.li
                  key={e.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3",
                    e.purpose === "EMERGENCY" &&
                      "border-rose-200 dark:border-rose-900/40"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      meta.iconBg
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{meta.label}</p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {truncateHash(e.payloadHash, 28)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Expires{" "}
                      {format(toDate(e.expiresAt), "MMM d, HH:mm")}
                    </span>
                    <Badge
                      className={cn(
                        "border",
                        expired
                          ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-900/50"
                          : meta.badge
                      )}
                    >
                      {expired ? "Expired" : "Active"}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setActivePurpose(e.purpose)}
                    className="text-[11px]"
                  >
                    View QR
                  </Button>
                </motion.li>
              )
            })}
          </ul>
        )}
        {!loading && entries.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Quick preview
            </p>
            <Select
              value={activePurpose}
              onValueChange={(v) => setActivePurpose(v as QrPurpose)}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {entries.map((e) => (
                  <SelectItem key={e.purpose} value={e.purpose}>
                    {PURPOSE_META[e.purpose].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mt-3">
              <QrDisplayCard
                purpose={activePurpose}
                patientId={patientId}
                initial={null}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============== Main Component ==============
export function PatientQr() {
  const user = useAuthStore((s) => s.user)
  const isDoctor =
    user?.role === "DOCTOR" || user?.role === "ORGANIZATION"
  const [purposeTab, setPurposeTab] = useState<QrPurpose>("CHECKIN")
  const [qrCache, setQrCache] = useState<Record<QrPurpose, QrResponse | null>>({
    CHECKIN: null,
    RECORD_ACCESS: null,
    EMERGENCY: null,
  })
  const [loadingCache, setLoadingCache] = useState(true)

  // Preload all 3 QRs for the patient (so the purpose tabs switch instantly)
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    Promise.all(
      (["CHECKIN", "RECORD_ACCESS", "EMERGENCY"] as QrPurpose[]).map((p) =>
        apiFetch<QrResponse>(
          `/api/qr/patient?patientId=${encodeURIComponent(user.id)}&purpose=${p}`
        ).catch(() => null)
      )
    )
      .then((results) => {
        if (cancelled) return
        setQrCache({
          CHECKIN: results[0],
          RECORD_ACCESS: results[1],
          EMERGENCY: results[2],
        })
      })
      .finally(() => {
        if (!cancelled) setLoadingCache(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  if (!user) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Sign in required"
        description="You must be signed in to manage QR codes."
      />
    )
  }

  const visiblePurposes: QrPurpose[] = [
    "CHECKIN",
    "RECORD_ACCESS",
    "EMERGENCY",
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <HeroBanner
        title="Patient QR Codes"
        subtitle="Encrypted, doctor-only access to your health summary — for check-in, record access, and emergencies."
        icon={QrCode}
      />

      <Tabs defaultValue="my-qr" className="w-full">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="my-qr" className="gap-1.5">
            <QrCode className="h-4 w-4" />
            My QR Codes
          </TabsTrigger>
          {isDoctor && (
            <TabsTrigger value="scan" className="gap-1.5">
              <ScanLine className="h-4 w-4" />
              Scan Patient QR
            </TabsTrigger>
          )}
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* My QR Codes */}
        <TabsContent value="my-qr" className="mt-4 space-y-4">
          <SectionHeader
            title="Your QR Codes"
            description="Three encrypted QR codes — each unlocks a different level of access. Doctors scan them via their dashboard."
            icon={ShieldCheck}
          />

          {loadingCache ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="mt-1 h-4 w-48" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Skeleton className="mx-auto h-64 w-64 rounded-xl" />
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              <Tabs value={purposeTab} onValueChange={(v) => setPurposeTab(v as QrPurpose)}>
                <TabsList className="flex-wrap">
                  {visiblePurposes.map((p) => {
                    const meta = PURPOSE_META[p]
                    const Icon = meta.icon
                    return (
                      <TabsTrigger key={p} value={p} className="gap-1.5">
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </Tabs>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {visiblePurposes.map((p) => (
                  <div
                    key={p}
                    className={cn(
                      purposeTab === p ? "block" : "hidden lg:block"
                    )}
                  >
                    <QrDisplayCard
                      purpose={p}
                      patientId={user.id}
                      initial={qrCache[p]}
                    />
                  </div>
                ))}
              </div>

              <Card className="border-dashed bg-emerald-50/40 dark:bg-emerald-500/5">
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">
                      How patient QR codes work
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Each QR encodes an AES-256-CBC encrypted payload. Only
                      doctors and healthcare organizations can decrypt it via
                      their dashboard. Patients scanning their own QR see a
                      redacted self-view. Codes expire after 24 hours — use
                      &quot;Regenerate&quot; to rotate at any time.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Scan Patient QR — doctor only */}
        {isDoctor && (
          <TabsContent value="scan" className="mt-4">
            <SectionHeader
              title="Scan Patient QR"
              description="Decrypt a patient's QR to view their verified health summary during consultation."
              icon={ScanLine}
            />
            <ScanTab scannerId={user.id} />
          </TabsContent>
        )}

        {/* History */}
        <TabsContent value="history" className="mt-4">
          <SectionHeader
            title="QR History"
            description="Active QR codes currently associated with your account."
            icon={History}
          />
          <HistoryTab patientId={user.id} />
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}

export default PatientQr
