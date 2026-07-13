"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { format, formatDistanceToNow, parseISO, differenceInDays } from "date-fns"
import {
  Users,
  Activity,
  HeartPulse,
  Droplet,
  Scale,
  Thermometer,
  Footprints,
  Wind,
  Pill,
  Target,
  Heart,
  Phone,
  MapPin,
  Droplets,
  Stethoscope,
  FileText,
  Calendar,
  ChevronDown,
  Search,
  RefreshCw,
  AlertCircle,
  Loader2,
  ShieldCheck,
  UserCircle2,
  Clock,
} from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { toast } from "sonner"

import { useAuthStore } from "@/lib/auth-store"
import { apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  HeroBanner,
  StatCard,
  SectionHeader,
  EmptyState,
  MetricRing,
} from "@/components/dashboard/shared/primitives"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ============== Types ==============
interface PatientRef {
  id: string
  name: string
  mobile?: string | null
  bloodGroup?: string | null
}

interface AccountDetail {
  id: string
  name: string
  email: string
  mobile: string
  role: string
  city?: string | null
  state?: string | null
  addressLine?: string | null
  landmark?: string | null
  pincode?: string | null
  bloodGroup?: string | null
  emergencyName?: string | null
  emergencyMobile?: string | null
  createdAt?: string
}

interface VitalsEntry {
  id: string
  patientId: string
  systolic?: number | null
  diastolic?: number | null
  heartRate?: number | null
  glucose?: number | null
  weight?: number | null
  temperature?: number | null
  oxygenSat?: number | null
  steps?: number | null
  note?: string | null
  recordedAt: string
  createdAt: string
}

interface MedicationSchedule {
  id: string
  patientId: string
  medicineName: string
  dosage: string
  frequency: string
  times: string | string[]
  instructions?: string | null
  prescribedBy?: string | null
  startDate?: string | null
  active?: boolean
  createdAt: string
}

interface GoalLog {
  id: string
  value: number
  note?: string | null
  createdAt: string
}

interface HealthGoal {
  id: string
  patientId: string
  title: string
  metric: string
  targetValue: number
  currentValue: number
  unit: string
  period: string
  status: string
  endDate?: string | null
  logs?: GoalLog[]
  createdAt: string
}

interface FamilyMember {
  id: string
  ownerId: string
  name: string
  relation: string
  gender?: string | null
  dob?: string | null
  bloodGroup?: string | null
  phone?: string | null
  email?: string | null
  allergies?: string | null
  chronicConditions?: string | null
  currentMedications?: string | null
  emergencyContact?: string | null
  notes?: string | null
  createdAt: string
}

interface MedicalRecord {
  id: string
  patientId: string
  doctorId?: string | null
  orgId?: string | null
  visitType?: string | null
  clinicName?: string | null
  practitionerName?: string | null
  specialization?: string | null
  diagnosis?: string | null
  doctorsNotes?: string | null
  prescription?: string | null
  attachments?: string | null
  visitDate: string
  createdAt: string
}

// ============== Constants ==============

const METRIC_META: Record<string, { icon: typeof Heart; color: string; label: string }> = {
  STEPS: { icon: Footprints, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10", label: "Steps" },
  WEIGHT: { icon: Scale, color: "text-violet-600 bg-violet-50 dark:bg-violet-500/10", label: "Weight" },
  BP_SYSTOLIC: { icon: HeartPulse, color: "text-rose-600 bg-rose-50 dark:bg-rose-500/10", label: "BP Systolic" },
  BP_DIASTOLIC: { icon: HeartPulse, color: "text-rose-600 bg-rose-50 dark:bg-rose-500/10", label: "BP Diastolic" },
  HEART_RATE: { icon: Heart, color: "text-rose-600 bg-rose-50 dark:bg-rose-500/10", label: "Heart Rate" },
  SLEEP_HOURS: { icon: Clock, color: "text-teal-600 bg-teal-50 dark:bg-teal-500/10", label: "Sleep" },
  WATER_INTAKE: { icon: Droplet, color: "text-sky-600 bg-sky-50 dark:bg-sky-500/10", label: "Water" },
  EXERCISE_MINS: { icon: Activity, color: "text-amber-600 bg-amber-50 dark:bg-amber-500/10", label: "Exercise" },
  GLUCOSE: { icon: Droplets, color: "text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-500/10", label: "Glucose" },
}

const RELATION_COLORS: Record<string, string> = {
  Spouse: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  Child: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  Parent: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  Sibling: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  Other: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  COMPLETED: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  PAUSED: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  FAILED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
}

const FREQUENCY_COLORS: Record<string, string> = {
  ONCE_DAILY: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  TWICE_DAILY: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  THRICE_DAILY: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  WEEKLY: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  AS_NEEDED: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
}

// ============== Helpers ==============

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function parseTimes(times: string | string[]): string[] {
  if (Array.isArray(times)) return times
  try {
    const parsed = JSON.parse(times)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return [times]
  }
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—"
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1)
}

function goalProgress(goal: HealthGoal): number {
  if (goal.targetValue <= 0) return 0
  return Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))
}

// ============== Main Component ==============

export function PatientOverview() {
  const user = useAuthStore((s) => s.user)
  const [patients, setPatients] = useState<PatientRef[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [loadingPatients, setLoadingPatients] = useState(true)

  // Per-section data + loading
  const [account, setAccount] = useState<AccountDetail | null>(null)
  const [vitals, setVitals] = useState<VitalsEntry[]>([])
  const [meds, setMeds] = useState<MedicationSchedule[]>([])
  const [goals, setGoals] = useState<HealthGoal[]>([])
  const [family, setFamily] = useState<FamilyMember[]>([])
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)

  // Fetch the doctor's unique patients from appointments
  const fetchPatients = useCallback(async () => {
    if (!user) return
    setLoadingPatients(true)
    try {
      const data = await apiFetch<{ appointments: Array<{ patientId: string; patient: PatientRef }> }>(
        `/api/appointments?userId=${encodeURIComponent(user.id)}&role=DOCTOR`
      )
      const map = new Map<string, PatientRef>()
      for (const a of data.appointments ?? []) {
        if (a.patientId && a.patient && !map.has(a.patientId)) {
          map.set(a.patientId, { ...a.patient, id: a.patientId })
        }
      }
      setPatients(Array.from(map.values()))
    } catch (e) {
      toast.error("Could not load your patient list")
    } finally {
      setLoadingPatients(false)
    }
  }, [user])

  useEffect(() => {
    fetchPatients()
  }, [fetchPatients])

  // Fetch all patient data in parallel when a patient is selected
  const fetchPatientData = useCallback(async (pid: string) => {
    setLoadingData(true)
    setDataError(null)
    setAccount(null)
    setVitals([])
    setMeds([])
    setGoals([])
    setFamily([])
    setRecords([])
    try {
      const [acctRes, vitalsRes, medsRes, goalsRes, familyRes, recordsRes] = await Promise.all([
        apiFetch<{ account: AccountDetail }>(`/api/account?id=${encodeURIComponent(pid)}`).catch(() => ({ account: null })),
        apiFetch<{ vitals: VitalsEntry[] }>(`/api/vitals?patientId=${encodeURIComponent(pid)}`).catch(() => ({ vitals: [] })),
        apiFetch<{ medications: MedicationSchedule[] }>(`/api/medications?patientId=${encodeURIComponent(pid)}`).catch(() => ({ medications: [] })),
        apiFetch<{ goals: HealthGoal[] }>(`/api/goals?patientId=${encodeURIComponent(pid)}&logs=true`).catch(() => ({ goals: [] })),
        apiFetch<{ members: FamilyMember[] }>(`/api/family-members?ownerId=${encodeURIComponent(pid)}`).catch(() => ({ members: [] })),
        apiFetch<{ records: MedicalRecord[] }>(`/api/records?userId=${encodeURIComponent(pid)}&role=PATIENT`).catch(() => ({ records: [] })),
      ])
      setAccount(acctRes.account)
      setVitals(vitalsRes.vitals ?? [])
      setMeds(medsRes.medications ?? [])
      setGoals(goalsRes.goals ?? [])
      setFamily(familyRes.members ?? [])
      setRecords(recordsRes.records ?? [])
    } catch (e) {
      setDataError((e as Error).message || "Failed to load patient data")
      toast.error("Failed to load patient data")
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) fetchPatientData(selectedId)
  }, [selectedId, fetchPatientData])

  // Compute recent vitals (last 30 days)
  const recentVitals = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    return vitals.filter((v) => new Date(v.recordedAt) >= cutoff)
  }, [vitals])

  const activeMeds = useMemo(() => meds.filter((m) => m.active !== false), [meds])
  const activeGoals = useMemo(() => goals.filter((g) => g.status === "ACTIVE"), [goals])

  // Chart data: last 14 vitals, sorted oldest→newest
  const chartData = useMemo(() => {
    return [...vitals]
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
      .slice(-14)
      .map((v) => ({
        date: format(new Date(v.recordedAt), "MMM d"),
        systolic: v.systolic ?? null,
        diastolic: v.diastolic ?? null,
        heartRate: v.heartRate ?? null,
        glucose: v.glucose ?? null,
        weight: v.weight ?? null,
      }))
  }, [vitals])

  if (!user) return null

  return (
    <div className="space-y-6">
      <HeroBanner
        title="Patient Overview"
        subtitle="Review a patient's complete health profile during consultations"
        icon={Users}
      />

      {/* Patient selector */}
      <Card className="overflow-hidden">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1">
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Search className="h-4 w-4" />
                Select Patient
              </label>
              {loadingPatients ? (
                <Skeleton className="h-11 w-full" />
              ) : patients.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-4 py-3 text-sm text-amber-700 dark:border-amber-700 dark:bg-amber-500/5 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  No patients found. Your patient list is built from your appointment history.
                </div>
              ) : (
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue placeholder="Choose a patient to view their profile…" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                            {getInitials(p.name)}
                          </span>
                          {p.name}
                          {p.bloodGroup && (
                            <span className="ml-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                              {p.bloodGroup}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {selectedId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchPatientData(selectedId)}
                disabled={loadingData}
                className="shrink-0"
              >
                <RefreshCw className={cn("h-4 w-4", loadingData && "animate-spin")} />
                Refresh
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* No patient selected state */}
      {!selectedId && !loadingPatients && patients.length > 0 && (
        <EmptyState
          icon={UserCircle2}
          title="No patient selected"
          description="Select a patient above to view their complete health profile — vitals trends, active medications, health goals, family emergency contacts, and recent medical records."
        />
      )}

      {/* Loading state */}
      {selectedId && loadingData && <OverviewSkeleton />}

      {/* Error state */}
      {selectedId && !loadingData && dataError && (
        <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-500/5">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="h-10 w-10 text-rose-500" />
            <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{dataError}</p>
            <Button variant="outline" size="sm" onClick={() => fetchPatientData(selectedId)}>
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Patient data */}
      {selectedId && !loadingData && !dataError && account && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Patient header */}
          <PatientHeader account={account} />

          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Active Medications"
              value={activeMeds.length}
              icon={Pill}
              color="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
              accent="from-emerald-500 to-teal-500"
              trend={activeMeds.length > 0 ? `${activeMeds.length} prescribed` : "None active"}
            />
            <StatCard
              title="Active Goals"
              value={activeGoals.length}
              icon={Target}
              color="bg-teal-50 text-teal-600 dark:bg-teal-500/10"
              accent="from-teal-500 to-emerald-500"
              trend={activeGoals.length > 0 ? "In progress" : "No goals"}
            />
            <StatCard
              title="Recent Vitals"
              value={recentVitals.length}
              icon={Activity}
              color="bg-amber-50 text-amber-600 dark:bg-amber-500/10"
              accent="from-amber-500 to-orange-500"
              trend="Last 30 days"
            />
            <StatCard
              title="Family Members"
              value={family.length}
              icon={Users}
              color="bg-violet-50 text-violet-600 dark:bg-violet-500/10"
              accent="from-violet-500 to-fuchsia-500"
              trend={family.length > 0 ? "Profiles linked" : "None added"}
            />
          </div>

          {/* Vitals trend chart */}
          <Card>
            <CardContent className="p-5">
              <SectionHeader
                title="Vitals Trend"
                icon={Activity}
                description="Recent blood pressure, heart rate, glucose & weight readings"
              />
              {chartData.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No vitals recorded"
                  description="This patient hasn't logged any vitals yet."
                />
              ) : (
                <div className="mt-4 h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradSys" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradDia" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradHr" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradGlu" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#d946ef" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#d946ef" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Area type="monotone" dataKey="systolic" name="Systolic" stroke="#10b981" strokeWidth={2} fill="url(#gradSys)" connectNulls />
                      <Area type="monotone" dataKey="diastolic" name="Diastolic" stroke="#f43f5e" strokeWidth={2} fill="url(#gradDia)" connectNulls />
                      <Area type="monotone" dataKey="heartRate" name="Heart Rate" stroke="#f59e0b" strokeWidth={2} fill="url(#gradHr)" connectNulls />
                      <Area type="monotone" dataKey="glucose" name="Glucose" stroke="#d946ef" strokeWidth={2} fill="url(#gradGlu)" connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Medications + Goals */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Active Medications */}
            <Card>
              <CardContent className="p-5">
                <SectionHeader title="Active Medications" icon={Pill} description="Current prescriptions & schedule" />
                <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {activeMeds.length === 0 ? (
                    <EmptyState icon={Pill} title="No active medications" description="No prescriptions on record." />
                  ) : (
                    activeMeds.map((m, i) => {
                      const times = parseTimes(m.times)
                      return (
                        <motion.div
                          key={m.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.05, 0.4) }}
                          className="rounded-xl border bg-card p-3 transition-all hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                                <Pill className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{m.medicineName}</p>
                                <p className="text-xs text-muted-foreground">{m.dosage}</p>
                              </div>
                            </div>
                            <Badge className={cn("border-0 text-[10px]", FREQUENCY_COLORS[m.frequency] || FREQUENCY_COLORS.AS_NEEDED)}>
                              {m.frequency.replace("_", " ").toLowerCase()}
                            </Badge>
                          </div>
                          {times.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {times.map((t, idx) => (
                                <span key={idx} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                          {m.prescribedBy && (
                            <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Stethoscope className="h-3 w-3" />
                              Prescribed by {m.prescribedBy}
                            </p>
                          )}
                        </motion.div>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Health Goals */}
            <Card>
              <CardContent className="p-5">
                <SectionHeader title="Health Goals" icon={Target} description="Wellness targets & progress" />
                <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {goals.length === 0 ? (
                    <EmptyState icon={Target} title="No health goals" description="This patient hasn't set any goals." />
                  ) : (
                    goals.map((g, i) => {
                      const meta = METRIC_META[g.metric] || METRIC_META.STEPS
                      const Icon = meta.icon
                      const pct = goalProgress(g)
                      return (
                        <motion.div
                          key={g.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.05, 0.4) }}
                          className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-all hover:shadow-md"
                        >
                          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", meta.color)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold">{g.title}</p>
                              <Badge className={cn("border-0 text-[10px]", STATUS_COLORS[g.status] || STATUS_COLORS.ACTIVE)}>
                                {g.status}
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {fmtNum(g.currentValue)} / {fmtNum(g.targetValue)} {g.unit}
                            </p>
                          </div>
                          <MetricRing value={pct} size={48} strokeWidth={5} label={`${pct}%`} />
                        </motion.div>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Family Members + Recent Records */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Family Members */}
            <Card>
              <CardContent className="p-5">
                <SectionHeader title="Family Members" icon={Users} description="Emergency contacts & health profiles" />
                <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {family.length === 0 ? (
                    <EmptyState icon={Users} title="No family members" description="No family profiles linked." />
                  ) : (
                    family.map((m, i) => {
                      const relColor = RELATION_COLORS[m.relation] || RELATION_COLORS.Other
                      const allergies = m.allergies ? m.allergies.split(",").map((s) => s.trim()).filter(Boolean) : []
                      return (
                        <motion.div
                          key={m.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.05, 0.4) }}
                          className="rounded-xl border bg-card p-3 transition-all hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className={cn("text-[11px] font-bold", relColor)}>
                                  {getInitials(m.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-semibold">{m.name}</p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", relColor)}>{m.relation}</span>
                                  {m.bloodGroup && (
                                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                                      {m.bloodGroup}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {m.phone && (
                              <a
                                href={`tel:${m.phone}`}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20"
                                title={`Call ${m.phone}`}
                              >
                                <Phone className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                          {allergies.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {allergies.slice(0, 4).map((a, idx) => (
                                <span key={idx} className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                                  ⚠ {a}
                                </span>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Records */}
            <Card>
              <CardContent className="p-5">
                <SectionHeader title="Recent Medical Records" icon={FileText} description="Visit history & diagnoses" />
                <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {records.length === 0 ? (
                    <EmptyState icon={FileText} title="No records" description="No medical records on file." />
                  ) : (
                    records.slice(0, 12).map((r, i) => (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.05, 0.4) }}
                        className="rounded-xl border bg-card p-3 transition-all hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">{r.diagnosis || "General visit"}</p>
                              <p className="text-xs text-muted-foreground">
                                {r.clinicName || "Clinic"} · {r.practitionerName || "Practitioner"}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {format(new Date(r.visitDate), "MMM d, yyyy")}
                          </span>
                        </div>
                        {r.prescription && (
                          <p className="mt-2 line-clamp-2 rounded bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground">
                            <span className="font-medium">Rx:</span> {r.prescription.slice(0, 120)}
                            {r.prescription.length > 120 ? "…" : ""}
                          </p>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ============== Patient Header Card ==============

function PatientHeader({ account }: { account: AccountDetail }) {
  const age = account.createdAt
    ? `${differenceInDays(new Date(), new Date(account.createdAt))} days enrolled`
    : null

  return (
    <Card className="overflow-hidden border-0 bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
      <CardContent className="relative p-6">
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-8 right-24 h-24 w-24 rounded-full bg-teal-300/20 blur-2xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-white/30 shadow-lg">
              <AvatarFallback className="bg-white/20 text-xl font-bold text-white">
                {getInitials(account.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold">{account.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-emerald-50">
                {account.bloodGroup && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                    <Droplet className="h-3 w-3" />
                    {account.bloodGroup}
                  </span>
                )}
                {account.email && (
                  <span className="inline-flex items-center gap-1 text-xs">
                    <ShieldCheck className="h-3 w-3" />
                    {account.email}
                  </span>
                )}
                {age && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-100/80">
                    <Clock className="h-3 w-3" />
                    {age}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            {(account.emergencyName || account.emergencyMobile) && (
              <div className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 backdrop-blur-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/40">
                  <Heart className="h-4 w-4" />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-white">Emergency Contact</p>
                  <p className="text-emerald-50">
                    {account.emergencyName || "—"}
                    {account.emergencyMobile && (
                      <a href={`tel:${account.emergencyMobile}`} className="ml-1 underline decoration-white/40 underline-offset-2 hover:text-white">
                        {account.emergencyMobile}
                      </a>
                    )}
                  </p>
                </div>
              </div>
            )}
            {(account.city || account.state) && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-50">
                <MapPin className="h-3 w-3" />
                {[account.addressLine, account.city, account.state].filter(Boolean).join(", ")}
                {account.pincode && ` — ${account.pincode}`}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============== Loading Skeleton ==============

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}

export default PatientOverview
