"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  format,
  parseISO,
  isSameDay,
  subDays,
  startOfDay,
  addDays,
  isToday as dfIsToday,
} from "date-fns"
import {
  Pill,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  Activity,
  Bell,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { toast } from "sonner"

import { useAuthStore } from "@/lib/auth-store"
import { apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  HeroBanner,
  SectionHeader,
  EmptyState,
  StatCard,
} from "@/components/dashboard/shared/primitives"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Frequency =
  | "ONCE_DAILY"
  | "TWICE_DAILY"
  | "THRICE_DAILY"
  | "WEEKLY"
  | "AS_NEEDED"

interface MedicationLog {
  id: string
  medicationId: string
  patientId: string
  scheduledTime: string // "HH:MM"
  scheduledDate: string // ISO
  takenAt: string | null
  skipped: boolean
  notes?: string | null
}

interface MedicationSchedule {
  id: string
  patientId: string
  medicineName: string
  dosage: string
  frequency: Frequency
  times: string // JSON string of "HH:MM"[]
  startDate: string
  endDate: string | null
  instructions?: string | null
  prescribedBy?: string | null
  isActive: boolean
  createdAt?: string
  logs?: MedicationLog[]
}

type TimeOfDay = "morning" | "afternoon" | "evening" | "night"

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const FREQUENCY_LABEL: Record<Frequency, string> = {
  ONCE_DAILY: "Once daily",
  TWICE_DAILY: "Twice daily",
  THRICE_DAILY: "Thrice daily",
  WEEKLY: "Weekly",
  AS_NEEDED: "As needed",
}

const DEFAULT_TIMES: Record<Frequency, string[]> = {
  ONCE_DAILY: ["09:00"],
  TWICE_DAILY: ["09:00", "21:00"],
  THRICE_DAILY: ["08:00", "14:00", "20:00"],
  WEEKLY: ["09:00"],
  AS_NEEDED: [],
}

const TIME_OF_DAY_META: Record<
  TimeOfDay,
  {
    label: string
    icon: typeof Sunrise
    border: string
    tint: string
    chip: string
    text: string
  }
> = {
  morning: {
    label: "Morning",
    icon: Sunrise,
    border: "border-l-amber-400",
    tint: "bg-amber-50/60 dark:bg-amber-500/5",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    text: "text-amber-600 dark:text-amber-400",
  },
  afternoon: {
    label: "Afternoon",
    icon: Sun,
    border: "border-l-emerald-400",
    tint: "bg-emerald-50/60 dark:bg-emerald-500/5",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  evening: {
    label: "Evening",
    icon: Sunset,
    border: "border-l-rose-400",
    tint: "bg-rose-50/60 dark:bg-rose-500/5",
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    text: "text-rose-600 dark:text-rose-400",
  },
  night: {
    label: "Night",
    icon: Moon,
    border: "border-l-violet-400",
    tint: "bg-violet-50/60 dark:bg-violet-500/5",
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    text: "text-violet-600 dark:text-violet-400",
  },
}

const TIME_OF_DAY_ORDER: TimeOfDay[] = ["morning", "afternoon", "evening", "night"]

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function parseTimes(times: string | undefined | null): string[] {
  if (!times) return []
  try {
    const parsed = JSON.parse(times)
    if (Array.isArray(parsed)) {
      return parsed.filter((t) => typeof t === "string")
    }
  } catch {
    return times
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

function timeOfDayFromHour(hour: number): TimeOfDay {
  if (hour >= 5 && hour <= 11) return "morning"
  if (hour >= 12 && hour <= 16) return "afternoon"
  if (hour >= 17 && hour <= 20) return "evening"
  return "night"
}

function timeOfDayFromHHMM(hhmm: string): TimeOfDay {
  const h = parseInt(hhmm.split(":")[0] || "0", 10)
  return timeOfDayFromHour(Number.isFinite(h) ? h : 0)
}

function formatTime12(hhmm: string): string {
  const parts = hhmm.split(":")
  const h = parseInt(parts[0] || "0", 10)
  const m = parseInt(parts[1] || "0", 10)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm
  const period = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`
}

function toDate(v: string | Date): Date {
  if (v instanceof Date) return v
  return parseISO(v)
}

/** Normalize a Date to local-midnight (preserving the calendar day). */
function dayStart(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Compare two "HH:MM" strings chronologically. */
function compareHHMM(a: string, b: string): number {
  return a.localeCompare(b)
}

/** Is the medication "active" on the given calendar day? */
function medActiveOnDay(med: MedicationSchedule, day: Date): boolean {
  const start = dayStart(toDate(med.startDate))
  const target = dayStart(day)
  if (target.getTime() < start.getTime()) return false
  if (med.endDate) {
    const end = dayStart(toDate(med.endDate))
    if (target.getTime() > end.getTime()) return false
  }
  if (med.frequency === "WEEKLY") {
    // Same weekday as the start date, recurring weekly.
    const diffDays = Math.round(
      (target.getTime() - start.getTime()) / 86400000
    )
    if (diffDays % 7 !== 0) return false
  }
  return true
}

/** Build the expected doses for a given day from a list of medications. */
interface DoseItem {
  key: string
  medication: MedicationSchedule
  time: string
  log?: MedicationLog
}

function buildDosesForDay(
  meds: MedicationSchedule[],
  day: Date
): DoseItem[] {
  const out: DoseItem[] = []
  for (const med of meds) {
    if (!med.isActive) continue
    if (med.frequency === "AS_NEEDED") continue
    if (!medActiveOnDay(med, day)) continue
    const times = parseTimes(med.times)
    for (const t of times) {
      const log = med.logs?.find(
        (l) =>
          l.medicationId === med.id &&
          isSameDay(toDate(l.scheduledDate), day) &&
          l.scheduledTime === t
      )
      out.push({
        key: `${med.id}__${t}`,
        medication: med,
        time: t,
        log,
      })
    }
  }
  out.sort((a, b) => compareHHMM(a.time, b.time))
  return out
}

/** Compute adherence % for a given day from doses. */
function dayAdherence(doses: DoseItem[], day: Date): {
  expected: number
  taken: number
  skipped: number
  missed: number
  percent: number | null
} {
  if (doses.length === 0) {
    return { expected: 0, taken: 0, skipped: 0, missed: 0, percent: null }
  }
  const isToday = dfIsToday(day)
  const now = new Date()
  const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`

  let expected = 0
  let taken = 0
  let skipped = 0
  let missed = 0

  for (const dose of doses) {
    if (isToday) {
      // Only count doses whose scheduled time has already passed (or been logged).
      const timePassed = compareHHMM(dose.time, nowHHMM) <= 0
      if (!timePassed && !dose.log) continue
      expected++
    } else {
      expected++
    }

    if (dose.log?.takenAt) {
      taken++
    } else if (dose.log?.skipped) {
      skipped++
    } else if (isToday) {
      // Scheduled time passed but no log → missed.
      missed++
    } else {
      missed++
    }
  }

  const denom = taken + skipped + missed
  const percent = denom === 0 ? null : Math.round((taken / denom) * 100)
  return { expected, taken, skipped, missed, percent }
}

/* ------------------------------------------------------------------ */
/* Adherence Ring (SVG circle)                                         */
/* ------------------------------------------------------------------ */

function adherenceColor(pct: number | null): string {
  if (pct === null) return "#94a3b8" // slate-400
  if (pct >= 80) return "#10b981" // emerald-500
  if (pct >= 50) return "#f59e0b" // amber-500
  return "#f43f5e" // rose-500
}

function AdherenceRing({
  percent,
  size = 64,
  stroke = 7,
}: {
  percent: number | null
  size?: number
  stroke?: number
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = percent === null ? 0 : Math.min(100, Math.max(0, percent))
  const offset = c - (clamped / 100) * c
  const color = adherenceColor(percent)
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-sm font-bold tabular-nums"
          style={{ color }}
        >
          {percent === null ? "—" : `${percent}%`}
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Adherence Stat Card (custom — uses ring instead of icon)            */
/* ------------------------------------------------------------------ */

function AdherenceStatCard({
  percent,
  trend,
  trendUp,
}: {
  percent: number | null
  trend?: string
  trendUp?: boolean
}) {
  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/5">
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-0 transition-opacity duration-300 group-hover:opacity-100",
          "from-emerald-500 to-teal-500"
        )}
      />
      <div
        className={cn(
          "absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br opacity-5 blur-2xl transition-opacity duration-300 group-hover:opacity-10",
          "from-emerald-500 to-teal-500"
        )}
      />
      <CardContent className="relative flex items-center justify-between p-5">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Today&apos;s Adherence
          </p>
          <p className="mt-1.5 text-3xl font-bold tracking-tight">
            {percent === null ? "—" : `${percent}%`}
          </p>
          {trend && (
            <p
              className={cn(
                "mt-1.5 flex items-center gap-1 truncate text-xs font-medium",
                trendUp === undefined
                  ? "text-muted-foreground"
                  : trendUp
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
              )}
            >
              {trendUp !== undefined && (
                <span className="text-[10px]">{trendUp ? "▲" : "▼"}</span>
              )}
              {trend}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-center">
          <AdherenceRing percent={percent} size={64} />
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Dose Card                                                           */
/* ------------------------------------------------------------------ */

function DoseCard({
  dose,
  index,
  busy,
  onTake,
  onSkip,
}: {
  dose: DoseItem
  index: number
  busy: boolean
  onTake: () => void
  onSkip: () => void
}) {
  const tod = timeOfDayFromHHMM(dose.time)
  const meta = TIME_OF_DAY_META[tod]
  const Icon = meta.icon
  const isTaken = !!dose.log?.takenAt
  const isSkipped = !!dose.log?.skipped

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: "easeOut" }}
      className={cn(
        "rounded-xl border border-l-4 bg-card p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5",
        meta.border,
        isTaken && "border-l-emerald-500 bg-emerald-50/60 dark:bg-emerald-500/10",
        isSkipped && "border-l-muted-foreground/30 bg-muted/40 dark:bg-muted/20"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Time-of-day icon */}
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            meta.chip
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn("font-mono font-semibold tabular-nums", meta.text)}
            >
              <Clock className="mr-1 h-3 w-3" />
              {formatTime12(dose.time)}
            </Badge>
            {isTaken && (
              <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" />
                Taken
                {dose.log?.takenAt
                  ? ` at ${format(parseISO(dose.log.takenAt), "h:mm a")}`
                  : ""}
              </Badge>
            )}
            {isSkipped && (
              <Badge className="gap-1 bg-muted text-muted-foreground hover:bg-muted">
                <XCircle className="h-3 w-3" />
                Skipped
              </Badge>
            )}
          </div>

          <h4
            className={cn(
              "mt-1.5 font-semibold leading-tight",
              isSkipped && "text-muted-foreground line-through"
            )}
          >
            {dose.medication.medicineName}
          </h4>
          <p className="text-sm text-muted-foreground">{dose.medication.dosage}</p>

          {dose.medication.instructions && (
            <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
              <Bell className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="line-clamp-2">{dose.medication.instructions}</span>
            </p>
          )}
          {dose.medication.prescribedBy && (
            <p className="mt-0.5 text-xs text-muted-foreground/80">
              Prescribed by {dose.medication.prescribedBy}
            </p>
          )}
        </div>

        {/* Action / status column */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {!isTaken && !isSkipped ? (
            <>
              <Button
                size="sm"
                onClick={onTake}
                disabled={busy}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Take
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onSkip}
                disabled={busy}
                className="text-muted-foreground hover:text-rose-600"
              >
                <XCircle className="h-3.5 w-3.5" />
                Skip
              </Button>
            </>
          ) : isTaken ? (
            <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <XCircle className="h-7 w-7 text-muted-foreground" />
          )}
        </div>
      </div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* Weekly chart tooltip                                                */
/* ------------------------------------------------------------------ */

interface ChartTipProps {
  active?: boolean
  payload?: Array<{
    payload?: { label: string; pct: number | null; taken: number; expected: number }
  }>
}

function ChartTip({ active, payload }: ChartTipProps) {
  if (!active || !payload || !payload.length) return null
  const p = payload[0].payload
  if (!p) return null
  return (
    <div className="rounded-lg border border-emerald-100 bg-white/95 p-3 text-xs shadow-md backdrop-blur dark:border-emerald-900/50 dark:bg-slate-900/95">
      <p className="font-medium text-foreground">{p.label}</p>
      <p className="mt-0.5 text-emerald-600 dark:text-emerald-400">
        <span className="font-medium">Adherence:</span>{" "}
        {p.pct === null ? "—" : `${p.pct}%`}
      </p>
      <p className="mt-0.5 text-muted-foreground">
        <span className="font-medium">Taken:</span> {p.taken}/{p.expected}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Loading skeleton                                                    */
/* ------------------------------------------------------------------ */

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-48 rounded-lg" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Add / Edit Medication Dialog                                        */
/* ------------------------------------------------------------------ */

interface MedFormState {
  medicineName: string
  dosage: string
  frequency: Frequency
  times: string[]
  instructions: string
  prescribedBy: string
  startDate: string
}

const EMPTY_FORM: MedFormState = {
  medicineName: "",
  dosage: "",
  frequency: "ONCE_DAILY",
  times: ["09:00"],
  instructions: "",
  prescribedBy: "",
  startDate: "",
}

function toLocalDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function fromMedToForm(med: MedicationSchedule): MedFormState {
  return {
    medicineName: med.medicineName,
    dosage: med.dosage,
    frequency: med.frequency,
    times: parseTimes(med.times),
    instructions: med.instructions ?? "",
    prescribedBy: med.prescribedBy ?? "",
    startDate: toLocalDateInput(toDate(med.startDate)),
  }
}

function MedicationFormDialog({
  open,
  onOpenChange,
  editing,
  submitting,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: MedicationSchedule | null
  submitting: boolean
  onSubmit: (form: MedFormState) => Promise<void>
}) {
  // Initialise from the `editing` prop at mount time. The parent remounts this
  // component (via a `key` that changes whenever the dialog opens) so the form
  // always starts fresh without needing a synchronous setState-in-effect.
  const [form, setForm] = useState<MedFormState>(() =>
    editing ? fromMedToForm(editing) : EMPTY_FORM
  )
  const [error, setError] = useState<string | null>(null)

  const handleFrequencyChange = (freq: Frequency) => {
    setForm((prev) => {
      // Only reset times if user switches frequency AND the current times
      // count doesn't match the new frequency's expected count.
      const defaults = DEFAULT_TIMES[freq]
      const sameCount = prev.times.length === defaults.length
      return {
        ...prev,
        frequency: freq,
        times: sameCount ? prev.times : defaults,
      }
    })
  }

  const handleTimeChange = (idx: number, value: string) => {
    setForm((prev) => {
      const next = [...prev.times]
      next[idx] = value
      return { ...prev, times: next }
    })
  }

  const handleAddTime = () => {
    setForm((prev) => ({ ...prev, times: [...prev.times, "12:00"] }))
  }

  const handleRemoveTime = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      times: prev.times.filter((_, i) => i !== idx),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.medicineName.trim()) {
      setError("Medicine name is required")
      return
    }
    if (!form.dosage.trim()) {
      setError("Dosage is required")
      return
    }
    setError(null)
    await onSubmit(form)
  }

  const showTimes = form.frequency !== "AS_NEEDED"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {editing ? "Edit Medication" : "Add Medication"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the details of this medication."
              : "Add a new medication to your daily schedule."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="med-name">
                Medicine name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="med-name"
                placeholder="e.g. Amlodipine"
                value={form.medicineName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, medicineName: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="med-dosage">
                Dosage <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="med-dosage"
                placeholder="e.g. 5 mg, 1 tablet"
                value={form.dosage}
                onChange={(e) =>
                  setForm((p) => ({ ...p, dosage: e.target.value }))
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="med-freq">Frequency</Label>
            <Select
              value={form.frequency}
              onValueChange={(v) => handleFrequencyChange(v as Frequency)}
            >
              <SelectTrigger id="med-freq" className="w-full">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => (
                  <SelectItem key={f} value={f}>
                    {FREQUENCY_LABEL[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showTimes && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Scheduled times</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddTime}
                  className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add time
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.times.map((t, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1 rounded-lg border bg-background px-2 py-1"
                  >
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="time"
                      value={t}
                      onChange={(e) => handleTimeChange(idx, e.target.value)}
                      className="bg-transparent text-sm outline-none"
                    />
                    {form.times.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTime(idx)}
                        className="ml-1 text-muted-foreground hover:text-rose-600"
                        aria-label="Remove time"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {form.times.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No times set — click &ldquo;Add time&rdquo;.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="med-instructions">Instructions (optional)</Label>
            <Textarea
              id="med-instructions"
              placeholder="e.g. After meals, with water"
              value={form.instructions}
              onChange={(e) =>
                setForm((p) => ({ ...p, instructions: e.target.value }))
              }
              rows={2}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="med-prescribed">Prescribed by (optional)</Label>
              <Input
                id="med-prescribed"
                placeholder="e.g. Dr. Sarah Smith"
                value={form.prescribedBy}
                onChange={(e) =>
                  setForm((p) => ({ ...p, prescribedBy: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="med-start">Start date</Label>
              <Input
                id="med-start"
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, startDate: e.target.value }))
                }
              />
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pill className="h-4 w-4" />
              )}
              {editing ? "Save changes" : "Add medication"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* All-Medications list row                                            */
/* ------------------------------------------------------------------ */

function FreqBadge({ freq }: { freq: Frequency }) {
  const palette: Record<Frequency, string> = {
    ONCE_DAILY:
      "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300",
    TWICE_DAILY:
      "bg-teal-100 text-teal-700 hover:bg-teal-100 dark:bg-teal-500/15 dark:text-teal-300",
    THRICE_DAILY:
      "bg-cyan-100 text-cyan-700 hover:bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300",
    WEEKLY:
      "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300",
    AS_NEEDED:
      "bg-slate-100 text-slate-700 hover:bg-slate-100 dark:bg-slate-500/15 dark:text-slate-300",
  }
  return <Badge className={cn("gap-1", palette[freq])}>{FREQUENCY_LABEL[freq]}</Badge>
}

function MedicationRow({
  med,
  onEdit,
  onDelete,
}: {
  med: MedicationSchedule
  onEdit: () => void
  onDelete: () => void
}) {
  const times = parseTimes(med.times)
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-emerald-500/5">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                <Pill className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="truncate font-semibold leading-tight">
                    {med.medicineName}
                  </h4>
                  <FreqBadge freq={med.frequency} />
                  {!med.isActive && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Inactive
                    </Badge>
                  )}
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {med.dosage}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {times.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {times.map(formatTime12).join(" · ")}
                    </span>
                  )}
                  {med.prescribedBy && (
                    <span className="inline-flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      {med.prescribedBy}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Started {format(toDate(med.startDate), "dd MMM yyyy")}
                  </span>
                </div>
                {med.instructions && (
                  <p className="mt-1.5 flex items-start gap-1 text-xs text-muted-foreground">
                    <Bell className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="line-clamp-2">{med.instructions}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={onEdit}
                className="text-muted-foreground hover:text-emerald-600"
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                className="text-muted-foreground hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function MedicationSchedule() {
  const user = useAuthStore((s) => s.user)
  const [medications, setMedications] = useState<MedicationSchedule[] | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MedicationSchedule | null>(null)
  // Bumped each time the Add/Edit dialog is opened so the form remounts with a
  // fresh initial state (avoids synchronous setState-in-effect for resets).
  const [dialogKey, setDialogKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [deleteMed, setDeleteMed] = useState<MedicationSchedule | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [logBusyKey, setLogBusyKey] = useState<string | null>(null)
  const [allOpen, setAllOpen] = useState(true)

  /* ---------------- Fetch medications + logs ---------------- */
  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      try {
        const data = await apiFetch<{ medications: MedicationSchedule[] }>(
          `/api/medications?patientId=${encodeURIComponent(
            user.id
          )}&logs=true&days=7`
        )
        if (cancelled) return
        setMedications(data.medications ?? [])
        setError(null)
      } catch (e) {
        if (cancelled) return
        setError(
          e instanceof Error ? e.message : "Failed to load medications"
        )
        setMedications([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, reloadNonce])

  const refetch = useCallback(() => setReloadNonce((n) => n + 1), [])

  /* ---------------- Derived: doses for selected day ---------------- */
  const dosesForSelected = useMemo<DoseItem[]>(() => {
    if (!medications) return []
    return buildDosesForDay(medications, selectedDate)
  }, [medications, selectedDate])

  const todaysAdherence = useMemo(() => {
    const today = new Date()
    const doses = medications ? buildDosesForDay(medications, today) : []
    return dayAdherence(doses, today)
  }, [medications])

  // Yesterday's adherence for the trend.
  const yesterdaysAdherence = useMemo(() => {
    if (!medications) return null
    const y = subDays(new Date(), 1)
    const doses = buildDosesForDay(medications, y)
    return dayAdherence(doses, y)
  }, [medications])

  const trendUp =
    todaysAdherence.percent !== null && yesterdaysAdherence?.percent !== null
      ? todaysAdherence.percent >= yesterdaysAdherence.percent
      : undefined
  const trend =
    todaysAdherence.percent !== null && yesterdaysAdherence?.percent !== null
      ? `${Math.abs(todaysAdherence.percent - yesterdaysAdherence.percent)}% vs yesterday`
      : undefined

  /* ---------------- Derived: weekly chart data ---------------- */
  const weeklyData = useMemo(() => {
    if (!medications) return []
    const today = new Date()
    const out: Array<{
      date: Date
      label: string
      pct: number | null
      taken: number
      expected: number
    }> = []
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i)
      const doses = buildDosesForDay(medications, d)
      const a = dayAdherence(doses, d)
      out.push({
        date: d,
        label: format(d, "EEE dd"),
        pct: a.percent,
        taken: a.taken,
        expected: a.expected,
      })
    }
    return out
  }, [medications])

  /* ---------------- Stat-card inputs ---------------- */
  const activeMedsCount = useMemo(
    () => (medications ?? []).filter((m) => m.isActive).length,
    [medications]
  )
  const todayDosesCount = todaysAdherence.expected
  const todayTakenCount = todaysAdherence.taken

  /* ---------------- Helpers: log actions (optimistic) ---------------- */
  const upsertLogLocal = useCallback(
    (medId: string, time: string, log: MedicationLog) => {
      setMedications((prev) => {
        if (!prev) return prev
        return prev.map((m) => {
          if (m.id !== medId) return m
          const existing = m.logs ?? []
          const idx = existing.findIndex(
            (l) =>
              isSameDay(toDate(l.scheduledDate), dayStart(selectedDate)) &&
              l.scheduledTime === time
          )
          let nextLogs: MedicationLog[]
          if (idx >= 0) {
            nextLogs = [...existing]
            nextLogs[idx] = log
          } else {
            nextLogs = [...existing, log]
          }
          return { ...m, logs: nextLogs }
        })
      })
    },
    [selectedDate]
  )

  const markDose = useCallback(
    async (
      med: MedicationSchedule,
      time: string,
      taken: boolean,
      skipped: boolean
    ) => {
      if (!user) return
      const busyKey = `${med.id}__${time}`
      setLogBusyKey(busyKey)
      try {
        const scheduledDateISO = dayStart(selectedDate).toISOString()
        const data = await apiFetch<{ log: MedicationLog }>(
          "/api/medications/log",
          {
            method: "POST",
            body: JSON.stringify({
              medicationId: med.id,
              patientId: user.id,
              scheduledTime: time,
              scheduledDate: scheduledDateISO,
              taken,
              skipped,
            }),
          }
        )
        upsertLogLocal(med.id, time, data.log)
        toast.success(
          taken
            ? `Marked ${med.medicineName} (${formatTime12(time)}) as taken`
            : `Skipped ${med.medicineName} (${formatTime12(time)})`
        )
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Failed to update dose status"
        )
        // Refetch to ensure consistency.
        refetch()
      } finally {
        setLogBusyKey(null)
      }
    },
    [user, selectedDate, upsertLogLocal, refetch]
  )

  /* ---------------- Add / Edit / Delete ---------------- */
  const openAddDialog = useCallback(() => {
    setEditing(null)
    setDialogKey((k) => k + 1)
    setDialogOpen(true)
  }, [])

  const openEditDialog = useCallback((med: MedicationSchedule) => {
    setEditing(med)
    setDialogKey((k) => k + 1)
    setDialogOpen(true)
  }, [])

  const handleSubmit = useCallback(
    async (form: MedFormState) => {
      if (!user) return
      setSubmitting(true)
      try {
        const payload: Record<string, unknown> = {
          patientId: user.id,
          medicineName: form.medicineName.trim(),
          dosage: form.dosage.trim(),
          frequency: form.frequency,
          times:
            form.frequency === "AS_NEEDED"
              ? []
              : form.times.filter((t) => /^\d{2}:\d{2}$/.test(t)),
          instructions: form.instructions.trim() || undefined,
          prescribedBy: form.prescribedBy.trim() || undefined,
          startDate: form.startDate || new Date().toISOString(),
        }
        if (editing) {
          payload.id = editing.id
          const res = await apiFetch<{ medication: MedicationSchedule }>(
            "/api/medications",
            {
              method: "PATCH",
              body: JSON.stringify(payload),
            }
          )
          // Nuclear fix: gate toast + state update on the response payload.
          if (!res?.medication) {
            throw new Error("Server confirmed the update but did not return the record.")
          }
          setMedications((prev) =>
            (prev ?? []).map((m) => (m.id === editing.id ? { ...m, ...res.medication } : m))
          )
          toast.success("Medication updated")
        } else {
          const res = await apiFetch<{ medication: MedicationSchedule }>(
            "/api/medications",
            {
              method: "POST",
              body: JSON.stringify(payload),
            }
          )
          // Nuclear fix: the POST response IS the canonical record.
          // Gate the toast + state update on the response payload so we
          // never show a false "successfully added" toast. Do NOT fire an
          // un-awaited background refetch — Supabase pooler read-after-write
          // lag can cause the refetch to return a list WITHOUT the new item,
          // which would wholesale-replace state and silently wipe it.
          if (!res?.medication) {
            throw new Error("Server confirmed the save but did not return the record.")
          }
          setMedications((prev) => [res.medication, ...(prev ?? [])])
          toast.success("Medication added")
        }
        setDialogOpen(false)
        // No background refetch — the POST response above is the source of truth.
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Failed to save medication"
        )
      } finally {
        setSubmitting(false)
      }
    },
    [user, editing, refetch]
  )

  const handleDelete = useCallback(async () => {
    if (!deleteMed) return
    setDeleting(true)
    try {
      const id = deleteMed.id
      await apiFetch<{ ok: true }>(
        `/api/medications?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      )
      // Optimistic delete — local state is already correct.
      setMedications((prev) => (prev ?? []).filter((m) => m.id !== id))
      toast.success("Medication removed")
      setDeleteMed(null)
      // No background refetch — the optimistic delete is authoritative.
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to delete medication"
      )
    } finally {
      setDeleting(false)
    }
  }, [deleteMed, refetch])

  /* ---------------- Date navigation ---------------- */
  const goPrevDay = () => setSelectedDate((d) => subDays(d, 1))
  const goNextDay = () => setSelectedDate((d) => addDays(d, 1))
  const goToday = () => setSelectedDate(new Date())
  const isSelectedToday = dfIsToday(selectedDate)

  /* ---------------- Group doses by time-of-day ---------------- */
  const groupedDoses = useMemo(() => {
    const map: Record<TimeOfDay, DoseItem[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
    }
    for (const d of dosesForSelected) {
      map[timeOfDayFromHHMM(d.time)].push(d)
    }
    return map
  }, [dosesForSelected])

  /* ---------------- Render ---------------- */
  if (!user) return null

  const loading = medications === null && !error

  return (
    <div className="space-y-6">
      <HeroBanner
        title="Medication Schedule"
        subtitle="Track your daily medicines and adherence"
        icon={Pill}
      />

      {error && (
        <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-500/20 dark:bg-rose-500/5">
          <CardContent className="flex items-start gap-3 p-5">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                Couldn&apos;t load medications
              </p>
              <p className="mt-0.5 text-sm text-rose-700/80 dark:text-rose-300/80">
                {error}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 border-rose-200 text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:text-rose-300"
                onClick={refetch}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && <LoadingSkeleton />}

      {!loading && (
        <>
          {/* Stat cards row */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Active Medications"
              value={activeMedsCount}
              icon={Pill}
              color="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
              accent="from-emerald-500 to-teal-500"
              trend={
                activeMedsCount === 0
                  ? "No medications yet"
                  : `${activeMedsCount} active`
              }
            />
            <StatCard
              title="Today's Doses"
              value={todayDosesCount}
              icon={Clock}
              color="bg-amber-50 text-amber-600 dark:bg-amber-500/10"
              accent="from-amber-500 to-orange-500"
              trend={
                todayDosesCount === 0
                  ? "Nothing scheduled"
                  : `${todayDosesCount} scheduled today`
              }
            />
            <StatCard
              title="Taken Today"
              value={todayTakenCount}
              icon={CheckCircle2}
              color="bg-teal-50 text-teal-600 dark:bg-teal-500/10"
              accent="from-teal-500 to-emerald-500"
              trend={
                todayDosesCount > 0
                  ? `${todayTakenCount}/${todayDosesCount} done`
                  : "No doses today"
              }
              trendUp={todayDosesCount > 0 && todayTakenCount > 0}
            />
            <AdherenceStatCard
              percent={todaysAdherence.percent}
              trend={trend}
              trendUp={trendUp}
            />
          </div>

          {/* Date selector */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={goPrevDay}
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={isSelectedToday ? "default" : "outline"}
                onClick={goToday}
                className={
                  isSelectedToday
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : ""
                }
              >
                Today
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={goNextDay}
                disabled={isSelectedToday}
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-1.5 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-semibold">
                  {format(selectedDate, "EEEE, dd MMM yyyy")}
                </span>
                {isSelectedToday && (
                  <Badge className="ml-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300">
                    Live
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={refetch}
                aria-label="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={openAddDialog}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                Add Medication
              </Button>
            </div>
          </div>

          {/* Today's Schedule section */}
          <section>
            <SectionHeader
              title="Today's Schedule"
              description={
                isSelectedToday
                  ? "Your medicines scheduled for today — mark each dose as taken or skipped."
                  : `Medicines scheduled on ${format(selectedDate, "dd MMM yyyy")}.`
              }
              icon={Clock}
              action={
                dosesForSelected.length > 0 ? (
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300">
                    {dosesForSelected.length} dose
                    {dosesForSelected.length === 1 ? "" : "s"}
                  </Badge>
                ) : undefined
              }
            />

            {dosesForSelected.length === 0 ? (
              <EmptyState
                icon={Pill}
                title="No doses scheduled"
                description={
                  activeMedsCount === 0
                    ? "Add a medication to start tracking your daily schedule."
                    : "None of your active medications are scheduled for this day."
                }
                action={
                  activeMedsCount === 0 ? (
                    <Button
                      onClick={openAddDialog}
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add your first medication
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-6">
                {TIME_OF_DAY_ORDER.map((tod) => {
                  const group = groupedDoses[tod]
                  if (group.length === 0) return null
                  const meta = TIME_OF_DAY_META[tod]
                  const GroupIcon = meta.icon
                  return (
                    <div key={tod} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-md",
                            meta.chip
                          )}
                        >
                          <GroupIcon className="h-4 w-4" />
                        </div>
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          {meta.label}
                        </h3>
                        <Badge variant="outline" className="text-muted-foreground">
                          {group.length}
                        </Badge>
                        <Separator className="flex-1" />
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {group.map((dose, idx) => (
                          <DoseCard
                            key={dose.key}
                            dose={dose}
                            index={idx}
                            busy={logBusyKey === dose.key}
                            onTake={() =>
                              markDose(dose.medication, dose.time, true, false)
                            }
                            onSkip={() =>
                              markDose(dose.medication, dose.time, false, true)
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Weekly Adherence Chart */}
          <section>
            <SectionHeader
              title="Weekly Adherence"
              description="Your medication adherence over the last 7 days."
              icon={Activity}
            />
            <Card className="rounded-xl shadow-sm">
              <CardContent className="p-5">
                {weeklyData.every((d) => d.expected === 0) ? (
                  <div className="flex h-48 items-center justify-center rounded-lg border border-dashed bg-muted/20 text-xs text-muted-foreground">
                    No scheduled doses in the last 7 days.
                  </div>
                ) : (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={weeklyData}
                        margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
                        barCategoryGap="22%"
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="currentColor"
                          className="text-muted/30"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11 }}
                          stroke="currentColor"
                          className="text-muted-foreground"
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          stroke="currentColor"
                          className="text-muted-foreground"
                          tickLine={false}
                          axisLine={false}
                          width={36}
                          domain={[0, 100]}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <RTooltip content={<ChartTip />} cursor={{ fill: "rgba(16,185,129,0.08)" }} />
                        <Bar dataKey="pct" radius={[6, 6, 0, 0]} maxBarSize={48}>
                          {weeklyData.map((entry, idx) => (
                            <Cell
                              key={idx}
                              fill={adherenceColor(entry.pct)}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    ≥80% Excellent
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    50–79% Fair
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    &lt;50% Needs attention
                  </span>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* All Medications section (collapsible) */}
          <section>
            <Collapsible open={allOpen} onOpenChange={setAllOpen}>
              <Card className="overflow-hidden rounded-xl">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                        <Pill className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold tracking-tight">
                          All Medications
                        </h2>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          Manage your active and inactive medications.
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline" className="text-muted-foreground">
                        {(medications ?? []).length} total
                      </Badge>
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          allOpen && "rotate-90"
                        )}
                      />
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t px-5 pb-5 pt-4">
                    {(medications ?? []).length === 0 ? (
                      <EmptyState
                        icon={Pill}
                        title="No medications yet"
                        description="Add your first medication to build your daily schedule."
                        action={
                          <Button
                            onClick={openAddDialog}
                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            <Plus className="h-4 w-4" />
                            Add medication
                          </Button>
                        }
                      />
                    ) : (
                      <div className="space-y-3">
                        <AnimatePresence>
                          {(medications ?? []).map((med) => (
                            <MedicationRow
                              key={med.id}
                              med={med}
                              onEdit={() => openEditDialog(med)}
                              onDelete={() => setDeleteMed(med)}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </section>
        </>
      )}

      {/* Add / Edit dialog — `key` forces a clean remount (and fresh form
          state) every time the dialog is opened. */}
      <MedicationFormDialog
        key={dialogKey}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        submitting={submitting}
        onSubmit={handleSubmit}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteMed}
        onOpenChange={(v) => !v && setDeleteMed(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              Remove medication?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold text-foreground">
                {deleteMed?.medicineName} ({deleteMed?.dosage})
              </span>{" "}
              and all its dose logs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default MedicationSchedule
