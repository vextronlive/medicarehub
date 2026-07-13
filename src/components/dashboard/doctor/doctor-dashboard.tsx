"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import ReactMarkdown from "react-markdown"
import { format, isToday, parseISO, subDays, isAfter } from "date-fns"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts"

import { useAuthStore, type SessionUser } from "@/lib/auth-store"
import { apiFetch } from "@/lib/api"
import { DashboardShell, type NavItem, type SearchItem } from "@/components/dashboard/shell"
import RefillRequests from "@/components/dashboard/features/refill-requests"
import LabOrders from "@/components/dashboard/features/lab-orders"
import Telemedicine from "@/components/dashboard/features/telemedicine"
import PdfExport from "@/components/dashboard/features/pdf-export"
import LabCatalogManager from "@/components/dashboard/features/lab-catalog-manager"
import AppointmentReminders from "@/components/dashboard/features/appointment-reminders"
import Messaging from "@/components/dashboard/features/messaging"
import PatientOverview from "@/components/dashboard/features/patient-overview"
import PatientQr from "@/components/dashboard/features/patient-qr"
import NlpRecordBuilder from "@/components/dashboard/features/nlp-record-builder"
import DoctorDirectory from "@/components/dashboard/features/doctor-directory"
import InsuranceDirectory from "@/components/dashboard/features/insurance-directory"
import CapacitySlots from "@/components/dashboard/features/capacity-slots"
import {
  StatCard,
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
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn, doctorName } from "@/lib/utils"
import { toast } from "sonner"

import {
  LayoutDashboard,
  Calendar,
  FileText,
  Brain,
  Settings,
  Loader2,
  Plus,
  Users,
  UserPlus,
  Stethoscope,
  Activity,
  ClipboardList,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  Ticket,
  Phone,
  Droplet,
  Lock,
  ChevronDown,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Handshake,
  CreditCard,
  Fingerprint,
  LogOut,
  Pencil,
  ShieldCheck,
  Shield,
  ScanLine,
  Wallet,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRightLeft,
  MapPin,
  Star,
  CalendarDays,
  UserRound,
  Trash2,
  FileImage,
  Pill,
  TestTube,
  Video,
  MessageSquare,
  type LucideIcon,
} from "lucide-react"

// ─────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────
interface Patient {
  id: string
  name: string
  mobile: string
  bloodGroup?: string | null
}

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
  patient: Patient
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
  patient: Patient
  doctor: { id: string; name: string; specialization?: string | null }
  org?: { id: string; name: string; city?: string | null } | null
}

interface Referral {
  id: string
  patientName: string
  purpose: string
  commission: number
  status: string
  createdAt?: string
  from: { id: string; name: string; city?: string | null; specialization?: string | null }
  to: { id: string; name: string; city?: string | null; specialization?: string | null }
}

interface Partnership {
  id: string
  orgId: string
  clinicId: string
  clinicType: string
  commissionRate: number
  rating: number
  status: string
  createdAt?: string
  clinic: {
    id: string
    name: string
    city?: string | null
    addressLine?: string | null
  }
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
  specialization?: string | null
  biometricEnrolled: boolean
  upiId?: string | null
  membershipNumber?: string | null
  bedCount?: number | null
  capacityPerHour?: number | null
}

// ─────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────
const VISIT_TYPES = [
  "CONSULTATION",
  "EMERGENCY",
  "FOLLOW_UP",
  "CHECKUP",
  "PROCEDURE",
] as const
type VisitType = (typeof VISIT_TYPES)[number]

const SPECIALIZATIONS = [
  "General Medicine",
  "Cardiology",
  "Endocrinology",
  "Pulmonology",
  "Orthopedics",
  "Dermatology",
  "Neurology",
  "Others",
]

const VISIT_BADGE: Record<string, string> = {
  CONSULTATION: "bg-sky-50 text-sky-700 ring-sky-600/20",
  EMERGENCY: "bg-rose-50 text-rose-700 ring-rose-600/20",
  FOLLOW_UP: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CHECKUP: "bg-teal-50 text-teal-700 ring-teal-600/20",
  PROCEDURE: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20",
}

const VISIT_DOT: Record<string, string> = {
  CONSULTATION: "bg-sky-500",
  EMERGENCY: "bg-rose-500",
  FOLLOW_UP: "bg-emerald-500",
  CHECKUP: "bg-teal-500",
  PROCEDURE: "bg-fuchsia-500",
}

const VISIT_BAR_COLOR: Record<string, string> = {
  CONSULTATION: "#0ea5e9",
  EMERGENCY: "#f43f5e",
  FOLLOW_UP: "#10b981",
  CHECKUP: "#14b8a6",
  PROCEDURE: "#d946ef",
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
  CONFIRMED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  COMPLETED: "bg-slate-100 text-slate-700 ring-slate-600/20",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-600/20",
}

const REFERRAL_STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  PAID: "bg-teal-50 text-teal-700 ring-teal-600/20",
}

const navItems: NavItem[] = [
  { id: "home", label: "Home", icon: LayoutDashboard },
  { id: "patient-overview", label: "Patient Overview", icon: Users },
  { id: "appointments", label: "Appointments", icon: Calendar },
  { id: "reminders", label: "Reminders", icon: CalendarClock },
  { id: "records", label: "View & Create Records", icon: FileText },
  { id: "refills", label: "Refill Requests", icon: Pill },
  { id: "labs", label: "Lab Orders", icon: TestTube },
  { id: "lab-catalog", label: "Test Catalog", icon: TestTube },
  { id: "telemedicine", label: "Video Visit", icon: Video },
  { id: "insights", label: "AI Insights", icon: Brain },
  { id: "pdf-export", label: "PDF Export", icon: FileText },
  { id: "messages", label: "Messages", icon: MessageSquare },
  // MoM points — new tabs for doctors
  { id: "patient-qr", label: "Scan Patient QR", icon: ScanLine },
  { id: "nlp-record", label: "AI Record Builder", icon: Sparkles },
  { id: "capacity-slots", label: "Capacity Slots", icon: CalendarClock },
  { id: "doctor-directory", label: "Doctor Directory", icon: Stethoscope },
  { id: "insurance-directory", label: "Insurance Dir", icon: Shield },
  { id: "accounts", label: "Accounts", icon: Settings },
]

const PERIODS = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
  { id: "all", label: "All time", days: 0 },
] as const

// ─────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────
interface Medicine {
  medicine?: string
  dose?: string
  frequency?: string
  duration?: string
}

function parsePrescription(raw: string): Medicine[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as Medicine[]
    if (typeof parsed === "string") return [{ medicine: parsed }]
    return []
  } catch {
    return [{ medicine: raw }]
  }
}

function parseAttachments(raw: string): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function maskGovtId(id?: string | null): string {
  if (!id) return "—"
  if (id.length <= 4) return "•".repeat(id.length)
  return "•".repeat(Math.max(4, id.length - 4)) + id.slice(-4)
}

function fmtDate(d: string | Date, pattern = "dd MMM yyyy"): string {
  try {
    const date = typeof d === "string" ? parseISO(d) : d
    return format(date, pattern)
  } catch {
    return String(d)
  }
}

function fmtDateTime(d: string | Date): string {
  return fmtDate(d, "dd MMM yyyy, h:mm a")
}

// ─────────────────────────────────────────────────────────
//  Small UI helpers
// ─────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        STATUS_BADGE[status] || "bg-slate-100 text-slate-700 ring-slate-600/20"
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  )
}

function VisitBadge({ type }: { type: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        VISIT_BADGE[type] || "bg-slate-100 text-slate-700 ring-slate-600/20"
      )}
    >
      {type.replace("_", " ")}
    </span>
  )
}

function EncryptedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
      <Lock className="h-3 w-3" />
      Encrypted
    </span>
  )
}

function QuickActionButton({
  icon: Icon,
  label,
  onClick,
  color,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  color: string
}) {
  return (
    <button
      onClick={onClick}
      className="flex min-w-[88px] flex-col items-center gap-2 rounded-2xl border border-border bg-white p-3 text-center transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full text-white",
          color
        )}
      >
        <Icon className="h-6 w-6" />
      </div>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </button>
  )
}

// ─────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────
export function DoctorDashboard() {
  const user = useAuthStore((s) => s.user)
  const [activeTab, setActiveTab] = useState("home")

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [referralsGiven, setReferralsGiven] = useState<Referral[]>([])
  const [referralsReceived, setReferralsReceived] = useState<Referral[]>([])
  const [partnerships, setPartnerships] = useState<Partnership[]>([])
  const [account, setAccount] = useState<AccountDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Dialog control shared across tabs (quick actions)
  const [referralOpen, setReferralOpen] = useState(false)
  const [recordOpen, setRecordOpen] = useState(false)

  const loadAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [apptRes, recRes, refG, refR, partRes, accRes] = await Promise.all([
        apiFetch<{ appointments: Appointment[] }>(
          `/api/appointments?userId=${user.id}&role=DOCTOR`
        ),
        apiFetch<{ records: MedicalRecord[] }>(
          `/api/records?userId=${user.id}&role=DOCTOR`
        ),
        apiFetch<{ referrals: Referral[] }>(
          `/api/referrals?userId=${user.id}&direction=given`
        ),
        apiFetch<{ referrals: Referral[] }>(
          `/api/referrals?userId=${user.id}&direction=received`
        ),
        apiFetch<{ partnerships: Partnership[] }>(
          `/api/partnerships?orgId=${user.id}`
        ),
        apiFetch<{ account: AccountDetail }>(`/api/account?id=${user.id}`),
      ])
      setAppointments(apptRes.appointments || [])
      setRecords(recRes.records || [])
      setReferralsGiven(refG.referrals || [])
      setReferralsReceived(refR.referrals || [])
      setPartnerships(partRes.partnerships || [])
      setAccount(accRes.account || null)
    } catch (e) {
      toast.error("Failed to load data", {
        description: (e as Error).message,
      })
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Patients derived from BOTH records and appointments (so doctor can create records even for booked patients without records yet)
  const allPatients: Patient[] = useMemo(() => {
    const map = new Map<string, Patient>()
    for (const r of records) {
      if (r.patient?.id) map.set(r.patient.id, r.patient)
    }
    for (const a of appointments) {
      if (a.patient?.id) map.set(a.patient.id, a.patient)
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [records, appointments])

  if (!user) return null

  const searchItems: SearchItem[] = [
    ...navItems.map((n) => ({
      id: `nav-${n.id}`,
      label: n.label,
      icon: n.icon,
      group: "Navigation",
      onSelect: () => setActiveTab(n.id),
    })),
    {
      id: "act-record",
      label: "Create New Record",
      subtitle: "Add an encrypted medical record",
      icon: Plus,
      group: "Quick Actions",
      onSelect: () => { setActiveTab("records"); setRecordOpen(true) },
    },
    {
      id: "act-referral",
      label: "New Referral",
      subtitle: "Refer a patient to a colleague",
      icon: UserPlus,
      group: "Quick Actions",
      onSelect: () => { setActiveTab("home"); setReferralOpen(true) },
    },
    {
      id: "act-insights",
      label: "Generate AI Insights",
      subtitle: "Analyze your practice data with AI",
      icon: Brain,
      group: "Quick Actions",
      onSelect: () => setActiveTab("insights"),
    },
    ...allPatients.slice(0, 8).map((p) => ({
      id: `pat-${p.id}`,
      label: p.name,
      subtitle: p.bloodGroup ? `Blood: ${p.bloodGroup}` : "Patient",
      icon: Users,
      group: "Recent Patients",
      keywords: p.name,
      onSelect: () => setActiveTab("records"),
    })),
  ]

  return (
    <DashboardShell navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab} searchItems={searchItems}>
      <NewReferralDialog
        open={referralOpen}
        onOpenChange={setReferralOpen}
        doctorId={user.id}
        onSaved={() => {
          setReferralOpen(false)
          loadAll()
        }}
      />
      <NewRecordDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
        user={user}
        patients={allPatients}
        onSaved={() => {
          setRecordOpen(false)
          loadAll()
        }}
      />

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
              user={user}
              loading={loading}
              appointments={appointments}
              records={records}
              referralsGiven={referralsGiven}
              referralsReceived={referralsReceived}
              onNavigate={setActiveTab}
              onOpenReferral={() => setReferralOpen(true)}
              onOpenRecord={() => setRecordOpen(true)}
            />
          )}
          {activeTab === "patient-overview" && <PatientOverview />}
          {activeTab === "appointments" && (
            <AppointmentsTab
              loading={loading}
              appointments={appointments}
              onRefresh={loadAll}
            />
          )}
          {activeTab === "records" && (
            <RecordsTab
              user={user}
              loading={loading}
              records={records}
              onRefresh={loadAll}
              onOpenRecord={() => setRecordOpen(true)}
              patients={allPatients}
            />
          )}
          {activeTab === "refills" && <RefillRequests role="DOCTOR" />}
          {activeTab === "labs" && <LabOrders role="DOCTOR" />}
          {activeTab === "lab-catalog" && <LabCatalogManager role="DOCTOR" />}
          {activeTab === "telemedicine" && <Telemedicine role="DOCTOR" />}
          {activeTab === "reminders" && <AppointmentReminders role="DOCTOR" />}
          {activeTab === "insights" && <InsightsTab records={records} />}
          {activeTab === "pdf-export" && <PdfExport role="DOCTOR" />}
          {activeTab === "messages" && <Messaging role="DOCTOR" />}
          {activeTab === "patient-qr" && <PatientQr />}
          {activeTab === "capacity-slots" && <CapacitySlots />}
          {activeTab === "nlp-record" && (
            <NlpRecordBuilder
              onSaveRecord={async (record) => {
                try {
                  await apiFetch("/api/records", {
                    method: "POST",
                    body: JSON.stringify({
                      patientId: record.patientId || "",
                      doctorId: user?.id,
                      orgId: null,
                      visitType: record.visitType,
                      clinicName: "NLP Builder",
                      practitionerName: user?.name || "Doctor",
                      specialization: user?.specialization || "General Medicine",
                      diagnosis: record.diagnosis,
                      doctorsNotes: record.doctorsNotes,
                      prescription: JSON.stringify(record.prescription || []),
                      attachments: "[]",
                      visitDate: new Date().toISOString(),
                    }),
                  })
                  toast.success("Medical record created from AI draft")
                  setActiveTab("records")
                } catch (e) {
                  toast.error("Failed to save record: " + (e as Error).message)
                }
              }}
            />
          )}
          {activeTab === "doctor-directory" && <DoctorDirectory />}
          {activeTab === "insurance-directory" && <InsuranceDirectory />}
          {activeTab === "accounts" && (
            <AccountsTab
              user={user}
              account={account}
              loading={loading}
              partnerships={partnerships}
              onRefresh={loadAll}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </DashboardShell>
  )
}

// ─────────────────────────────────────────────────────────
//  HOME TAB
// ─────────────────────────────────────────────────────────
function HomeTab({
  user,
  loading,
  appointments,
  records,
  referralsGiven,
  referralsReceived,
  onNavigate,
  onOpenReferral,
  onOpenRecord,
}: {
  user: SessionUser
  loading: boolean
  appointments: Appointment[]
  records: MedicalRecord[]
  referralsGiven: Referral[]
  referralsReceived: Referral[]
  onNavigate: (id: string) => void
  onOpenReferral: () => void
  onOpenRecord: () => void
}) {
  const today = new Date()

  const todaysAppts = appointments.filter(
    (a) => isToday(parseISO(a.scheduledAt)) && a.status !== "CANCELLED"
  )
  const distinctPatients = useMemo(() => {
    const map = new Map<string, Patient>()
    for (const r of records) if (r.patient?.id) map.set(r.patient.id, r.patient)
    return Array.from(map.values())
  }, [records])

  const pendingCount = appointments.filter((a) => a.status === "PENDING").length
  const totalReferrals = referralsGiven.length + referralsReceived.length

  // Recently visited patients: dedupe by id, sort by visitDate desc
  const recentPatients = useMemo(() => {
    const map = new Map<
      string,
      { patient: Patient; lastVisit: string; visitType: string }
    >()
    for (const r of records) {
      if (!r.patient?.id) continue
      const existing = map.get(r.patient.id)
      if (!existing || parseISO(r.visitDate) > parseISO(existing.lastVisit)) {
        map.set(r.patient.id, {
          patient: r.patient,
          lastVisit: r.visitDate,
          visitType: r.visitType,
        })
      }
    }
    return Array.from(map.values())
      .sort((a, b) => parseISO(b.lastVisit).getTime() - parseISO(a.lastVisit).getTime())
      .slice(0, 6)
  }, [records])

  return (
    <div className="space-y-6">
      {/* Hero header banner */}
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
                <Stethoscope className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm">
                Doctor Dashboard
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome, {doctorName(user.name)}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {user.specialization && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">
                  <Stethoscope className="h-3 w-3" />
                  {user.specialization}
                </span>
              )}
              <span className="text-sm text-emerald-50/90">
                {format(today, "EEEE, dd MMMM yyyy")}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
              <Lock className="h-3.5 w-3.5" />
              <span>Encrypted Records</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
              <Activity className="h-3.5 w-3.5" />
              <span>AI-Assisted</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <Card>
        <CardContent className="p-5">
          <div className="flex gap-3 overflow-x-auto pb-1">
            <QuickActionButton
              icon={FileText}
              label="New Record"
              color="bg-emerald-600"
              onClick={onOpenRecord}
            />
            <QuickActionButton
              icon={Users}
              label="Patients"
              color="bg-teal-600"
              onClick={() => onNavigate("records")}
            />
            <QuickActionButton
              icon={UserPlus}
              label="Referral"
              color="bg-fuchsia-600"
              onClick={onOpenReferral}
            />
            <QuickActionButton
              icon={CalendarClock}
              label="Bookings"
              color="bg-amber-500"
              onClick={() => onNavigate("appointments")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              title="Today's Appointments"
              value={todaysAppts.length}
              icon={CalendarCheck}
              trend={
                todaysAppts.length
                  ? `${todaysAppts.filter((a) => a.status === "CONFIRMED").length} confirmed`
                  : "No appointments today"
              }
              color="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              title="Total Patients"
              value={distinctPatients.length}
              icon={Users}
              trend="Distinct patients in records"
              color="bg-teal-50 text-teal-600"
            />
            <StatCard
              title="Pending Confirmations"
              value={pendingCount}
              icon={CalendarClock}
              trend={
                pendingCount
                  ? "Awaiting your action"
                  : "All caught up"
              }
              color="bg-amber-50 text-amber-600"
            />
            <StatCard
              title="Total Referrals"
              value={totalReferrals}
              icon={ArrowRightLeft}
              trend={`${referralsGiven.length} given · ${referralsReceived.length} received`}
              color="bg-fuchsia-50 text-fuchsia-600"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recently visited patients */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Recently Visited Patients</CardTitle>
                <CardDescription>
                  Latest patients from your medical records
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("records")}
              >
                View all
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : recentPatients.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={Users}
                  title="No patients yet"
                  description="Create your first medical record to see recently visited patients here."
                  action={
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      size="sm"
                      onClick={onOpenRecord}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      New Record
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y">
                {recentPatients.map(({ patient, lastVisit, visitType }) => (
                  <div
                    key={patient.id}
                    className="flex items-center gap-3 px-5 py-3 transition hover:bg-muted/40"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-emerald-100 text-emerald-700">
                        {patient.name
                          .split(" ")
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{patient.name}</p>
                        {patient.bloodGroup && (
                          <Badge
                            variant="outline"
                            className="bg-rose-50 text-rose-700"
                          >
                            <Droplet className="h-3 w-3" />
                            {patient.bloodGroup}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Last visit {fmtDate(lastVisit)}
                      </p>
                    </div>
                    <VisitBadge type={visitType} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Patients recorded mini-list */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Patients Recorded</CardTitle>
            <CardDescription>Across all your records</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : distinctPatients.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No records"
                description="You haven't created any medical records yet."
              />
            ) : (
              <>
                <div className="mb-3 text-3xl font-bold text-emerald-700">
                  {distinctPatients.length}
                </div>
                <Separator className="mb-3" />
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {distinctPatients.slice(0, 8).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{p.name}</span>
                      {p.bloodGroup && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {p.bloodGroup}
                        </span>
                      )}
                    </div>
                  ))}
                  {distinctPatients.length > 8 && (
                    <p className="pt-1 text-center text-xs text-muted-foreground">
                      +{distinctPatients.length - 8} more
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Referrals (GPay-style) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Referrals</CardTitle>
              <CardDescription>
                Patients you've referred and referrals you've received
              </CardDescription>
            </div>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              size="sm"
              onClick={onOpenReferral}
            >
              <Plus className="mr-1 h-4 w-4" />
              New Referral
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
          ) : referralsGiven.length === 0 && referralsReceived.length === 0 ? (
            <EmptyState
              icon={ArrowRightLeft}
              title="No referrals yet"
              description="Refer patients to specialists and earn commissions on completed referrals."
              action={
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  size="sm"
                  onClick={onOpenReferral}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  New Referral
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <ReferralList
                title="Given"
                icon={ArrowRightLeft}
                referrals={referralsGiven}
                emptyText="You haven't referred any patients yet."
                direction="given"
              />
              <ReferralList
                title="Received"
                icon={UserPlus}
                referrals={referralsReceived}
                emptyText="No referrals received yet."
                direction="received"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ReferralList({
  title,
  icon: Icon,
  referrals,
  emptyText,
  direction,
}: {
  title: string
  icon: LucideIcon
  referrals: Referral[]
  emptyText: string
  direction: "given" | "received"
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-fuchsia-100 text-fuchsia-700">
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant="secondary" className="ml-auto">
          {referrals.length}
        </Badge>
      </div>
      {referrals.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {referrals.map((r) => {
            const counterpart = direction === "given" ? r.to : r.from
            return (
              <div
                key={r.id}
                className="rounded-lg border bg-white p-3 text-sm shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.patientName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {direction === "given" ? "To" : "From"}:{" "}
                      <span className="font-medium text-foreground">
                        {counterpart.name}
                      </span>
                      {counterpart.specialization && ` · ${counterpart.specialization}`}
                    </p>
                    {r.purpose && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {r.purpose}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                      REFERRAL_STATUS_BADGE[r.status] ||
                        "bg-slate-100 text-slate-700 ring-slate-600/20"
                    )}
                  >
                    {r.status}
                  </span>
                </div>
                {r.commission > 0 && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700">
                    <Wallet className="h-3 w-3" />
                    Commission ₹{r.commission.toLocaleString("en-IN")}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
//  APPOINTMENTS TAB
// ─────────────────────────────────────────────────────────
function AppointmentsTab({
  loading,
  appointments,
  onRefresh,
}: {
  loading: boolean
  appointments: Appointment[]
  onRefresh: () => void
}) {
  const [activeSub, setActiveSub] = useState("pending")
  const [updating, setUpdating] = useState<string | null>(null)

  const pending = appointments.filter((a) => a.status === "PENDING")
  const confirmed = appointments.filter((a) => a.status === "CONFIRMED")
  const completed = appointments.filter((a) => a.status === "COMPLETED")

  const updateStatus = async (id: string, status: string, label: string) => {
    setUpdating(id)
    try {
      await apiFetch("/api/appointments", {
        method: "PATCH",
        body: JSON.stringify({ id, status }),
      })
      toast.success(`Appointment ${label.toLowerCase()}`)
      onRefresh()
    } catch (e) {
      toast.error(`Failed to ${label.toLowerCase()} appointment`, {
        description: (e as Error).message,
      })
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Appointments"
        description="Manage patient bookings — confirm, complete, or decline."
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title="No appointments yet"
          description="When patients book appointments with you, they will appear here for confirmation."
        />
      ) : (
        <Tabs value={activeSub} onValueChange={setActiveSub}>
          <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="pending" className="gap-1.5">
              Pending to be confirmed
              {pending.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 bg-amber-100 text-amber-700"
                >
                  {pending.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="confirmed" className="gap-1.5">
              Confirmed
              {confirmed.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 bg-emerald-100 text-emerald-700"
                >
                  {confirmed.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-1.5">
              Completed
              {completed.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {completed.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            {pending.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="No pending appointments"
                description="All appointment requests have been actioned."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {pending.map((a) => (
                  <AppointmentCard
                    key={a.id}
                    appt={a}
                    updating={updating === a.id}
                    actions={
                      <>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() =>
                            updateStatus(a.id, "CONFIRMED", "Confirmed")
                          }
                        >
                          <CheckCircle2 className="mr-1 h-4 w-4" />
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() =>
                            updateStatus(a.id, "CANCELLED", "Declined")
                          }
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Decline
                        </Button>
                      </>
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="confirmed" className="mt-4">
            {confirmed.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="No confirmed appointments"
                description="Confirmed upcoming appointments will appear here."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {confirmed.map((a) => (
                  <AppointmentCard
                    key={a.id}
                    appt={a}
                    updating={updating === a.id}
                    actions={
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() =>
                          updateStatus(a.id, "COMPLETED", "Marked completed")
                        }
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Mark Completed
                      </Button>
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            {completed.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No completed appointments"
                description="Completed appointments will appear here for your reference."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {completed.map((a) => (
                  <AppointmentCard key={a.id} appt={a} updating={false} actions={null} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function AppointmentCard({
  appt,
  updating,
  actions,
}: {
  appt: Appointment
  updating: boolean
  actions: React.ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              <AvatarFallback className="bg-emerald-100 text-emerald-700">
                {appt.patient.name
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold leading-tight">{appt.patient.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {appt.patient.mobile}
                </span>
                {appt.patient.bloodGroup && (
                  <span className="inline-flex items-center gap-1 text-rose-600">
                    <Droplet className="h-3 w-3" />
                    {appt.patient.bloodGroup}
                  </span>
                )}
              </div>
            </div>
          </div>
          <StatusBadge status={appt.status} />
        </div>

        <Separator className="my-3" />

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Scheduled</p>
            <p className="font-medium">{fmtDateTime(appt.scheduledAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Token #</p>
            {appt.tokenNumber ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-bold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                <Ticket className="h-3.5 w-3.5" />
                {appt.tokenNumber}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>

        {appt.reason && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">Reason</p>
            <p className="text-sm">{appt.reason}</p>
          </div>
        )}
        {appt.notes && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground">Notes</p>
            <p className="text-sm">{appt.notes}</p>
          </div>
        )}

        {actions && (
          <div className="mt-4 flex flex-wrap gap-2">
            {updating ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              actions
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────
//  RECORDS TAB
// ─────────────────────────────────────────────────────────
function RecordsTab({
  user,
  loading,
  records,
  onRefresh,
  onOpenRecord,
  patients,
}: {
  user: SessionUser
  loading: boolean
  records: MedicalRecord[]
  onRefresh: () => void
  onOpenRecord: () => void
  patients: Patient[]
}) {
  const [filter, setFilter] = useState<string>("ALL")
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (filter === "ALL") return records
    return records.filter((r) => r.visitType === filter)
  }, [records, filter])

  return (
    <div className="space-y-6">
      <SectionHeader
        title="View & Create Records"
        description="Encrypted medical records for your patients."
        action={
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={onOpenRecord}
            disabled={patients.length === 0}
          >
            <Plus className="mr-1 h-4 w-4" />
            Create New Record
          </Button>
        }
      />

      {patients.length === 0 && (
        <Alert>
          <AlertTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            No patients in your records yet
          </AlertTitle>
          <AlertDescription>
            To create a medical record, you first need a patient. Ask a patient
            to book an appointment with you — once they appear in your
            appointments, you can create records for them.
          </AlertDescription>
        </Alert>
      )}

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Filter by visit type:</span>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {VISIT_TYPES.map((v) => (
              <SelectItem key={v} value={v}>
                {v.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="ml-auto">
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No records found"
          description={
            filter === "ALL"
              ? "Create your first medical record to get started."
              : "No records match this visit type."
          }
          action={
            filter === "ALL" && patients.length > 0 ? (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={onOpenRecord}
              >
                <Plus className="mr-1 h-4 w-4" />
                Create New Record
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <RecordCard
              key={r.id}
              record={r}
              expanded={expanded === r.id}
              onToggle={() =>
                setExpanded((prev) => (prev === r.id ? null : r.id))
              }
              doctorName={user.name}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RecordCard({
  record,
  expanded,
  onToggle,
  doctorName,
}: {
  record: MedicalRecord
  expanded: boolean
  onToggle: () => void
  doctorName: string
}) {
  const meds = parsePrescription(record.prescription)
  const files = parseAttachments(record.attachments)

  return (
    <Card>
      <CardContent className="p-5">
        <button
          onClick={onToggle}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-1 flex h-10 w-10 items-center justify-center rounded-full text-white",
                VISIT_DOT[record.visitType] || "bg-slate-400"
              )}
            >
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{record.patient.name}</p>
                <VisitBadge type={record.visitType} />
                <EncryptedBadge />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {fmtDate(record.visitDate)} · {record.clinicName}
                {record.practitionerName &&
                  record.practitionerName !== doctorName &&
                  ` · ${record.practitionerName}`}
              </p>
              {record.diagnosis && (
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Dx:</span>{" "}
                  {record.diagnosis}
                </p>
              )}
            </div>
          </div>
          {expanded ? (
            <ChevronDown className="mt-2 h-5 w-5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.18 }}
            className="mt-4 space-y-3 border-t pt-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem
                label="Specialization"
                value={record.specialization || "—"}
              />
              <DetailItem
                label="Patient mobile"
                value={record.patient.mobile}
              />
              {record.patient.bloodGroup && (
                <DetailItem
                  label="Blood group"
                  value={record.patient.bloodGroup}
                  icon={<Droplet className="h-3 w-3 text-rose-500" />}
                />
              )}
              <DetailItem
                label="Visit date"
                value={fmtDateTime(record.visitDate)}
              />
            </div>

            {record.diagnosis && (
              <DetailBlock label="Diagnosis / Findings" value={record.diagnosis} />
            )}
            {record.doctorsNotes && (
              <DetailBlock label="Doctor's Notes" value={record.doctorsNotes} />
            )}

            {meds.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Prescription
                </p>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Medicine</th>
                        <th className="px-3 py-2 text-left font-medium">Dose</th>
                        <th className="px-3 py-2 text-left font-medium">Frequency</th>
                        <th className="px-3 py-2 text-left font-medium">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {meds.map((m, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-medium">
                            {m.medicine || "—"}
                          </td>
                          <td className="px-3 py-2">{m.dose || "—"}</td>
                          <td className="px-3 py-2">{m.frequency || "—"}</td>
                          <td className="px-3 py-2">{m.duration || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {files.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Attachments
                </p>
                <div className="flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                    >
                      <FileImage className="h-3 w-3" />
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}

function DetailItem({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-medium">
        {icon}
        {value}
      </p>
    </div>
  )
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">
        {value}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
//  NEW RECORD DIALOG
// ─────────────────────────────────────────────────────────
function NewRecordDialog({
  open,
  onOpenChange,
  user,
  patients,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  user: SessionUser
  patients: Patient[]
  onSaved: () => void
}) {
  const [patientId, setPatientId] = useState("")
  const [visitType, setVisitType] = useState<VisitType>("CONSULTATION")
  const [clinicName, setClinicName] = useState("")
  const [practitionerName, setPractitionerName] = useState(user.name)
  const [specialization, setSpecialization] = useState(
    user.specialization || "General Medicine"
  )
  const [otherSpec, setOtherSpec] = useState("")
  const [diagnosis, setDiagnosis] = useState("")
  const [doctorsNotes, setDoctorsNotes] = useState("")
  const [visitDate, setVisitDate] = useState(
    new Date().toISOString().slice(0, 16)
  )
  const [meds, setMeds] = useState<Medicine[]>([
    { medicine: "", dose: "", frequency: "", duration: "" },
  ])
  const [attachments, setAttachments] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setPatientId("")
      setVisitType("CONSULTATION")
      setClinicName("")
      setPractitionerName(user.name)
      setSpecialization(user.specialization || "General Medicine")
      setOtherSpec("")
      setDiagnosis("")
      setDoctorsNotes("")
      setVisitDate(new Date().toISOString().slice(0, 16))
      setMeds([{ medicine: "", dose: "", frequency: "", duration: "" }])
      setAttachments([])
    }
  }, [open, user.name, user.specialization])

  const addMed = () =>
    setMeds((m) => [...m, { medicine: "", dose: "", frequency: "", duration: "" }])
  const removeMed = (idx: number) =>
    setMeds((m) => m.filter((_, i) => i !== idx))
  const updateMed = (idx: number, key: keyof Medicine, val: string) =>
    setMeds((m) =>
      m.map((row, i) => (i === idx ? { ...row, [key]: val } : row))
    )

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachments(files.map((f) => f.name))
  }

  const handleSubmit = async () => {
    if (!patientId) {
      toast.error("Please select a patient")
      return
    }
    if (!clinicName.trim()) {
      toast.error("Clinic / organisation name is required")
      return
    }
    if (!visitType || !practitionerName.trim()) {
      toast.error("Please complete all required fields")
      return
    }
    const finalSpec = specialization === "Others" ? otherSpec : specialization

    const cleanedMeds = meds.filter((m) => (m.medicine || "").trim())
    const prescriptionStr = JSON.stringify(cleanedMeds)

    setSaving(true)
    try {
      await apiFetch("/api/records", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          doctorId: user.id,
          visitType,
          clinicName: clinicName.trim(),
          practitionerName: practitionerName.trim(),
          specialization: finalSpec,
          diagnosis,
          doctorsNotes,
          prescription: prescriptionStr,
          attachments: JSON.stringify(attachments),
          visitDate,
        }),
      })
      toast.success("Medical record created & encrypted")
      onSaved()
    } catch (e) {
      toast.error("Failed to create record", {
        description: (e as Error).message,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            Create New Medical Record
          </DialogTitle>
          <DialogDescription>
            Records are AES-256 encrypted before being stored.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-end">
            <EncryptedBadge />
          </div>

          {/* Patient select */}
          <div className="space-y-1.5">
            <Label>
              Patient <span className="text-rose-500">*</span>
            </Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a patient from your records" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {p.mobile}
                    {p.bloodGroup ? ` · ${p.bloodGroup}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only patients with existing records or appointments with you are
              listed. New patients must book an appointment first.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                Visit Type <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={visitType}
                onValueChange={(v) => setVisitType(v as VisitType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIT_TYPES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                Visit Date & Time <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="datetime-local"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Healthcare Organisation / Clinic Name{" "}
              <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="e.g. City Care Clinic"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                Practitioner Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={practitionerName}
                onChange={(e) => setPractitionerName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Specialization</Label>
              <Select value={specialization} onValueChange={setSpecialization}>
                <SelectTrigger>
                  <SelectValue />
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
          </div>

          {specialization === "Others" && (
            <div className="space-y-1.5">
              <Label>Specify specialization</Label>
              <Input
                value={otherSpec}
                onChange={(e) => setOtherSpec(e.target.value)}
                placeholder="e.g. Pediatrics"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Diagnosis / Findings</Label>
            <Textarea
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              rows={3}
              placeholder="Primary diagnosis, symptoms observed, examination findings…"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Doctor's Notes</Label>
            <Textarea
              value={doctorsNotes}
              onChange={(e) => setDoctorsNotes(e.target.value)}
              rows={3}
              placeholder="Advice, follow-up plan, precautions…"
            />
          </div>

          {/* Prescription dynamic list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Prescription</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMed}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add medicine
              </Button>
            </div>
            <div className="space-y-2">
              {meds.map((m, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 gap-2 rounded-lg border bg-muted/20 p-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"
                >
                  <Input
                    placeholder="Medicine"
                    value={m.medicine || ""}
                    onChange={(e) => updateMed(i, "medicine", e.target.value)}
                  />
                  <Input
                    placeholder="Dose (e.g. 500mg)"
                    value={m.dose || ""}
                    onChange={(e) => updateMed(i, "dose", e.target.value)}
                  />
                  <Input
                    placeholder="Frequency (e.g. 1-0-1)"
                    value={m.frequency || ""}
                    onChange={(e) => updateMed(i, "frequency", e.target.value)}
                  />
                  <Input
                    placeholder="Duration (e.g. 5 days)"
                    value={m.duration || ""}
                    onChange={(e) => updateMed(i, "duration", e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-rose-500 hover:bg-rose-50"
                    onClick={() => removeMed(i)}
                    disabled={meds.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Attachments */}
          <div className="space-y-1.5">
            <Label>Add Report / Prescription Attachment</Label>
            <Input
              type="file"
              multiple
              accept="image/*,application/pdf,.doc,.docx"
              onChange={onFileChange}
            />
            <p className="text-xs text-muted-foreground">
              Images, PDFs, or Word docs. File names are stored with the record.
            </p>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {attachments.map((f, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                  >
                    <FileImage className="h-3 w-3" />
                    {f}
                  </span>
                ))}
              </div>
            )}
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
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Lock className="mr-1 h-4 w-4" />
                Save Encrypted Record
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────
//  NEW REFERRAL DIALOG
// ─────────────────────────────────────────────────────────
function NewReferralDialog({
  open,
  onOpenChange,
  doctorId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  doctorId: string
  onSaved: () => void
}) {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [toId, setToId] = useState("")
  const [patientName, setPatientName] = useState("")
  const [purpose, setPurpose] = useState("")
  const [commission, setCommission] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoadingDocs(true)
    apiFetch<{ doctors: Doctor[] }>("/api/doctors?role=DOCTOR")
      .then((res) => {
        // exclude self
        setDoctors((res.doctors || []).filter((d) => d.id !== doctorId))
      })
      .catch((e) =>
        toast.error("Failed to load doctors", {
          description: (e as Error).message,
        })
      )
      .finally(() => setLoadingDocs(false))
  }, [open, doctorId])

  useEffect(() => {
    if (!open) {
      setToId("")
      setPatientName("")
      setPurpose("")
      setCommission("")
    }
  }, [open])

  const handleSubmit = async () => {
    if (!toId) return toast.error("Please pick a doctor/clinic to refer to")
    if (!patientName.trim()) return toast.error("Patient name is required")
    setSaving(true)
    try {
      await apiFetch("/api/referrals", {
        method: "POST",
        body: JSON.stringify({
          fromId: doctorId,
          toId,
          patientName: patientName.trim(),
          purpose: purpose.trim(),
          commission: Number(commission) || 0,
        }),
      })
      toast.success("Referral created")
      onSaved()
    } catch (e) {
      toast.error("Failed to create referral", {
        description: (e as Error).message,
      })
    } finally {
      setSaving(false)
    }
  }

  const selected = doctors.find((d) => d.id === toId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-fuchsia-600" />
            New Referral
          </DialogTitle>
          <DialogDescription>
            Refer a patient to a specialist and earn a commission.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Refer to (doctor / clinic)</Label>
            <Select value={toId} onValueChange={setToId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingDocs ? "Loading doctors…" : "Select a specialist"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                    {d.specialization ? ` · ${d.specialization}` : ""}
                    {d.city ? ` · ${d.city}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                {selected.avgRating > 0 && (
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                    {selected.avgRating.toFixed(1)} ({selected.ratingCount})
                  </span>
                )}
                {selected.city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {selected.city}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>
              Patient Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Patient full name"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Purpose</Label>
            <Textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
              placeholder="e.g. Cardiac evaluation & ECG"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Commission (₹)</Label>
            <Input
              type="number"
              min={0}
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              placeholder="0"
            />
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
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <ArrowRightLeft className="mr-1 h-4 w-4" />
                Send Referral
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────
//  AI INSIGHTS TAB
// ─────────────────────────────────────────────────────────
function InsightsTab({ records }: { records: MedicalRecord[] }) {
  const [period, setPeriod] = useState<string>("30d")
  const [insight, setInsight] = useState<string>("")
  const [generating, setGenerating] = useState(false)

  const periodMeta = PERIODS.find((p) => p.id === period) || PERIODS[1]

  const filteredRecords = useMemo(() => {
    if (periodMeta.days === 0) return records
    const cutoff = subDays(new Date(), periodMeta.days)
    return records.filter((r) => isAfter(parseISO(r.visitDate), cutoff))
  }, [records, periodMeta])

  const distinctPatients = useMemo(() => {
    const set = new Set<string>()
    filteredRecords.forEach((r) => set.add(r.patient.id))
    return set.size
  }, [filteredRecords])

  const visitTypeBreakdown = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of filteredRecords) {
      map.set(r.visitType, (map.get(r.visitType) || 0) + 1)
    }
    return VISIT_TYPES.map((t) => ({
      type: t.replace("_", " "),
      raw: t,
      count: map.get(t) || 0,
    })).filter((d) => d.count > 0)
  }, [filteredRecords])

  const generate = async () => {
    if (filteredRecords.length === 0) {
      toast.error("No records in the selected period")
      return
    }
    setGenerating(true)
    setInsight("")
    try {
      const payload = filteredRecords.slice(0, 25).map((r) => ({
        visitDate: r.visitDate,
        visitType: r.visitType,
        specialization: r.specialization,
        diagnosis: r.diagnosis,
        patientName: r.patient.name,
      }))
      const res = await apiFetch<{ result: string }>("/api/ai/insights", {
        method: "POST",
        body: JSON.stringify({
          records: payload,
          period: periodMeta.label,
          role: "DOCTOR",
        }),
      })
      setInsight(res.result || "No insights generated.")
      toast.success("Insights generated")
    } catch (e) {
      toast.error("Failed to generate insights", {
        description: (e as Error).message,
      })
    } finally {
      setGenerating(false)
    }
  }

  const maxCount = Math.max(1, ...visitTypeBreakdown.map((d) => d.count))

  return (
    <div className="space-y-6">
      <SectionHeader
        title="AI Insights"
        description="Leverage AI to optimize your practice capacity and identify referral opportunities."
      />

      <Alert>
        <Sparkles className="h-4 w-4" />
        <AlertTitle>Optimize your practice</AlertTitle>
        <AlertDescription>
          Generate AI-driven insights from your visit records to spot trends,
          peak periods, common diagnoses, and potential referral opportunities.
        </AlertDescription>
      </Alert>

      {/* Period selector + generate */}
      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-3 p-5">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Period
            </Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={generate}
            disabled={generating || filteredRecords.length === 0}
          >
            {generating ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Brain className="mr-1 h-4 w-4" />
                Generate AI Insights
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Visits in period"
          value={filteredRecords.length}
          icon={Activity}
          color="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          title="Distinct patients"
          value={distinctPatients}
          icon={Users}
          color="bg-teal-50 text-teal-600"
        />
        <StatCard
          title="Visit types"
          value={visitTypeBreakdown.length}
          icon={TrendingUp}
          color="bg-fuchsia-50 text-fuchsia-600"
        />
      </div>

      {/* Visit type breakdown */}
      {visitTypeBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Visit Type Breakdown</CardTitle>
            <CardDescription>
              Distribution of {filteredRecords.length} visit(s) in the selected
              period.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={visitTypeBreakdown}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="type"
                    tick={{ fontSize: 11 }}
                    interval={0}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(16,185,129,0.08)" }}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {visitTypeBreakdown.map((entry) => (
                      <Cell
                        key={entry.raw}
                        fill={VISIT_BAR_COLOR[entry.raw] || "#10b981"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {visitTypeBreakdown.map((d) => (
                <div
                  key={d.raw}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{
                      backgroundColor:
                        VISIT_BAR_COLOR[d.raw] || "#10b981",
                    }}
                  />
                  <span className="text-muted-foreground">{d.type}</span>
                  <span className="font-semibold">{d.count}</span>
                  <span className="text-muted-foreground">
                    ({Math.round((d.count / Math.max(1, filteredRecords.length)) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Max visits for any type this period: {maxCount}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Markdown result */}
      {generating ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            Analyzing {filteredRecords.length} record(s)…
          </CardContent>
        </Card>
      ) : insight ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              AI Generated Insights
            </CardTitle>
            <CardDescription>
              Generated for {periodMeta.label.toLowerCase()}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none rounded-lg bg-muted/30 p-4">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="mb-2 text-lg font-bold">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="mb-2 mt-3 text-base font-semibold">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="mb-1 mt-2 text-sm font-semibold">
                      {children}
                    </h3>
                  ),
                  ul: ({ children }) => (
                    <ul className="mb-2 ml-4 list-disc space-y-1 text-sm">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="mb-2 ml-4 list-decimal space-y-1 text-sm">
                      {children}
                    </ol>
                  ),
                  p: ({ children }) => (
                    <p className="mb-2 text-sm leading-relaxed">{children}</p>
                  ),
                  li: ({ children }) => <li className="text-sm">{children}</li>,
                }}
              >
                {insight}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={Brain}
          title="No insights generated yet"
          description={`Click "Generate AI Insights" to analyze ${filteredRecords.length} record(s) from ${periodMeta.label.toLowerCase()}.`}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
//  ACCOUNTS TAB
// ─────────────────────────────────────────────────────────
function AccountsTab({
  user,
  account,
  loading,
  partnerships,
  onRefresh,
}: {
  user: SessionUser
  account: AccountDetail | null
  loading: boolean
  partnerships: Partnership[]
  onRefresh: () => void
}) {
  const logout = useAuthStore((s) => s.logout)
  const updateUser = useAuthStore((s) => s.updateUser)
  const [editingAddress, setEditingAddress] = useState(false)
  const [address, setAddress] = useState({
    addressLine: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
  })
  const [upiInput, setUpiInput] = useState("")
  const [savingUpi, setSavingUpi] = useState(false)
  const [savingAddress, setSavingAddress] = useState(false)
  const [savingBio, setSavingBio] = useState(false)

  // Recommended partners (other doctors)
  const [partners, setPartners] = useState<Doctor[]>([])
  const [loadingPartners, setLoadingPartners] = useState(false)
  const [requestingId, setRequestingId] = useState<string | null>(null)
  const [commissionInput, setCommissionInput] = useState<Record<string, string>>({})

  useEffect(() => {
    if (account) {
      setAddress({
        addressLine: account.addressLine || "",
        landmark: account.landmark || "",
        city: account.city || "",
        state: account.state || "",
        pincode: account.pincode || "",
      })
      setUpiInput(account.upiId || "")
    }
  }, [account])

  const loadPartners = useCallback(() => {
    setLoadingPartners(true)
    apiFetch<{ doctors: Doctor[] }>("/api/doctors?role=DOCTOR")
      .then((res) => {
        setPartners((res.doctors || []).filter((d) => d.id !== user.id))
      })
      .catch((e) =>
        toast.error("Failed to load clinics", {
          description: (e as Error).message,
        })
      )
      .finally(() => setLoadingPartners(false))
  }, [user.id])

  useEffect(() => {
    loadPartners()
  }, [loadPartners])

  const saveAddress = async () => {
    setSavingAddress(true)
    try {
      const res = await apiFetch<{ user: AccountDetail }>("/api/account", {
        method: "PATCH",
        body: JSON.stringify({ id: user.id, ...address }),
      })
      updateUser({
        city: res.user.city,
        state: res.user.state,
      })
      toast.success("Address updated")
      setEditingAddress(false)
      onRefresh()
    } catch (e) {
      toast.error("Failed to update address", {
        description: (e as Error).message,
      })
    } finally {
      setSavingAddress(false)
    }
  }

  const saveUpi = async () => {
    setSavingUpi(true)
    try {
      await apiFetch("/api/account", {
        method: "PATCH",
        body: JSON.stringify({ id: user.id, upiId: upiInput.trim() }),
      })
      toast.success("UPI ID linked")
      onRefresh()
    } catch (e) {
      toast.error("Failed to link UPI", {
        description: (e as Error).message,
      })
    } finally {
      setSavingUpi(false)
    }
  }

  const toggleBiometric = async (on: boolean) => {
    setSavingBio(true)
    try {
      await apiFetch("/api/account", {
        method: "PATCH",
        body: JSON.stringify({ id: user.id, biometricEnrolled: on }),
      })
      updateUser({ biometricEnrolled: on })
      toast.success(on ? "Biometric enabled" : "Biometric disabled")
      onRefresh()
    } catch (e) {
      toast.error("Failed to update biometric", {
        description: (e as Error).message,
      })
    } finally {
      setSavingBio(false)
    }
  }

  const requestTieUp = async (clinic: Doctor) => {
    setRequestingId(clinic.id)
    const rate = Number(commissionInput[clinic.id] || 10)
    try {
      await apiFetch("/api/partnerships", {
        method: "POST",
        body: JSON.stringify({
          orgId: user.id,
          clinicId: clinic.id,
          clinicType: "BLOOD_TEST",
          commissionRate: rate,
        }),
      })
      toast.success(`Tie-up requested with ${clinic.name}`)
      onRefresh()
    } catch (e) {
      toast.error("Failed to request tie-up", {
        description: (e as Error).message,
      })
    } finally {
      setRequestingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Accounts"
        description="Manage your practitioner profile, partnerships, and security."
      />

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : (
        <>
          {/* Profile */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Practitioner Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-emerald-100 text-lg font-bold text-emerald-700">
                    {user.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-bold">{doctorName(user.name)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {user.specialization && (
                      <Badge className="bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        <Stethoscope className="h-3 w-3" />
                        {user.specialization}
                      </Badge>
                    )}
                    {account?.membershipNumber && (
                      <Badge variant="outline">
                        ID: {account.membershipNumber}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <ProfileItem label="Email" value={user.email} icon={CreditCard} />
                <ProfileItem label="Mobile" value={user.mobile} icon={Phone} />
                <ProfileItem
                  label="Aadhaar"
                  value={maskGovtId(account?.aadhaarNumber || account?.govtIdNumber)}
                  icon={ShieldCheck}
                />
                <ProfileItem
                  label="Driving License"
                  value={maskGovtId(account?.drivingLicenseNumber)}
                  icon={CreditCard}
                />
                <ProfileItem
                  label="Bed count"
                  value={String(account?.bedCount ?? "—")}
                  icon={Activity}
                />
                <ProfileItem
                  label="Capacity / hour"
                  value={
                    account?.capacityPerHour
                      ? `${account.capacityPerHour} patients/hr`
                      : "—"
                  }
                  icon={TrendingUp}
                />
                <ProfileItem
                  label="Specialization"
                  value={user.specialization || "—"}
                  icon={Stethoscope}
                />
              </div>

              {/* Address */}
              <div className="rounded-lg border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-emerald-600" />
                    <h4 className="text-sm font-semibold">Clinic Address</h4>
                  </div>
                  {!editingAddress && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingAddress(true)}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Button>
                  )}
                </div>
                {!editingAddress ? (
                  <div className="text-sm text-muted-foreground">
                    <p>
                      {account?.addressLine}
                      {account?.landmark ? `, ${account.landmark}` : ""}
                    </p>
                    <p>
                      {account?.city}
                      {account?.state ? `, ${account.state}` : ""}{" "}
                      {account?.pincode}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Input
                      placeholder="Address line"
                      value={address.addressLine}
                      onChange={(e) =>
                        setAddress((s) => ({ ...s, addressLine: e.target.value }))
                      }
                    />
                    <Input
                      placeholder="Landmark (optional)"
                      value={address.landmark}
                      onChange={(e) =>
                        setAddress((s) => ({ ...s, landmark: e.target.value }))
                      }
                    />
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <Input
                        placeholder="City"
                        value={address.city}
                        onChange={(e) =>
                          setAddress((s) => ({ ...s, city: e.target.value }))
                        }
                      />
                      <Input
                        placeholder="State"
                        value={address.state}
                        onChange={(e) =>
                          setAddress((s) => ({ ...s, state: e.target.value }))
                        }
                      />
                      <Input
                        placeholder="Pincode"
                        value={address.pincode}
                        onChange={(e) =>
                          setAddress((s) => ({ ...s, pincode: e.target.value }))
                        }
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={saveAddress}
                        disabled={savingAddress}
                      >
                        {savingAddress ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-1 h-4 w-4" />
                        )}
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingAddress(false)}
                        disabled={savingAddress}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Blood Testing Clinic Partnerships */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Handshake className="h-5 w-5 text-fuchsia-600" />
                  <div>
                    <CardTitle className="text-base">
                      Blood Testing Clinic Tie-ups
                    </CardTitle>
                    <CardDescription>
                      Earn commissions on referrals from partnered clinics.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Existing partnerships */}
                {partnerships.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Your partnerships ({partnerships.length})
                    </p>
                    <div className="max-h-56 space-y-2 overflow-y-auto">
                      {partnerships.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 p-3 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {p.clinic.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {p.clinicType.replace("_", " ")}
                              {p.clinic.city ? ` · ${p.clinic.city}` : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-emerald-700">
                              {p.commissionRate}%
                            </p>
                            <p className="text-xs text-muted-foreground">
                              commission
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended partners */}
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Recommended tie-up partners
                </p>
                {loadingPartners ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : partners.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No other practitioners available to partner with.
                  </p>
                ) : (
                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {partners.slice(0, 8).map((d) => (
                      <div
                        key={d.id}
                        className="rounded-lg border p-3 text-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{d.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {d.specialization || "General Medicine"}
                              {d.city ? ` · ${d.city}` : ""}
                            </p>
                            {d.avgRating > 0 && (
                              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-amber-600">
                                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                {d.avgRating.toFixed(1)} ({d.ratingCount})
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              className="h-8 w-16"
                              value={commissionInput[d.id] ?? "10"}
                              onChange={(e) =>
                                setCommissionInput((s) => ({
                                  ...s,
                                  [d.id]: e.target.value,
                                }))
                              }
                              title="Commission rate %"
                            />
                            <span className="text-xs text-muted-foreground">
                              %
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => requestTieUp(d)}
                          disabled={requestingId === d.id}
                        >
                          {requestingId === d.id ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Handshake className="mr-1 h-3.5 w-3.5" />
                          )}
                          Request Tie-up
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Security & Payments */}
            <div className="space-y-6">
              {/* UPI */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wallet className="h-4 w-4 text-emerald-600" />
                    UPI for Receiving Payments
                  </CardTitle>
                  <CardDescription>
                    Link your UPI ID to receive consultation fees & commissions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="yourname@upi"
                      value={upiInput}
                      onChange={(e) => setUpiInput(e.target.value)}
                    />
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={saveUpi}
                      disabled={savingUpi || !upiInput.trim()}
                    >
                      {savingUpi ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : account?.upiId ? (
                        "Update"
                      ) : (
                        "Link"
                      )}
                    </Button>
                  </div>
                  {account?.upiId && (
                    <p className="text-xs text-emerald-700">
                      ✓ UPI linked: {account.upiId}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Biometric */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Fingerprint className="h-4 w-4 text-emerald-600" />
                    Biometric Login
                  </CardTitle>
                  <CardDescription>
                    Enable fingerprint or face unlock for faster sign-in.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">
                        {user.biometricEnrolled ? "Enabled" : "Disabled"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user.biometricEnrolled
                          ? "Biometric authentication is active."
                          : "Enable to use biometrics at sign-in."}
                      </p>
                    </div>
                    <Switch
                      checked={!!user.biometricEnrolled}
                      onCheckedChange={toggleBiometric}
                      disabled={savingBio}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Logout */}
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Sign out</p>
                      <p className="text-xs text-muted-foreground">
                        End your current session.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      onClick={logout}
                    >
                      <LogOut className="mr-1 h-4 w-4" />
                      Logout
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ProfileItem({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: LucideIcon
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  )
}
