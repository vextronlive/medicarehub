"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import ReactMarkdown from "react-markdown"
import { format, differenceInCalendarDays, isFuture, parseISO } from "date-fns"

import { useAuthStore } from "@/lib/auth-store"
import { apiFetch } from "@/lib/api"
import { DashboardShell, type NavItem, type SearchItem } from "@/components/dashboard/shell"
import { RatingDialog } from "@/components/dashboard/rating-dialog"
import VitalsTracker from "@/components/dashboard/features/vitals-tracker"
import RefillRequests from "@/components/dashboard/features/refill-requests"
import LabOrders from "@/components/dashboard/features/lab-orders"
import Telemedicine from "@/components/dashboard/features/telemedicine"
import RefillFromRecord from "@/components/dashboard/features/refill-from-record"
import AIVitalsInsights from "@/components/dashboard/features/ai-vitals-insights"
import LabCatalogManager from "@/components/dashboard/features/lab-catalog-manager"
import AppointmentReminders from "@/components/dashboard/features/appointment-reminders"
import Messaging from "@/components/dashboard/features/messaging"
import FamilyMembers from "@/components/dashboard/features/family-members"
import MedicationSchedule from "@/components/dashboard/features/medication-schedule"
import EmergencySOS from "@/components/dashboard/features/emergency-sos"
import HealthGoals from "@/components/dashboard/features/health-goals"
import PatientQr from "@/components/dashboard/features/patient-qr"
import BmiTracker from "@/components/dashboard/features/bmi-tracker"
import MenstrualTracker from "@/components/dashboard/features/menstrual-tracker"
import DoctorDirectory from "@/components/dashboard/features/doctor-directory"
import InsuranceDirectory from "@/components/dashboard/features/insurance-directory"
import VoiceRecord from "@/components/dashboard/features/voice-record"
import NlpRecordBuilder from "@/components/dashboard/features/nlp-record-builder"
import {
  StatCard,
  SectionHeader,
  EmptyState,
  HeroBanner,
  QuickAction,
  InfoCard,
  MetricRing,
} from "@/components/dashboard/shared/primitives"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn, doctorName } from "@/lib/utils"
import { toast } from "sonner"

import {
  LayoutDashboard,
  Calendar,
  CalendarPlus,
  CalendarClock,
  FileText,
  Settings,
  Loader2,
  Home,
  Stethoscope,
  Activity,
  Heart,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Droplet,
  Sparkles,
  ScanLine,
  Camera,
  Star,
  MapPin,
  Clock,
  Navigation,
  Ticket,
  Plus,
  Search,
  CreditCard,
  Fingerprint,
  Phone,
  Pencil,
  LogOut,
  ChevronRight,
  Brain,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  CalendarDays,
  Pin,
  FileImage,
  Wallet,
  Download,
  Pill,
  TestTube,
  Video,
  MessageSquare,
  Users,
  Siren,
  Target,
  Footprints,
  Mic,
  type LucideIcon,
} from "lucide-react"

// ─────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────
interface Doctor {
  id: string
  name: string
  specialization?: string | null
  city?: string | null
  state?: string | null
  bedCount?: number | null
  capacityPerHour?: number | null
  avgRating: number
  ratingCount: number
}

interface Appointment {
  id: string
  status: string
  scheduledAt: string
  tokenNumber?: string | null
  reason: string
  notes?: string | null
  patient: {
    id: string
    name: string
    mobile: string
    bloodGroup?: string | null
  }
  doctor: {
    id: string
    name: string
    specialization?: string | null
    city?: string | null
  }
  org?: { id: string; name: string; city?: string | null } | null
}

interface MedicalRecord {
  id: string
  visitType: string
  clinicName: string
  practitionerName: string
  specialization: string
  diagnosis: string
  doctorsNotes: string
  prescription: string
  attachments: string
  visitDate: string
  patient: {
    id: string
    name: string
    mobile: string
    bloodGroup?: string | null
  }
  doctor: { id: string; name: string; specialization?: string | null }
  org?: { id: string; name: string; city?: string | null } | null
}

interface Insurance {
  id: string
  providerName: string
  policyNumber: string
  insuranceType: string
  amountCovered: number
  medicalPremium: number
  coverageDetails: string
  termsUrl?: string | null
  premiumDueDate?: string | null
}

interface AccountDetail {
  id: string
  email: string
  mobile: string
  role: string
  name: string
  govtIdType?: string | null
  govtIdNumber?: string | null
  aadhaarNumber?: string | null
  drivingLicenseNumber?: string | null
  addressLine: string
  landmark?: string | null
  city: string
  state: string
  pincode: string
  lat?: string | null
  lng?: string | null
  bloodGroup?: string | null
  emergencyName?: string | null
  emergencyMobile?: string | null
  specialization?: string | null
  biometricEnrolled: boolean
  upiId?: string | null
  insurance?: Insurance | null
  membershipNumber?: string | null
}

interface ETAResult {
  distanceKm: number
  travelMinutes: number
  leaveBy: string
  appointmentTime: string
}

// ─────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────
const SPECIALIZATIONS = [
  "General Medicine",
  "Cardiology",
  "Endocrinology",
  "Pulmonology",
  "Orthopedics",
  "Dermatology",
  "Neurology",
  "Pediatrics",
  "Gynecology",
  "Psychiatry",
  "Others",
]

const VISIT_TYPES = [
  "CONSULTATION",
  "EMERGENCY",
  "FOLLOW_UP",
  "CHECKUP",
  "PROCEDURE",
] as const

const navItems: NavItem[] = [
  { id: "home", label: "Home", icon: LayoutDashboard },
  { id: "appointments", label: "Appointments", icon: Calendar },
  { id: "reminders", label: "Reminders", icon: CalendarClock },
  { id: "records", label: "View Records", icon: FileText },
  { id: "vitals", label: "Vitals", icon: Activity },
  { id: "goals", label: "Health Goals", icon: Target },
  { id: "medications", label: "Medications", icon: Pill },
  { id: "family", label: "Family Members", icon: Users },
  { id: "ai-insights", label: "AI Insights", icon: Brain },
  { id: "refills", label: "Refills", icon: Pill },
  { id: "quick-refill", label: "Quick Refill", icon: Pill },
  { id: "labs", label: "Lab Tests", icon: TestTube },
  { id: "lab-catalog", label: "Lab Catalog", icon: TestTube },
  { id: "telemedicine", label: "Video Visit", icon: Video },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "emergency", label: "Emergency SOS", icon: Siren },
  // MoM points — new tabs
  { id: "patient-qr", label: "My QR Code", icon: ScanLine },
  { id: "doctor-directory", label: "Find Doctors", icon: Stethoscope },
  { id: "insurance-directory", label: "Insurance", icon: Shield },
  { id: "bmi", label: "BMI Tracker", icon: Activity },
  { id: "menstrual", label: "Cycle Tracker", icon: Heart },
  { id: "voice-record", label: "Voice Memo", icon: Mic },
  { id: "accounts", label: "Accounts", icon: Settings },
]

// ─────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────
function visitTypeBadgeClass(v: string): string {
  switch (v) {
    case "CONSULTATION":
      return "bg-sky-100 text-sky-700 border-sky-200"
    case "EMERGENCY":
      return "bg-rose-100 text-rose-700 border-rose-200"
    case "FOLLOW_UP":
      return "bg-emerald-100 text-emerald-700 border-emerald-200"
    case "CHECKUP":
      return "bg-teal-100 text-teal-700 border-teal-200"
    case "PROCEDURE":
      return "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200"
    default:
      return "bg-slate-100 text-slate-700 border-slate-200"
  }
}

function visitTypeDotClass(v: string): string {
  switch (v) {
    case "CONSULTATION":
      return "bg-sky-500"
    case "EMERGENCY":
      return "bg-rose-500"
    case "FOLLOW_UP":
      return "bg-emerald-500"
    case "CHECKUP":
      return "bg-teal-500"
    case "PROCEDURE":
      return "bg-fuchsia-500"
    default:
      return "bg-slate-400"
  }
}

function statusBadgeClass(s: string): string {
  switch (s) {
    case "CONFIRMED":
      return "bg-emerald-100 text-emerald-700 border-emerald-200"
    case "PENDING":
      return "bg-amber-100 text-amber-700 border-amber-200"
    case "COMPLETED":
      return "bg-slate-100 text-slate-700 border-slate-200"
    case "CANCELLED":
      return "bg-rose-100 text-rose-700 border-rose-200"
    default:
      return "bg-slate-100 text-slate-700 border-slate-200"
  }
}

function fmtDate(iso: string): string {
  try {
    return format(new Date(iso), "EEE, MMM d, yyyy")
  } catch {
    return iso
  }
}

function fmtTime(iso: string): string {
  try {
    return format(new Date(iso), "h:mm a")
  } catch {
    return iso
  }
}

function fmtDateTime(iso: string): string {
  try {
    return format(new Date(iso), "EEE, MMM d · h:mm a")
  } catch {
    return iso
  }
}

function maskGovtId(id: string): string {
  if (!id) return "—"
  if (id.length <= 4) return "•".repeat(id.length)
  return "•".repeat(id.length - 4) + id.slice(-4)
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported on this device."))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000,
    })
  })
}

function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const commaIdx = result.indexOf(",")
      const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result
      resolve({ base64, mime: file.type || "image/jpeg" })
    }
    reader.onerror = () => reject(new Error("Failed to read file."))
    reader.readAsDataURL(file)
  })
}

function parsePrescription(
  p: string
): Array<Record<string, string>> | null {
  if (!p) return null
  try {
    const parsed = JSON.parse(p)
    if (Array.isArray(parsed)) return parsed as Array<Record<string, string>>
    return null
  } catch {
    return null
  }
}

function parseAttachments(a: string): string[] {
  if (!a) return []
  try {
    const parsed = JSON.parse(a)
    if (Array.isArray(parsed)) {
      return parsed
        .map((x) => {
          if (typeof x === "string") return x
          if (x && typeof x === "object") {
            return (x as { name?: string }).name || JSON.stringify(x)
          }
          return String(x)
        })
        .filter(Boolean)
    }
    return []
  } catch {
    return []
  }
}

function toDatetimeLocalValue(iso: string): string {
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ""
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function exportRecordsPDF(
  records: MedicalRecord[],
  patientName: string
) {
  const win = window.open("", "_blank", "width=820,height=900")
  if (!win) {
    toast.error("Pop-up blocked. Please allow pop-ups to export records.")
    return
  }

  const sorted = [...records].sort(
    (a, b) =>
      new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
  )

  const recordsHtml = sorted
    .map((r, idx) => {
      const meds = parsePrescription(r.prescription)
      const atts = parseAttachments(r.attachments)
      const medsTable = meds
        ? `<table class="rx"><thead><tr><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th></tr></thead><tbody>${meds
            .map(
              (m) =>
                `<tr><td>${escapeHtml(m.medicine || m.name || "—")}</td><td>${escapeHtml(m.dose || "—")}</td><td>${escapeHtml(m.frequency || "—")}</td><td>${escapeHtml(m.duration || "—")}</td></tr>`
            )
            .join("")}</tbody></table>`
        : `<p class="rx-text">${escapeHtml(r.prescription || "No prescription recorded.")}</p>`
      const attsHtml =
        atts.length > 0
          ? `<p class="atts"><b>Attachments:</b> ${atts
              .map((a) => escapeHtml(a))
              .join(", ")}</p>`
          : ""
      return `
      <div class="record ${idx > 0 ? "page-break" : ""}">
        <div class="rec-head">
          <span class="rec-date">${escapeHtml(fmtDate(r.visitDate))}</span>
          <span class="rec-type">${escapeHtml(r.visitType.replace(/_/g, " "))}</span>
        </div>
        <table class="meta">
          <tr><td><b>Doctor:</b></td><td>${escapeHtml(doctorName(r.doctor.name))}</td></tr>
          <tr><td><b>Specialization:</b></td><td>${escapeHtml(r.specialization || "—")}</td></tr>
          <tr><td><b>Clinic:</b></td><td>${escapeHtml(r.clinicName || "—")}</td></tr>
        </table>
        <p class="section-label">Diagnosis</p>
        <p class="section-body">${escapeHtml(r.diagnosis || "—")}</p>
        <p class="section-label">Doctor's Notes</p>
        <p class="section-body">${escapeHtml(r.doctorsNotes || "—")}</p>
        <p class="section-label">Prescription</p>
        ${medsTable}
        ${attsHtml}
      </div>`
    })
    .join("")

  win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Medical Records — ${escapeHtml(patientName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; margin: 0; padding: 40px; line-height: 1.5; }
  .doc-head { text-align: center; border-bottom: 3px solid #059669; padding-bottom: 16px; margin-bottom: 28px; }
  .doc-head h1 { font-size: 22px; margin: 0 0 4px; color: #047857; }
  .doc-head .sub { font-size: 13px; color: #555; }
  .doc-head .meta-row { font-size: 12px; color: #777; margin-top: 6px; }
  .record { border: 1px solid #d1d5db; border-radius: 8px; padding: 18px 20px; margin-bottom: 18px; }
  .page-break { page-break-before: always; }
  .rec-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px; }
  .rec-date { font-size: 15px; font-weight: bold; color: #065f46; }
  .rec-type { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; background: #d1fae5; color: #065f46; padding: 3px 10px; border-radius: 12px; }
  .meta { width: 100%; font-size: 13px; margin-bottom: 8px; }
  .meta td { padding: 2px 0; vertical-align: top; }
  .meta td:first-child { width: 130px; color: #555; }
  .section-label { font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin: 10px 0 3px; }
  .section-body { font-size: 13px; margin: 0 0 4px; white-space: pre-wrap; }
  table.rx { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 4px; }
  table.rx th, table.rx td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
  table.rx th { background: #f3f4f6; font-weight: 600; }
  .rx-text { font-size: 13px; white-space: pre-wrap; }
  .atts { font-size: 12px; color: #555; margin-top: 8px; }
  .doc-foot { margin-top: 30px; padding-top: 14px; border-top: 1px solid #d1d5db; text-align: center; font-size: 11px; color: #9ca3af; }
  .badge-enc { display: inline-block; background: #d1fae5; color: #065f46; font-size: 10px; padding: 2px 8px; border-radius: 8px; margin-left: 6px; }
  @media print { body { padding: 20px; } .page-break { page-break-before: always; } }
</style>
</head>
<body>
  <div class="doc-head">
    <h1>MediCare Hub — Medical Records</h1>
    <div class="sub">Patient: <b>${escapeHtml(patientName)}</b></div>
    <div class="meta-row">Exported on ${escapeHtml(
      format(new Date(), "EEEE, MMMM d, yyyy 'at' h:mm a")
    )} · ${sorted.length} record${sorted.length !== 1 ? "s" : ""} <span class="badge-enc">AES-256 Encrypted</span></div>
  </div>
  ${sorted.length === 0 ? '<p style="text-align:center;color:#999;padding:40px;">No medical records to export.</p>' : recordsHtml}
  <div class="doc-foot">
    This document is confidential and was generated by MediCare Hub.<br/>
    Medical records are encrypted at rest using AES-256-CBC. Unauthorized access is prohibited.
  </div>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 300); };
  </script>
</body>
</html>`)
  win.document.close()
}

// ─────────────────────────────────────────────────────────
//  Small presentational components
// ─────────────────────────────────────────────────────────
function Stars({ rating, count }: { rating: number; count?: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              "h-3.5 w-3.5",
              i <= Math.round(rating)
                ? "fill-amber-400 text-amber-400"
                : "fill-slate-200 text-slate-200"
            )}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-muted-foreground">
        {rating > 0 ? rating.toFixed(1) : "New"}
        {count !== undefined && count > 0 ? ` (${count})` : ""}
      </span>
    </div>
  )
}

function MarkdownView({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed text-foreground [&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-1.5 [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-medium [&_li]:my-0.5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_strong]:font-semibold [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}

function TokenBadge({ token }: { token?: string | null }) {
  if (!token) return null
  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1">
      <Ticket className="h-3.5 w-3.5 text-emerald-600" />
      <span className="text-[11px] font-medium text-emerald-700">
        Token
      </span>
      <span className="font-mono text-sm font-bold tracking-wider text-emerald-700">
        {token}
      </span>
    </div>
  )
}

function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            {Icon && (
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Icon className="h-4 w-4" />
              </div>
            )}
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              {description && (
                <CardDescription className="mt-0.5">
                  {description}
                </CardDescription>
              )}
            </div>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────
//  Home tab
// ─────────────────────────────────────────────────────────
function HomeTab({
  account,
  appointments,
  records,
  onBookDoctor,
  onSwitchTab,
}: {
  account: AccountDetail | null
  appointments: Appointment[]
  records: MedicalRecord[]
  onBookDoctor: (d: Doctor) => void
  onSwitchTab: (tab: string) => void
}) {
  const user = useAuthStore((s) => s.user)
  const today = new Date()

  const upcoming = useMemo(
    () =>
      appointments
        .filter(
          (a) =>
            (a.status === "PENDING" || a.status === "CONFIRMED") &&
            isFuture(new Date(a.scheduledAt))
        )
        .sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() -
            new Date(b.scheduledAt).getTime()
        ),
    [appointments]
  )

  const insurance = account?.insurance ?? null
  const premiumDays =
    insurance?.premiumDueDate != null
      ? differenceInCalendarDays(new Date(insurance.premiumDueDate), today)
      : null

  // AI health summary
  const [summary, setSummary] = useState<string>("")
  const [summaryLoading, setSummaryLoading] = useState(false)
  async function generateSummary() {
    if (records.length === 0) {
      toast.error("No medical records found to summarize.", {
        description:
          "Add at least one medical record (visit, prescription, or lab report) first, then try again.",
      })
      setSummary(
        "**No medical records available yet.**\n\nTo generate an AI health summary, please add at least one medical record first — such as a doctor visit, prescription, or lab report. Once you have records, click \"Generate AI Health Summary\" again."
      )
      return
    }
    setSummaryLoading(true)
    setSummary("")
    try {
      const res = await apiFetch<{ result: string }>("/api/ai/health-summary", {
        method: "POST",
        body: JSON.stringify({ records, patientName: user?.name || "Patient" }),
      })
      setSummary(res.result)
      toast.success("AI health summary generated.")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to generate summary."
      toast.error("Failed to generate AI health summary", {
        description: msg,
      })
      setSummary(`**Error generating summary:** ${msg}`)
    } finally {
      setSummaryLoading(false)
    }
  }

  // Doctor recommendations
  const [symptom, setSymptom] = useState("")
  const [spec, setSpec] = useState<string>("")
  const [recs, setRecs] = useState<Doctor[]>([])
  const [advisory, setAdvisory] = useState("")
  const [recLoading, setRecLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  async function findDoctors() {
    setRecLoading(true)
    setHasSearched(true)
    try {
      const res = await apiFetch<{
        recommendations: Doctor[]
        advisory: string
      }>("/api/ai/recommendations", {
        method: "POST",
        body: JSON.stringify({
          city: account?.city || user?.city || "",
          specialization: spec && spec !== "ALL" ? spec : undefined,
          symptom: symptom || undefined,
        }),
      })
      setRecs(res.recommendations || [])
      setAdvisory(res.advisory || "")
      if ((res.recommendations || []).length === 0) {
        toast.info("No doctors found matching your criteria.")
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to fetch recommendations."
      )
    } finally {
      setRecLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero greeting banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-600 p-6 text-white shadow-lg shadow-emerald-500/20">
        {/* Decorative blobs */}
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 right-20 h-32 w-32 rounded-full bg-teal-300/20 blur-2xl" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                <Heart className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm">
                Patient Dashboard
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Hello, {user?.name?.split(" ")[0] || "there"} 👋
            </h1>
            <p className="mt-1 text-sm text-emerald-50/90">
              {format(today, "EEEE, MMMM d, yyyy")} · Here&apos;s your health
              overview.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>AES-256 Encrypted</span>
            </div>
            {user?.bloodGroup && (
              <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
                <Droplet className="h-3.5 w-3.5" />
                <span>Blood Group: {user.bloodGroup}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Upcoming Appointments"
          value={upcoming.length}
          icon={CalendarDays}
          color="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
          accent="from-emerald-500 to-teal-500"
          trend={upcoming.length > 0 ? "Next visit scheduled" : "Nothing due"}
          trendUp={upcoming.length > 0}
        />
        <StatCard
          title="Medical Records"
          value={records.length}
          icon={FileText}
          color="bg-teal-50 text-teal-600 dark:bg-teal-500/10"
          accent="from-teal-500 to-cyan-500"
          trend="Lifetime history"
        />
        <StatCard
          title="Insurance"
          value={insurance ? "Active" : "None"}
          icon={insurance ? ShieldCheck : ShieldAlert}
          color={
            insurance
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
              : "bg-amber-50 text-amber-600 dark:bg-amber-500/10"
          }
          accent={insurance ? "from-emerald-500 to-teal-500" : "from-amber-500 to-orange-500"}
          trend={insurance ? insurance.providerName : "Not linked"}
          trendUp={!!insurance}
        />
        <StatCard
          title="Blood Group"
          value={user?.bloodGroup || account?.bloodGroup || "—"}
          icon={Droplet}
          color="bg-rose-50 text-rose-600 dark:bg-rose-500/10"
          accent="from-rose-500 to-pink-500"
          trend="On profile"
        />
      </div>

      {/* Quick Actions grid */}
      <div>
        <SectionHeader
          title="Quick Actions"
          description="Jump straight to the most common tasks."
          icon={Sparkles}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <QuickAction
            icon={CalendarPlus}
            label="Book Visit"
            description="Schedule appointment"
            accent="emerald"
            onClick={() => onSwitchTab("appointments")}
          />
          <QuickAction
            icon={Activity}
            label="Log Vitals"
            description="BP, glucose, weight"
            accent="sky"
            onClick={() => onSwitchTab("vitals")}
          />
          <QuickAction
            icon={Target}
            label="Set Goal"
            description="Steps, sleep, exercise"
            accent="violet"
            onClick={() => onSwitchTab("goals")}
          />
          <QuickAction
            icon={Pill}
            label="Medications"
            description="Daily schedule"
            accent="amber"
            onClick={() => onSwitchTab("medications")}
          />
          <QuickAction
            icon={Users}
            label="Family"
            description="Manage profiles"
            accent="teal"
            onClick={() => onSwitchTab("family")}
          />
          <QuickAction
            icon={Siren}
            label="Emergency SOS"
            description="One-tap alert"
            accent="rose"
            onClick={() => onSwitchTab("emergency")}
          />
        </div>
      </div>

      {/* Insurance premium alert */}
      {insurance && premiumDays !== null && premiumDays >= 0 && premiumDays <= 30 ? (
        <Alert className="border-amber-300 bg-amber-50 text-amber-800">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">
            Insurance premium due in {premiumDays} day{premiumDays === 1 ? "" : "s"}
          </AlertTitle>
          <AlertDescription className="text-amber-700">
            <p>
              Your {insurance.providerName} premium of{" "}
              <span className="font-semibold">
                ₹{insurance.medicalPremium.toLocaleString("en-IN")}
              </span>{" "}
              is due on{" "}
              <span className="font-semibold">
                {fmtDate(insurance.premiumDueDate as string)}
              </span>
              . Pay before the due date to keep your coverage active.
            </p>
            <Button
              size="sm"
              className="mt-3 bg-amber-600 text-white hover:bg-amber-700"
              onClick={() =>
                toast.info("Opening secure payment gateway…", {
                  description: `₹${insurance.medicalPremium.toLocaleString("en-IN")} to ${insurance.providerName}`,
                })
              }
            >
              <CreditCard className="mr-1.5 h-4 w-4" />
              Pay Premium
            </Button>
          </AlertDescription>
        </Alert>
      ) : !insurance ? (
        <Alert className="border-emerald-200 bg-emerald-50/60 text-emerald-800">
          <Shield className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-emerald-800">
            No insurance linked yet
          </AlertTitle>
          <AlertDescription className="text-emerald-700">
            <p>
              Add a health insurance policy to track coverage, premiums and
              due dates in one place.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
              onClick={() =>
                toast.info(
                  "Please contact your insurance provider or MediCare support to link a policy."
                )
              }
            >
              Add Insurance
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* AI Health Summary */}
      <SectionCard
        title="AI Health Summary"
        description="An AI-generated overview of your medical history & lifestyle tips."
        icon={Brain}
        action={
          <Button
            onClick={generateSummary}
            disabled={summaryLoading}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            size="sm"
          >
            {summaryLoading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-4 w-4" />
            )}
            {summary ? "Regenerate" : "Generate AI Health Summary"}
          </Button>
        }
      >
        {summary ? (
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/30 p-4">
              <MarkdownView content={summary} />
            </div>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              Confidential: generated with your consent from your encrypted
              records. This is informational only and not a substitute for
              professional medical advice.
            </p>
          </div>
        ) : summaryLoading ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
            Analyzing your medical records with AI…
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
            <Brain className="mb-2 h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium">No summary yet</p>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              Generate a friendly AI summary of your health trends, recurring
              conditions and precautions based on your {records.length} medical
              record{records.length === 1 ? "" : "s"}.
            </p>
          </div>
        )}
      </SectionCard>

      {/* Doctor Recommendations */}
      <SectionCard
        title="Find the Right Doctor"
        description="Describe your symptom and we'll recommend top-rated specialists near you."
        icon={Stethoscope}
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <Input
              placeholder="e.g. persistent headache, knee pain, fever…"
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
            />
            <Select value={spec} onValueChange={setSpec}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Any specialization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Any specialization</SelectItem>
                {SPECIALIZATIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={findDoctors}
              disabled={recLoading}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {recLoading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-1.5 h-4 w-4" />
              )}
              Find Doctors
            </Button>
          </div>

          {advisory && (
            <Alert className="border-emerald-200 bg-emerald-50/50 text-emerald-800">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-700">
                <MarkdownView content={advisory} />
              </AlertDescription>
            </Alert>
          )}

          {recLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : recs.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {recs.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-col justify-between rounded-lg border p-4 transition hover:border-emerald-300 hover:shadow-sm"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{d.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.specialization || "General Practice"}
                        </p>
                      </div>
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-emerald-100 text-xs text-emerald-700">
                          {d.name
                            .split(" ")
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {d.city || "—"}
                      </span>
                      <Stars rating={d.avgRating} count={d.ratingCount} />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="mt-3 bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => onBookDoctor(d)}
                  >
                    <CalendarPlus className="mr-1.5 h-4 w-4" />
                    Book Appointment
                  </Button>
                </div>
              ))}
            </div>
          ) : hasSearched ? (
            <EmptyState
              icon={Stethoscope}
              title="No doctors found"
              description="Try a different symptom or specialization, or broaden your search."
            />
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              Enter a symptom and tap <b>Find Doctors</b> to get AI-curated,
              top-rated specialist recommendations.
            </p>
          )}
        </div>
      </SectionCard>

      {/* Upcoming appointments preview */}
      <SectionCard
        title="Upcoming Appointments"
        description="Your next 3 scheduled visits"
        icon={Calendar}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSwitchTab("appointments")}
          >
            View all
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        }
      >
        {upcoming.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No upcoming appointments"
            description="Book a new appointment to see it here."
            action={
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => onSwitchTab("appointments")}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Book Appointment
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {upcoming.slice(0, 3).map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Stethoscope className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{a.doctor.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.doctor.specialization || "Specialist"} ·{" "}
                      {fmtDateTime(a.scheduledAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TokenBadge token={a.tokenNumber} />
                  <Badge
                    variant="outline"
                    className={statusBadgeClass(a.status)}
                  >
                    {a.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
//  ETA widget (used inside appointment cards)
// ─────────────────────────────────────────────────────────
function ETAWidget({ appt, account }: { appt: Appointment; account: AccountDetail | null }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ETAResult | null>(null)

  async function estimate() {
    setLoading(true)
    try {
      const pos = await getCurrentPosition()
      const fromLat = pos.coords.latitude
      const fromLng = pos.coords.longitude
      // Mock clinic location: offset from patient's home coordinates (or current pos)
      const baseLat = account?.lat ? parseFloat(account.lat) : fromLat
      const baseLng = account?.lng ? parseFloat(account.lng) : fromLng
      const toLat = baseLat + 0.045
      const toLng = baseLng + 0.035
      const res = await apiFetch<ETAResult>("/api/token", {
        method: "POST",
        body: JSON.stringify({
          fromLat,
          fromLng,
          toLat,
          toLng,
          appointmentTime: appt.scheduledAt,
        }),
      })
      setResult(res)
      toast.success(
        `Leave by ${fmtTime(res.leaveBy)} to arrive on time.`
      )
    } catch (e) {
      const msg =
        e instanceof GeolocationPositionError
          ? "Location permission denied. Enable location to estimate travel time."
          : e instanceof Error
            ? e.message
            : "Failed to estimate travel time."
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Navigation className="h-4 w-4 text-emerald-600" />
          Travel estimate
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={estimate}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="mr-1.5 h-4 w-4" />
          )}
          {result ? "Re-estimate" : "Estimate travel time"}
        </Button>
      </div>
      {result && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-white p-2">
            <p className="text-xs text-muted-foreground">Distance</p>
            <p className="text-sm font-semibold">{result.distanceKm} km</p>
          </div>
          <div className="rounded-md bg-white p-2">
            <p className="text-xs text-muted-foreground">Travel time</p>
            <p className="text-sm font-semibold">{result.travelMinutes} min</p>
          </div>
          <div className="rounded-md bg-emerald-50 p-2">
            <p className="text-xs text-emerald-600">Leave by</p>
            <p className="text-sm font-semibold text-emerald-700">
              {fmtTime(result.leaveBy)}
            </p>
          </div>
        </div>
      )}
      {result && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Leave by {fmtTime(result.leaveBy)} to arrive on time for your{" "}
          {fmtTime(appt.scheduledAt)} appointment.
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
//  Appointment card
// ─────────────────────────────────────────────────────────
function AppointmentCard({
  appt,
  account,
  onRate,
  rated,
  ratedScore,
  onReschedule,
  onCancel,
}: {
  appt: Appointment
  account: AccountDetail | null
  onRate?: (appt: Appointment) => void
  rated?: boolean
  ratedScore?: number
  onReschedule?: (appt: Appointment) => void
  onCancel?: (appt: Appointment) => void
}) {
  const clinicName = appt.org?.name || "Direct Consultation"
  const isUpcoming = appt.status === "PENDING" || appt.status === "CONFIRMED"
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">{doctorName(appt.doctor.name)}</p>
              <p className="text-sm text-muted-foreground">
                {appt.doctor.specialization || "Specialist"}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {clinicName}
                {appt.doctor.city ? ` · ${appt.doctor.city}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className={statusBadgeClass(appt.status)}>
              {appt.status}
            </Badge>
            <TokenBadge token={appt.tokenNumber} />
          </div>
        </div>

        <Separator className="my-3" />

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{fmtDateTime(appt.scheduledAt)}</span>
          </div>
          {appt.reason && (
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">{appt.reason}</span>
            </div>
          )}
        </div>

        {appt.notes && (
          <p className="mt-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Note: {appt.notes}
          </p>
        )}

        {appt.status === "CONFIRMED" && <ETAWidget appt={appt} account={account} />}

        {isUpcoming && (onReschedule || onCancel) && (
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {onReschedule && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => onReschedule(appt)}
              >
                <CalendarClock className="h-3.5 w-3.5" />
                Reschedule
              </Button>
            )}
            {onCancel && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-rose-300 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will cancel your appointment with{" "}
                      <b>{doctorName(appt.doctor.name)}</b> on{" "}
                      {fmtDateTime(appt.scheduledAt)}. This action cannot be
                      undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Appointment</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-rose-600 text-white hover:bg-rose-700"
                      onClick={() => onCancel(appt)}
                    >
                      Yes, Cancel Appointment
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}

        {appt.status === "COMPLETED" && onRate && (
          <div className="mt-3 flex justify-end">
            {rated ? (
              <Badge className="gap-1 bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {ratedScore ? `Rated ${ratedScore}/5` : "Rated"}
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                onClick={() => onRate(appt)}
              >
                <Star className="h-3.5 w-3.5" />
                Rate Visit
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────
//  Book appointment dialog
// ─────────────────────────────────────────────────────────
function BookAppointmentDialog({
  user,
  open,
  onOpenChange,
  preselectedDoctor,
  onBooked,
}: {
  user: { id: string; name: string; city?: string | null }
  open: boolean
  onOpenChange: (v: boolean) => void
  preselectedDoctor: Doctor | null
  onBooked: (a: Appointment) => void
}) {
  const [spec, setSpec] = useState<string>("")
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loadingDoctors, setLoadingDoctors] = useState(false)
  const [doctorId, setDoctorId] = useState<string>("")
  const [scheduledAt, setScheduledAt] = useState<string>("")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [successToken, setSuccessToken] = useState<string | null>(null)
  const [successAppt, setSuccessAppt] = useState<Appointment | null>(null)

  // MoM Point 3 — Aadhaar verification for appointments
  const [aadhaar, setAadhaar] = useState("")
  const [aadhaarTxnId, setAadhaarTxnId] = useState<string | null>(null)
  const [aadhaarOtp, setAadhaarOtp] = useState("")
  const [aadhaarVerified, setAadhaarVerified] = useState(false)
  const [aadhaarMasked, setAadhaarMasked] = useState<string | null>(null)
  const [aadhaarDemoOtp, setAadhaarDemoOtp] = useState<string | null>(null)
  const [aadhaarSending, setAadhaarSending] = useState(false)
  const [aadhaarVerifying, setAadhaarVerifying] = useState(false)

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setSpec("")
        setDoctors([])
        setDoctorId("")
        setScheduledAt("")
        setReason("")
        setNotes("")
        setSuccessToken(null)
        setSuccessAppt(null)
        setAadhaar("")
        setAadhaarTxnId(null)
        setAadhaarOtp("")
        setAadhaarVerified(false)
        setAadhaarMasked(null)
        setAadhaarDemoOtp(null)
      }, 200)
      return () => clearTimeout(t)
    }
  }, [open])

  // Handle preselected doctor
  useEffect(() => {
    if (open && preselectedDoctor) {
      setSpec(preselectedDoctor.specialization || "")
      setDoctorId(preselectedDoctor.id)
      setDoctors([preselectedDoctor])
    }
  }, [open, preselectedDoctor])

  // Load doctors when specialization changes
  useEffect(() => {
    if (!open) return
    if (preselectedDoctor) return // don't override preselected
    if (!spec) {
      setDoctors([])
      setDoctorId("")
      return
    }
    setLoadingDoctors(true)
    apiFetch<{ doctors: Doctor[] }>(
      `/api/doctors?role=DOCTOR&specialization=${encodeURIComponent(spec)}${
        user.city ? `&city=${encodeURIComponent(user.city)}` : ""
      }`
    )
      .then((res) => {
        setDoctors(res.doctors || [])
        setDoctorId("")
      })
      .catch((e) => {
        toast.error(
          e instanceof Error ? e.message : "Failed to load doctors."
        )
        setDoctors([])
      })
      .finally(() => setLoadingDoctors(false))
  }, [spec, open, preselectedDoctor, user.city])

  // MoM Point 3 — Aadhaar OTP send
  async function sendAadhaarOtp() {
    const cleaned = aadhaar.replace(/\s+/g, "")
    if (!/^\d{12}$/.test(cleaned)) {
      toast.error("Aadhaar must be 12 digits")
      return
    }
    setAadhaarSending(true)
    try {
      const res = await apiFetch<{
        txnId: string
        demoOtp?: string
        masked: string
        message: string
      }>("/api/verify/aadhaar", {
        method: "POST",
        body: JSON.stringify({ userId: user.id, aadhaar: cleaned, mode: "send" }),
      })
      setAadhaarTxnId(res.txnId)
      setAadhaarMasked(res.masked)
      if (res.demoOtp) setAadhaarDemoOtp(res.demoOtp)
      toast.success("OTP sent to your Aadhaar-linked mobile number")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send OTP")
    } finally {
      setAadhaarSending(false)
    }
  }

  // MoM Point 3 — Aadhaar OTP verify
  async function verifyAadhaarOtp() {
    if (!aadhaarOtp) {
      toast.error("Enter the OTP")
      return
    }
    setAadhaarVerifying(true)
    try {
      await apiFetch("/api/verify/aadhaar", {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          txnId: aadhaarTxnId,
          otp: aadhaarOtp,
        }),
      })
      setAadhaarVerified(true)
      toast.success("Aadhaar verified successfully!")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed")
    } finally {
      setAadhaarVerifying(false)
    }
  }

  async function submit() {
    if (!doctorId) {
      toast.error("Please select a doctor.")
      return
    }
    if (!scheduledAt) {
      toast.error("Please pick a date and time.")
      return
    }
    if (!aadhaarVerified) {
      toast.error("Please verify your Aadhaar to continue.")
      return
    }
    setSubmitting(true)
    try {
      const res = await apiFetch<{ appointment: Appointment }>(
        "/api/appointments",
        {
          method: "POST",
          body: JSON.stringify({
            patientId: user.id,
            doctorId,
            scheduledAt: new Date(scheduledAt).toISOString(),
            reason,
            notes: notes || undefined,
            aadhaarVerified: true,
            aadhaarRef: aadhaarMasked || undefined,
          }),
        }
      )
      setSuccessAppt(res.appointment)
      setSuccessToken(res.appointment.tokenNumber || null)
      onBooked(res.appointment)
      toast.success("Appointment booked successfully!")
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to book appointment."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {successAppt ? (
          <div className="flex flex-col items-center py-4 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <DialogTitle className="text-lg">Appointment Confirmed!</DialogTitle>
            <DialogDescription className="mt-1">
              Your appointment with{" "}
              <b>{successAppt.doctor.name}</b> on{" "}
              {fmtDateTime(successAppt.scheduledAt)} has been booked.
            </DialogDescription>
            <div className="my-5 w-full rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                Your Token Number
              </p>
              <p className="mt-1 font-mono text-4xl font-bold tracking-[0.2em] text-emerald-700">
                {successToken}
              </p>
              <p className="mt-2 text-xs text-emerald-600">
                Show this token at the clinic reception.
              </p>
            </div>
            <Button
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Book New Appointment</DialogTitle>
              <DialogDescription>
                Pick a specialization, choose a doctor and select a time slot.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Specialization</Label>
                <Select
                  value={spec}
                  onValueChange={setSpec}
                  disabled={!!preselectedDoctor}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select specialization" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALIZATIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Doctor</Label>
                <Select
                  value={doctorId}
                  onValueChange={setDoctorId}
                  disabled={loadingDoctors || doctors.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        loadingDoctors
                          ? "Loading doctors…"
                          : doctors.length === 0
                            ? "Select a specialization first"
                            : "Select a doctor"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} · {d.city || "—"} · ⭐ {d.avgRating.toFixed(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Date &amp; Time</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Reason for visit</Label>
                <Input
                  placeholder="e.g. Fever, routine checkup…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Notes (optional)</Label>
                <Textarea
                  placeholder="Any additional info for the doctor"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              {/* MoM Point 3 — Aadhaar verification for appointments */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                <div className="mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    Aadhaar Verification
                  </span>
                  {aadhaarVerified && (
                    <Badge className="ml-auto gap-1 border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified
                    </Badge>
                  )}
                </div>
                {aadhaarVerified ? (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5 dark:bg-emerald-950/30">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        Aadhaar linked
                      </p>
                      <p className="font-mono text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        {aadhaarMasked}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div>
                      <Label className="text-xs">Aadhaar Number *</Label>
                      <Input
                        placeholder="12-digit Aadhaar number"
                        value={aadhaar}
                        onChange={(e) =>
                          setAadhaar(
                            e.target.value
                              .replace(/\D/g, "")
                              .slice(0, 12)
                          )
                        }
                        inputMode="numeric"
                        disabled={!!aadhaarTxnId}
                        className="mt-1"
                      />
                    </div>
                    {!aadhaarTxnId ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-900/50 dark:text-amber-300"
                        disabled={aadhaarSending || aadhaar.length !== 12}
                        onClick={sendAadhaarOtp}
                      >
                        {aadhaarSending ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Send OTP
                      </Button>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">
                          OTP sent to your Aadhaar-linked mobile.
                          {aadhaarDemoOtp && (
                            <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              Demo OTP: {aadhaarDemoOtp}
                            </span>
                          )}
                        </p>
                        <div>
                          <Label className="text-xs">Enter OTP</Label>
                          <Input
                            placeholder="6-digit OTP"
                            value={aadhaarOtp}
                            onChange={(e) =>
                              setAadhaarOtp(
                                e.target.value.replace(/\D/g, "").slice(0, 6)
                              )
                            }
                            inputMode="numeric"
                            className="mt-1"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="flex-1"
                            disabled={aadhaarVerifying}
                            onClick={() => {
                              setAadhaarTxnId(null)
                              setAadhaarOtp("")
                              setAadhaarDemoOtp(null)
                            }}
                          >
                            Change number
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="flex-1 bg-amber-600 text-white hover:bg-amber-700"
                            disabled={aadhaarVerifying || aadhaarOtp.length !== 6}
                            onClick={verifyAadhaarOtp}
                          >
                            {aadhaarVerifying ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Verify
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={submit}
                disabled={submitting || !doctorId || !scheduledAt}
              >
                {submitting ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <CalendarPlus className="mr-1.5 h-4 w-4" />
                )}
                Book Appointment
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────
//  Appointments tab
// ─────────────────────────────────────────────────────────
function AppointmentsTab({
  user,
  appointments,
  loading,
  account,
  bookOpen,
  onBookOpenChange,
  preselectedDoctor,
  onBooked,
  myRatings,
  onRatingsUpdate,
  onRefresh,
}: {
  user: { id: string; name: string; city?: string | null }
  appointments: Appointment[]
  loading: boolean
  account: AccountDetail | null
  bookOpen: boolean
  onBookOpenChange: (v: boolean) => void
  preselectedDoctor: Doctor | null
  onBooked: (a: Appointment) => void
  myRatings: Record<string, number>
  onRatingsUpdate: (doctorId: string, score: number) => void
  onRefresh: () => void
}) {
  const { upcoming, completed, cancelled } = useMemo(() => {
    const upcoming = appointments.filter(
      (a) => a.status === "PENDING" || a.status === "CONFIRMED"
    )
    const completed = appointments.filter((a) => a.status === "COMPLETED")
    const cancelled = appointments.filter((a) => a.status === "CANCELLED")
    return { upcoming, completed, cancelled }
  }, [appointments])

  const [ratingAppt, setRatingAppt] = useState<Appointment | null>(null)
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set())

  // Reschedule state
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState("")
  const [rescheduling, setRescheduling] = useState(false)

  // Sync ratedIds from myRatings (keyed by doctorId → match appointment's doctor)
  useEffect(() => {
    const ids = new Set<string>()
    for (const a of appointments) {
      if (a.status === "COMPLETED" && myRatings[a.doctor?.id]) {
        ids.add(a.id)
      }
    }
    setRatedIds(ids)
  }, [appointments, myRatings])

  const ratedScores = useMemo(() => {
    const scores: Record<string, number> = {}
    for (const a of appointments) {
      if (a.status === "COMPLETED" && myRatings[a.doctor?.id]) {
        scores[a.id] = myRatings[a.doctor.id]
      }
    }
    return scores
  }, [appointments, myRatings])

  function handleReschedule(appt: Appointment) {
    setRescheduleAppt(appt)
    setRescheduleDate(toDatetimeLocalValue(appt.scheduledAt))
  }

  async function submitReschedule() {
    if (!rescheduleAppt || !rescheduleDate) return
    setRescheduling(true)
    try {
      await apiFetch("/api/appointments", {
        method: "PATCH",
        body: JSON.stringify({
          id: rescheduleAppt.id,
          scheduledAt: new Date(rescheduleDate).toISOString(),
        }),
      })
      toast.success("Appointment rescheduled successfully.")
      setRescheduleAppt(null)
      onRefresh()
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to reschedule appointment."
      )
    } finally {
      setRescheduling(false)
    }
  }

  async function handleCancel(appt: Appointment) {
    try {
      await apiFetch("/api/appointments", {
        method: "PATCH",
        body: JSON.stringify({ id: appt.id, status: "CANCELLED" }),
      })
      toast.success("Appointment cancelled.")
      onRefresh()
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to cancel appointment."
      )
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Appointments"
        description="Book new visits, reschedule or cancel upcoming appointments."
        action={
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => {
              onBookOpenChange(true)
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Book New Appointment
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No appointments yet"
          description="Book your first appointment to get started."
          action={
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => onBookOpenChange(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Book Appointment
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <AppointmentGroup
            title="Upcoming"
            icon={Clock}
            items={upcoming}
            account={account}
            empty="No upcoming appointments."
            onReschedule={handleReschedule}
            onCancel={handleCancel}
          />
          <AppointmentGroup
            title="Completed"
            icon={CheckCircle2}
            items={completed}
            account={account}
            empty="No completed appointments."
            onRate={(a) => setRatingAppt(a)}
            ratedIds={ratedIds}
            ratedScores={ratedScores}
          />
          <AppointmentGroup
            title="Cancelled"
            icon={XCircle}
            items={cancelled}
            account={account}
            empty="No cancelled appointments."
          />
        </div>
      )}

      <BookAppointmentDialog
        user={user}
        open={bookOpen}
        onOpenChange={onBookOpenChange}
        preselectedDoctor={preselectedDoctor}
        onBooked={onBooked}
      />

      {ratingAppt && (
        <RatingDialog
          open={!!ratingAppt}
          onOpenChange={(v) => !v && setRatingAppt(null)}
          doctorName={doctorName(ratingAppt.doctor.name)}
          doctorId={ratingAppt.doctor.id}
          patientId={user.id}
          onSubmitted={(score) => {
            if (score) onRatingsUpdate(ratingAppt.doctor.id, score)
            setRatedIds((prev) => new Set(prev).add(ratingAppt.id))
            setRatingAppt(null)
          }}
        />
      )}

      {/* Reschedule Dialog */}
      <Dialog
        open={!!rescheduleAppt}
        onOpenChange={(v) => !v && setRescheduleAppt(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
            <DialogDescription>
              {rescheduleAppt && (
                <>
                  with <b>{doctorName(rescheduleAppt.doctor.name)}</b> — pick a
                  new date and time.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>New Date &amp; Time</Label>
              <Input
                type="datetime-local"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
            </div>
            {rescheduleAppt && (
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Current: {fmtDateTime(rescheduleAppt.scheduledAt)}
                </div>
                {rescheduleAppt.tokenNumber && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <Ticket className="h-3.5 w-3.5" />
                    Token: {rescheduleAppt.tokenNumber}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRescheduleAppt(null)}
              disabled={rescheduling}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={submitReschedule}
              disabled={rescheduling || !rescheduleDate}
            >
              {rescheduling ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <CalendarClock className="mr-1.5 h-4 w-4" />
              )}
              Confirm Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AppointmentGroup({
  title,
  icon: Icon,
  items,
  account,
  empty,
  onRate,
  ratedIds,
  ratedScores,
  onReschedule,
  onCancel,
}: {
  title: string
  icon: LucideIcon
  items: Appointment[]
  account: AccountDetail | null
  empty: string
  onRate?: (appt: Appointment) => void
  ratedIds?: Set<string>
  ratedScores?: Record<string, number>
  onReschedule?: (appt: Appointment) => void
  onCancel?: (appt: Appointment) => void
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">
          {title}{" "}
          <span className="text-muted-foreground">({items.length})</span>
        </h3>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          {empty}
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((a) => (
            <AppointmentCard
              key={a.id}
              appt={a}
              account={account}
              onRate={onRate}
              rated={ratedIds?.has(a.id)}
              ratedScore={ratedScores?.[a.id]}
              onReschedule={onReschedule}
              onCancel={onCancel}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
//  Prescription scanner
// ─────────────────────────────────────────────────────────
function PrescriptionScanner() {
  const [result, setResult] = useState("")
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPG, PNG, etc).")
      return
    }
    setFileName(file.name)
    setLoading(true)
    setResult("")
    try {
      const { base64, mime } = await fileToBase64(file)
      const res = await apiFetch<{ result: string }>(
        "/api/ai/scan-prescription",
        {
          method: "POST",
          body: JSON.stringify({ imageBase64: base64, mimeType: mime }),
        }
      )
      setResult(res.result)
      toast.success("Prescription scanned successfully.")
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to scan prescription."
      )
    } finally {
      setLoading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <SectionCard
      title="AI Prescription Scanner"
      description="Upload a prescription image and let AI extract the medicines & dosage."
      icon={ScanLine}
    >
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition",
          dragging
            ? "border-emerald-400 bg-emerald-50/50"
            : "border-muted-foreground/25 hover:border-emerald-300 hover:bg-muted/30"
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Camera className="h-6 w-6" />
          )}
        </div>
        <p className="text-sm font-medium">
          {loading
            ? "Scanning prescription…"
            : "Drag & drop a prescription image, or click to browse"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Supports JPG, PNG. The image is processed securely by our AI vision
          model.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
        <Button
          variant="outline"
          size="sm"
          className="mt-4 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          <FileImage className="mr-1.5 h-4 w-4" />
          {fileName ? `Choose another` : "Choose Image"}
        </Button>
        {fileName && !loading && (
          <p className="mt-2 text-xs text-muted-foreground">
            Scanned: <b>{fileName}</b>
          </p>
        )}
      </div>

      {result && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ScanLine className="h-4 w-4 text-emerald-600" />
            Extracted Prescription
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <MarkdownView content={result} />
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            AI-extracted text may contain errors. Always verify against the
            original prescription and consult your doctor.
          </p>
        </div>
      )}
    </SectionCard>
  )
}

// ─────────────────────────────────────────────────────────
//  Record timeline item
// ─────────────────────────────────────────────────────────
function RecordTimelineItem({ record }: { record: MedicalRecord }) {
  const [open, setOpen] = useState(false)
  const prescription = parsePrescription(record.prescription)
  const attachments = parseAttachments(record.attachments)

  return (
    <div className="relative flex gap-4 pb-6">
      {/* timeline dot + line */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-4 ring-white",
            visitTypeDotClass(record.visitType)
          )}
        />
        <div className="mt-1 w-px flex-1 bg-border" />
      </div>

      {/* content */}
      <Card className="min-w-0 flex-1">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={visitTypeBadgeClass(record.visitType)}
              >
                {record.visitType.replace("_", " ")}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {fmtDate(record.visitDate)}
              </span>
            </div>
            <p className="mt-1.5 font-semibold">{record.clinicName}</p>
            <p className="text-sm text-muted-foreground">
              {record.practitionerName}
              {record.specialization ? ` · ${record.specialization}` : ""}
            </p>
          </div>
        </div>

        {record.diagnosis && (
          <div className="mt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Diagnosis
            </p>
            <p className="text-sm">{record.diagnosis}</p>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-7 px-2 text-emerald-700 hover:bg-emerald-50"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide details" : "View details"}
          <ChevronRight
            className={cn(
              "ml-1 h-3.5 w-3.5 transition-transform",
              open && "rotate-90"
            )}
          />
        </Button>

        {open && (
          <div className="mt-3 space-y-3 rounded-lg bg-muted/30 p-3">
            {record.doctorsNotes && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Doctor&apos;s Notes
                </p>
                <p className="text-sm">{record.doctorsNotes}</p>
              </div>
            )}
            {record.prescription && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Prescription
                </p>
                {prescription ? (
                  <ul className="mt-1 space-y-1">
                    {prescription.map((m, i) => (
                      <li
                        key={i}
                        className="rounded-md bg-white px-2.5 py-1.5 text-sm"
                      >
                        <span className="font-medium">
                          {m.medicine || m.name || m.medication || `Medicine ${i + 1}`}
                        </span>
                        {(m.dosage || m.frequency || m.duration) && (
                          <span className="text-muted-foreground">
                            {" — "}
                            {[m.dosage, m.frequency, m.duration]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">
                    {record.prescription}
                  </p>
                )}
              </div>
            )}
            {attachments.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Attachments
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {attachments.map((a, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      <FileImage className="h-3 w-3" />
                      {a}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Recorded by {doctorName(record.doctor.name)}
            </p>
          </div>
        )}
      </CardContent>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
//  Records tab
// ─────────────────────────────────────────────────────────
function RecordsTab({
  records,
  loading,
  patientName,
}: {
  records: MedicalRecord[]
  loading: boolean
  patientName: string
}) {
  const [filter, setFilter] = useState<string>("ALL")

  const filtered = useMemo(() => {
    if (filter === "ALL") return records
    return records.filter((r) => r.visitType === filter)
  }, [records, filter])

  const lastConsulted = records[0] || null

  function handleExport() {
    if (records.length === 0) {
      toast.info("No medical records to export yet.")
      return
    }
    toast.info("Preparing PDF export…")
    setTimeout(() => exportRecordsPDF(records, patientName), 100)
  }

  return (
    <div className="space-y-6">
      <PrescriptionScanner />

      <SectionHeader
        title="Medical Records"
        description="Your complete visit history, sorted by most recent."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleExport}
              disabled={records.length === 0}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export PDF</span>
            </Button>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All visit types</SelectItem>
                {VISIT_TYPES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {lastConsulted && (
        <Alert className="border-emerald-200 bg-emerald-50/50 text-emerald-800">
          <Activity className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-700">
            Last consulted:{" "}
            <b>
              {lastConsulted.clinicName} on {fmtDate(lastConsulted.visitDate)}
            </b>{" "}
            for {lastConsulted.visitType.replace("_", " ").toLowerCase()}.
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={records.length === 0 ? "No medical records yet" : "No records match this filter"}
          description={
            records.length === 0
              ? "Your visit records from doctors and clinics will appear here."
              : "Try selecting a different visit type."
          }
        />
      ) : (
        <div className="max-h-[600px] overflow-y-auto pr-2">
          <div className="pl-1">
            {filtered.map((r) => (
              <RecordTimelineItem key={r.id} record={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
//  Address edit dialog
// ─────────────────────────────────────────────────────────
function AddressEditDialog({
  account,
  open,
  onOpenChange,
  onSaved,
}: {
  account: AccountDetail
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: (patch: Partial<AccountDetail>) => void
}) {
  const [form, setForm] = useState({
    addressLine: account.addressLine || "",
    landmark: account.landmark || "",
    city: account.city || "",
    state: account.state || "",
    pincode: account.pincode || "",
    mobile: account.mobile || "",
    bloodGroup: account.bloodGroup || "",
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({
        addressLine: account.addressLine || "",
        landmark: account.landmark || "",
        city: account.city || "",
        state: account.state || "",
        pincode: account.pincode || "",
        mobile: account.mobile || "",
        bloodGroup: account.bloodGroup || "",
      })
    }
  }, [open, account])

  async function save() {
    setSaving(true)
    try {
      const res = await apiFetch<{ user: Partial<AccountDetail> }>(
        "/api/account",
        {
          method: "PATCH",
          body: JSON.stringify({ id: account.id, ...form }),
        }
      )
      onSaved(res.user)
      toast.success("Address updated.")
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update address.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile &amp; Contact</DialogTitle>
          <DialogDescription>
            Update your address, mobile number and blood group (optional).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Address Line</Label>
            <Input
              value={form.addressLine}
              onChange={(e) =>
                setForm((f) => ({ ...f, addressLine: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Landmark</Label>
            <Input
              value={form.landmark}
              onChange={(e) =>
                setForm((f) => ({ ...f, landmark: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input
                value={form.city}
                onChange={(e) =>
                  setForm((f) => ({ ...f, city: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input
                value={form.state}
                onChange={(e) =>
                  setForm((f) => ({ ...f, state: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Pincode</Label>
              <Input
                value={form.pincode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pincode: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mobile</Label>
              <Input
                value={form.mobile}
                onChange={(e) =>
                  setForm((f) => ({ ...f, mobile: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Droplet className="h-3.5 w-3.5 text-rose-500" />
              Blood Group <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Select
              value={form.bloodGroup || "NONE"}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, bloodGroup: v === "NONE" ? "" : v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select blood group (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">— Not specified —</SelectItem>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={save}
            disabled={saving}
          >
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────
//  Accounts tab
// ─────────────────────────────────────────────────────────
function AccountsTab({
  account,
  loading,
  onAccountUpdated,
  onLogout,
}: {
  account: AccountDetail | null
  loading: boolean
  onAccountUpdated: (patch: Partial<AccountDetail>) => void
  onLogout: () => void
}) {
  const user = useAuthStore((s) => s.user)
  const [addressOpen, setAddressOpen] = useState(false)
  const [upiInput, setUpiInput] = useState("")
  const [upiSaving, setUpiSaving] = useState(false)
  const [bioSaving, setBioSaving] = useState(false)

  async function linkUpi() {
    if (!upiInput.trim() && !account?.upiId) {
      toast.error("Enter a UPI ID to link.")
      return
    }
    setUpiSaving(true)
    try {
      const res = await apiFetch<{ user: Partial<AccountDetail> }>(
        "/api/account",
        {
          method: "PATCH",
          body: JSON.stringify({
            id: account?.id,
            upiId: upiInput.trim() || account?.upiId,
          }),
        }
      )
      onAccountUpdated(res.user)
      setUpiInput("")
      toast.success("UPI ID linked successfully.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to link UPI.")
    } finally {
      setUpiSaving(false)
    }
  }

  async function toggleBiometric(value: boolean) {
    setBioSaving(true)
    try {
      const res = await apiFetch<{ user: Partial<AccountDetail> }>(
        "/api/account",
        {
          method: "PATCH",
          body: JSON.stringify({
            id: account?.id,
            biometricEnrolled: value,
          }),
        }
      )
      onAccountUpdated(res.user)
      toast.success(
        value ? "Biometric enrollment enabled." : "Biometric enrollment disabled."
      )
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to update biometric setting."
      )
    } finally {
      setBioSaving(false)
    }
  }

  if (loading || !account) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  const insurance = account.insurance

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Account &amp; Settings"
        description="Manage your profile, payments, insurance and security."
      />

      {/* Profile card */}
      <SectionCard title="Profile" description="Your personal information" icon={Home}>
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-emerald-600 text-lg text-white">
              {account.name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold">{account.name}</p>
            <p className="text-sm text-muted-foreground">{account.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1">
                <Phone className="h-3 w-3" />
                {account.mobile}
              </Badge>
              {account.bloodGroup && (
                <Badge variant="secondary" className="gap-1">
                  <Droplet className="h-3 w-3" />
                  {account.bloodGroup}
                </Badge>
              )}
              {user?.role && (
                <Badge variant="outline">Patient Account</Badge>
              )}
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Pin className="h-3 w-3" /> Address
            </p>
            <p className="mt-1 text-sm">
              {account.addressLine}
              {account.landmark ? `, ${account.landmark}` : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              {account.city}, {account.state} {account.pincode}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <CreditCard className="h-3 w-3" /> Government ID
            </p>
            {account.govtIdNumber ? (
              <>
                <p className="mt-1 text-sm">
                  {account.govtIdType?.replace("_", " ") || "Aadhaar"}
                </p>
                <p className="font-mono text-sm text-muted-foreground">
                  {maskGovtId(account.govtIdNumber)}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground italic">
                Not provided — Aadhaar is verified when you book an appointment.
              </p>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => setAddressOpen(true)}
        >
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit Profile &amp; Contact
        </Button>
      </SectionCard>

      {/* UPI linking */}
      <SectionCard
        title="UPI Payments"
        description="Link your UPI ID for quick bill payments"
        icon={Wallet}
      >
        {account.upiId ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Linked UPI ID</p>
                  <p className="font-mono text-sm font-medium text-emerald-800">
                    {account.upiId}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                Active
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() =>
                  toast.info("Opening UPI payment app…", {
                    description: "Demo: Pay hospital bills via your linked UPI.",
                  })
                }
              >
                <CreditCard className="mr-1.5 h-4 w-4" />
                Pay Bill
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setUpiInput(account.upiId || "")
                  toast.info("Update your UPI ID below.")
                }}
              >
                Update UPI
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="yourname@bank"
                value={upiInput}
                onChange={(e) => setUpiInput(e.target.value)}
              />
              <Button
                onClick={linkUpi}
                disabled={upiSaving || !upiInput.trim()}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {upiSaving ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : null}
                Update
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              <Wallet className="h-5 w-5 text-muted-foreground" />
              No UPI ID linked yet. Link one to enable one-tap bill payments.
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="yourname@bank"
                value={upiInput}
                onChange={(e) => setUpiInput(e.target.value)}
              />
              <Button
                onClick={linkUpi}
                disabled={upiSaving || !upiInput.trim()}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {upiSaving ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : null}
                Link UPI
              </Button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Insurance */}
      <SectionCard
        title="Insurance Details"
        description="Your active health insurance policy"
        icon={Shield}
      >
        {insurance ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{insurance.providerName}</p>
                <p className="text-sm text-muted-foreground">
                  {insurance.insuranceType.replace("_", " ")} · Policy{" "}
                  <span className="font-mono">{insurance.policyNumber}</span>
                </p>
              </div>
              <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                <ShieldCheck className="mr-1 h-3 w-3" />
                Active
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Amount Covered</p>
                <p className="text-sm font-semibold">
                  ₹{insurance.amountCovered.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Annual Premium</p>
                <p className="text-sm font-semibold">
                  ₹{insurance.medicalPremium.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Premium Due</p>
                <p className="text-sm font-semibold">
                  {insurance.premiumDueDate
                    ? fmtDate(insurance.premiumDueDate)
                    : "—"}
                </p>
              </div>
            </div>
            {insurance.coverageDetails && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Coverage Details
                </p>
                <p className="mt-1 text-sm">{insurance.coverageDetails}</p>
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            icon={ShieldAlert}
            title="No insurance linked"
            description="Link a health insurance policy to track your coverage and premiums here."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast.info(
                    "Please contact your insurance provider or MediCare support to link a policy."
                  )
                }
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add Insurance
              </Button>
            }
          />
        )}
      </SectionCard>

      {/* Security & emergency */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Biometric Security"
          description="Enable biometric login for faster access"
          icon={Fingerprint}
        >
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Fingerprint className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Biometric Enrollment</p>
                <p className="text-xs text-muted-foreground">
                  {account.biometricEnrolled
                    ? "Enabled — fingerprint/face unlock active"
                    : "Disabled — use password to login"}
                </p>
              </div>
            </div>
            <Switch
              checked={account.biometricEnrolled}
              disabled={bioSaving}
              onCheckedChange={toggleBiometric}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Emergency Contact"
          description="Contact used in case of emergency"
          icon={Phone}
        >
          {account.emergencyName || account.emergencyMobile ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {account.emergencyName || "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {account.emergencyMobile || "—"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <Phone className="h-5 w-5" />
              No emergency contact on file. Contact support to add one.
            </div>
          )}
        </SectionCard>
      </div>

      {/* Logout */}
      <Card className="border-rose-200">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="font-medium text-rose-700">Sign out</p>
            <p className="text-sm text-muted-foreground">
              Log out of your MediCare Hub account on this device.
            </p>
          </div>
          <Button
            variant="outline"
            className="border-rose-300 text-rose-600 hover:bg-rose-50"
            onClick={onLogout}
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            Logout
          </Button>
        </CardContent>
      </Card>

      <AddressEditDialog
        account={account}
        open={addressOpen}
        onOpenChange={setAddressOpen}
        onSaved={onAccountUpdated}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
//  Main Patient Dashboard
// ─────────────────────────────────────────────────────────
export function PatientDashboard() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const updateUser = useAuthStore((s) => s.updateUser)

  const [activeTab, setActiveTab] = useState("home")
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loadingAppointments, setLoadingAppointments] = useState(true)
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(true)
  const [account, setAccount] = useState<AccountDetail | null>(null)
  const [loadingAccount, setLoadingAccount] = useState(true)
  const [myRatings, setMyRatings] = useState<Record<string, number>>({})

  const [bookOpen, setBookOpen] = useState(false)
  const [preselectedDoctor, setPreselectedDoctor] = useState<Doctor | null>(
    null
  )

  const fetchAppointments = useCallback(async () => {
    if (!user) return
    setLoadingAppointments(true)
    try {
      const res = await apiFetch<{ appointments: Appointment[] }>(
        `/api/appointments?userId=${user.id}&role=PATIENT`
      )
      setAppointments(res.appointments || [])
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to load appointments."
      )
    } finally {
      setLoadingAppointments(false)
    }
  }, [user])

  const fetchRecords = useCallback(async () => {
    if (!user) return
    setLoadingRecords(true)
    try {
      const res = await apiFetch<{ records: MedicalRecord[] }>(
        `/api/records?userId=${user.id}&role=PATIENT`
      )
      setRecords(res.records || [])
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to load medical records."
      )
    } finally {
      setLoadingRecords(false)
    }
  }, [user])

  const fetchAccount = useCallback(async () => {
    if (!user) return
    setLoadingAccount(true)
    try {
      const res = await apiFetch<{ account: AccountDetail }>(
        `/api/account?id=${user.id}`
      )
      setAccount(res.account)
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to load account details."
      )
    } finally {
      setLoadingAccount(false)
    }
  }, [user])

  const fetchMyRatings = useCallback(async () => {
    if (!user) return
    try {
      const res = await apiFetch<{ ratings: Array<{ toId: string; score: number }> }>(
        `/api/ratings?fromId=${user.id}`
      )
      const map: Record<string, number> = {}
      for (const r of res.ratings || []) {
        map[r.toId] = r.score
      }
      setMyRatings(map)
    } catch {
      // silent — ratings are optional
    }
  }, [user])

  useEffect(() => {
    fetchAppointments()
    fetchRecords()
    fetchAccount()
    fetchMyRatings()
  }, [fetchAppointments, fetchRecords, fetchAccount, fetchMyRatings])

  function handleBookDoctor(d: Doctor) {
    setPreselectedDoctor(d)
    setActiveTab("appointments")
    setBookOpen(true)
  }

  function handleBooked(_a: Appointment) {
    fetchAppointments()
  }

  function handleAccountUpdated(patch: Partial<AccountDetail>) {
    setAccount((prev) => (prev ? { ...prev, ...patch } : prev))
    // Sync relevant fields to the auth store
    updateUser({
      city: patch.city,
      state: patch.state,
      specialization: patch.specialization,
      mobile: patch.mobile,
      biometricEnrolled: patch.biometricEnrolled,
    })
  }

  // Build search items for the global command palette
  const searchItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [
      ...navItems.map((n) => ({
        id: `nav-${n.id}`,
        label: n.label,
        icon: n.icon,
        group: "Navigation",
        onSelect: () => setActiveTab(n.id),
      })),
      {
        id: "act-book",
        label: "Book New Appointment",
        subtitle: "Schedule a visit with a doctor",
        icon: CalendarPlus,
        group: "Quick Actions",
        onSelect: () => {
          setActiveTab("appointments")
          setBookOpen(true)
        },
      },
      {
        id: "act-scan",
        label: "Scan Prescription",
        subtitle: "AI-powered prescription reader",
        icon: ScanLine,
        group: "Quick Actions",
        onSelect: () => setActiveTab("records"),
      },
      {
        id: "act-summary",
        label: "Generate AI Health Summary",
        subtitle: "Get AI insights from your records",
        icon: Sparkles,
        group: "Quick Actions",
        onSelect: () => setActiveTab("home"),
      },
      {
        id: "act-upi",
        label: "Link UPI ID",
        subtitle: "Connect your UPI for payments",
        icon: CreditCard,
        group: "Quick Actions",
        onSelect: () => setActiveTab("accounts"),
      },
      {
        id: "act-export",
        label: "Export Medical Records",
        subtitle: "Download all records as PDF",
        icon: Download,
        group: "Quick Actions",
        onSelect: () => setActiveTab("records"),
      },
      {
        id: "act-vitals",
        label: "Log New Vitals",
        subtitle: "Record blood pressure, glucose, weight",
        icon: Activity,
        group: "Quick Actions",
        onSelect: () => setActiveTab("vitals"),
      },
      {
        id: "act-refill",
        label: "Request Prescription Refill",
        subtitle: "Ask your doctor for a medicine refill",
        icon: Pill,
        group: "Quick Actions",
        onSelect: () => setActiveTab("refills"),
      },
      {
        id: "act-lab",
        label: "Order Lab Test",
        subtitle: "Book diagnostic tests from partnered labs",
        icon: TestTube,
        group: "Quick Actions",
        onSelect: () => setActiveTab("labs"),
      },
      {
        id: "act-video",
        label: "Join Video Consultation",
        subtitle: "Telemedicine for confirmed appointments",
        icon: Video,
        group: "Quick Actions",
        onSelect: () => setActiveTab("telemedicine"),
      },
      {
        id: "act-goal",
        label: "Set Health Goal",
        subtitle: "Track steps, weight, BP, sleep & more",
        icon: Target,
        group: "Quick Actions",
        onSelect: () => setActiveTab("goals"),
      },
      {
        id: "act-med",
        label: "Add Medication Reminder",
        subtitle: "Daily medicine schedule & adherence",
        icon: Pill,
        group: "Quick Actions",
        onSelect: () => setActiveTab("medications"),
      },
      {
        id: "act-family",
        label: "Add Family Member",
        subtitle: "Manage health profiles for family",
        icon: Users,
        group: "Quick Actions",
        onSelect: () => setActiveTab("family"),
      },
      {
        id: "act-sos",
        label: "Emergency SOS",
        subtitle: "One-tap alert to emergency contacts",
        icon: Siren,
        group: "Quick Actions",
        onSelect: () => setActiveTab("emergency"),
      },
    ]

    // Recent doctors from appointments
    const doctorMap = new Map<string, { name: string; spec?: string }>()
    for (const a of appointments) {
      if (a.doctor?.id && !doctorMap.has(a.doctor.id)) {
        doctorMap.set(a.doctor.id, {
          name: a.doctor.name,
          spec: a.doctor.specialization || undefined,
        })
      }
    }
    for (const [id, info] of doctorMap) {
      items.push({
        id: `doc-${id}`,
        label: doctorName(info.name),
        subtitle: info.spec || "Specialist",
        icon: Stethoscope,
        group: "Recent Doctors",
        keywords: info.name,
        onSelect: () => setActiveTab("appointments"),
      })
    }

    return items
  }, [appointments])

  if (!user) return null

  return (
    <DashboardShell
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      searchItems={searchItems}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === "home" && (
            <HomeTab
              account={account}
              appointments={appointments}
              records={records}
              onBookDoctor={handleBookDoctor}
              onSwitchTab={setActiveTab}
            />
          )}
          {activeTab === "appointments" && (
            <AppointmentsTab
              user={user}
              appointments={appointments}
              loading={loadingAppointments}
              account={account}
              bookOpen={bookOpen}
              onBookOpenChange={(v) => {
                setBookOpen(v)
                if (!v) setPreselectedDoctor(null)
              }}
              preselectedDoctor={preselectedDoctor}
              onBooked={handleBooked}
              myRatings={myRatings}
              onRatingsUpdate={(doctorId, score) =>
                setMyRatings((prev) => ({ ...prev, [doctorId]: score }))
              }
              onRefresh={fetchAppointments}
            />
          )}
          {activeTab === "records" && (
            <RecordsTab
              records={records}
              loading={loadingRecords}
              patientName={user.name}
            />
          )}
          {activeTab === "vitals" && <VitalsTracker />}
          {activeTab === "ai-insights" && <AIVitalsInsights onSwitchTab={setActiveTab} />}
          {activeTab === "refills" && <RefillRequests role="PATIENT" />}
          {activeTab === "quick-refill" && <RefillFromRecord />}
          {activeTab === "labs" && <LabOrders role="PATIENT" />}
          {activeTab === "lab-catalog" && <LabCatalogManager role="PATIENT" />}
          {activeTab === "telemedicine" && <Telemedicine role="PATIENT" />}
          {activeTab === "reminders" && <AppointmentReminders role="PATIENT" />}
          {activeTab === "messages" && <Messaging role="PATIENT" />}
          {activeTab === "family" && <FamilyMembers />}
          {activeTab === "medications" && <MedicationSchedule />}
          {activeTab === "emergency" && <EmergencySOS />}
          {activeTab === "goals" && <HealthGoals />}
          {activeTab === "patient-qr" && <PatientQr />}
          {activeTab === "doctor-directory" && (
            <DoctorDirectory
              onBookAppointment={(doctorId) => {
                setPreselectedDoctor(doctorId)
                setBookOpen(true)
                setActiveTab("appointments")
              }}
            />
          )}
          {activeTab === "insurance-directory" && <InsuranceDirectory />}
          {activeTab === "bmi" && <BmiTracker />}
          {activeTab === "menstrual" && <MenstrualTracker />}
          {activeTab === "voice-record" && (
            <VoiceRecord
              onConvertToRecord={() => setActiveTab("records")}
              onEmergency={() => setActiveTab("emergency")}
            />
          )}
          {activeTab === "accounts" && (
            <AccountsTab
              account={account}
              loading={loadingAccount}
              onAccountUpdated={handleAccountUpdated}
              onLogout={logout}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </DashboardShell>
  )
}
