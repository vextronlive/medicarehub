"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  format,
  parseISO,
  differenceInCalendarDays,
  addDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
} from "date-fns"
import {
  CalendarHeart,
  Heart,
  Droplet,
  Sparkles,
  Flower2,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Lock,
  Pencil,
  TrendingUp,
  Moon,
  Smile,
  Frown,
  Angry,
  Annoyed,
  Meh,
} from "lucide-react"
import { toast } from "sonner"

import { useAuthStore } from "@/lib/auth-store"
import { apiFetch } from "@/lib/api"
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
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
import { cn } from "@/lib/utils"

// ============== Types ==============
type FlowLevel = "LIGHT" | "MODERATE" | "HEAVY"
type Mood = "HAPPY" | "SAD" | "IRRITABLE" | "ANXIOUS" | "NEUTRAL"

interface CycleLog {
  id: string
  startDate: string
  endDate: string | null
  flowLevel: FlowLevel
  symptoms: string | null
  mood: Mood | null
  notes: string | null
  cycleLength: number | null
  periodLength: number | null
}

interface CycleStats {
  avgCycleLength: number
  avgPeriodLength: number
  nextPredictedStart: string | null
  nextPredictedEnd: string | null
  fertileStart: string | null
  fertileEnd: string | null
  ovulationDay: string | null
  totalCyclesTracked: number
}

// ============== Constants ==============
const SYMPTOM_OPTIONS = [
  "Cramps",
  "Headache",
  "Bloating",
  "Fatigue",
  "Mood swings",
  "Breast tenderness",
  "Back pain",
  "Acne",
  "Cravings",
  "Insomnia",
] as const

const FLOW_META: Record<
  FlowLevel,
  { label: string; badge: string; dot: string }
> = {
  LIGHT: {
    label: "Light",
    badge:
      "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-900/50",
    dot: "bg-sky-400",
  },
  MODERATE: {
    label: "Moderate",
    badge:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-900/50",
    dot: "bg-amber-500",
  },
  HEAVY: {
    label: "Heavy",
    badge:
      "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-900/50",
    dot: "bg-rose-500",
  },
}

const MOOD_META: Record<
  Mood,
  { label: string; icon: typeof Smile; emoji: string }
> = {
  HAPPY: { label: "Happy", icon: Smile, emoji: "😊" },
  SAD: { label: "Sad", icon: Frown, emoji: "😢" },
  IRRITABLE: { label: "Irritable", icon: Angry, emoji: "😠" },
  ANXIOUS: { label: "Anxious", icon: Annoyed, emoji: "😟" },
  NEUTRAL: { label: "Neutral", icon: Meh, emoji: "😐" },
}

function parseSymptoms(raw: string | null): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []
  } catch {
    return []
  }
}

function toDate(v: string | Date): Date {
  if (v instanceof Date) return v
  return parseISO(v)
}

// ============== Calendar ==============
interface DayInfo {
  date: Date
  inMonth: boolean
  isToday: boolean
  isPeriod: boolean
  isPredicted: boolean
  isFertile: boolean
  isOvulation: boolean
  flowLevel?: FlowLevel
}

function CalendarView({
  logs,
  stats,
  monthDate,
  onPrev,
  onNext,
}: {
  logs: CycleLog[]
  stats: CycleStats
  monthDate: Date
  onPrev: () => void
  onNext: () => void
}) {
  const today = new Date()

  const days = useMemo<DayInfo[]>(() => {
    const monthStart = startOfMonth(monthDate)
    const monthEnd = endOfMonth(monthDate)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd })

    return allDays.map((d) => {
      const info: DayInfo = {
        date: d,
        inMonth: isSameMonth(d, monthDate),
        isToday: isSameDay(d, today),
        isPeriod: false,
        isPredicted: false,
        isFertile: false,
        isOvulation: false,
      }

      // Actual logged periods
      for (const log of logs) {
        const start = toDate(log.startDate)
        const end = log.endDate ? toDate(log.endDate) : start
        if (d >= start && d <= end) {
          info.isPeriod = true
          info.flowLevel = log.flowLevel
        }
      }

      // Predicted next period
      if (stats.nextPredictedStart && stats.nextPredictedEnd) {
        const ps = toDate(stats.nextPredictedStart)
        const pe = toDate(stats.nextPredictedEnd)
        if (d >= ps && d <= pe) info.isPredicted = true
      } else if (stats.nextPredictedStart) {
        if (isSameDay(d, toDate(stats.nextPredictedStart)))
          info.isPredicted = true
      }

      // Fertile window
      if (stats.fertileStart && stats.fertileEnd) {
        const fs = toDate(stats.fertileStart)
        const fe = toDate(stats.fertileEnd)
        if (d >= fs && d <= fe) info.isFertile = true
      }

      // Ovulation day
      if (stats.ovulationDay && isSameDay(d, toDate(stats.ovulationDay))) {
        info.isOvulation = true
      }

      return info
    })
  }, [logs, stats, monthDate, today])

  const weekdays = ["S", "M", "T", "W", "T", "F", "S"]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarHeart className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              Cycle Calendar
            </CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              Tracked periods, predicted next period, fertile window, and
              ovulation day.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={onPrev}>
              ←
            </Button>
            <span className="min-w-[110px] text-center text-sm font-medium">
              {format(monthDate, "MMMM yyyy")}
            </span>
            <Button size="sm" variant="outline" onClick={onNext}>
              →
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {weekdays.map((d, i) => (
            <div
              key={i}
              className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {d}
            </div>
          ))}
          {days.map((d, i) => {
            const flow = d.flowLevel ? FLOW_META[d.flowLevel] : null
            return (
              <div
                key={i}
                className={cn(
                  "relative aspect-square rounded-md border p-1 text-[10px] transition-colors",
                  !d.inMonth && "bg-muted/20 text-muted-foreground/50",
                  d.inMonth && "bg-background",
                  d.isToday &&
                    "border-emerald-400 ring-1 ring-emerald-400 dark:border-emerald-500 dark:ring-emerald-500",
                  d.isPeriod && flow && "border-transparent",
                  d.isPredicted && "border-dashed border-rose-400 dark:border-rose-500",
                  d.isFertile && !d.isPeriod && "bg-rose-50 dark:bg-rose-500/10",
                  !d.isPeriod && !d.isPredicted && !d.isFertile && !d.isToday && "border-transparent"
                )}
                style={
                  d.isPeriod && flow
                    ? { backgroundColor: undefined }
                    : undefined
                }
              >
                {/* Period background tint */}
                {d.isPeriod && (
                  <div
                    className={cn(
                      "absolute inset-0 rounded-md opacity-80",
                      d.flowLevel === "HEAVY"
                        ? "bg-rose-200 dark:bg-rose-500/30"
                        : d.flowLevel === "MODERATE"
                          ? "bg-rose-100 dark:bg-rose-500/20"
                          : "bg-rose-50 dark:bg-rose-500/10"
                    )}
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 font-medium",
                    d.isToday && "text-emerald-700 dark:text-emerald-400"
                  )}
                >
                  {format(d.date, "d")}
                </span>
                {/* Ovulation heart */}
                {d.isOvulation && (
                  <Heart
                    className="absolute bottom-0.5 right-0.5 z-10 h-3 w-3 fill-rose-500 text-rose-500"
                    aria-label="Ovulation"
                  />
                )}
                {/* Period dot */}
                {d.isPeriod && (
                  <span
                    className={cn(
                      "absolute bottom-0.5 left-0.5 z-10 inline-block h-1.5 w-1.5 rounded-full",
                      flow?.dot || "bg-rose-500"
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-200 dark:bg-rose-500/30" />
            Period
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-rose-400" />
            Predicted
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-50 dark:bg-rose-500/10" />
            Fertile
          </span>
          <span className="flex items-center gap-1.5">
            <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
            Ovulation
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border border-emerald-400" />
            Today
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

// ============== Log Dialog ==============
function LogPeriodDialog({
  open,
  onOpenChange,
  onSaved,
  patientId,
  editing,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: (newLog?: CycleLog, editingId?: string) => void
  patientId: string
  editing: CycleLog | null
}) {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [flowLevel, setFlowLevel] = useState<FlowLevel>("MODERATE")
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [mood, setMood] = useState<Mood>("NEUTRAL")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      if (editing) {
        setStartDate(editing.startDate.slice(0, 10))
        setEndDate(editing.endDate ? editing.endDate.slice(0, 10) : "")
        setFlowLevel(editing.flowLevel || "MODERATE")
        setSymptoms(parseSymptoms(editing.symptoms))
        setMood(editing.mood || "NEUTRAL")
        setNotes(editing.notes || "")
      } else {
        setStartDate(format(new Date(), "yyyy-MM-dd"))
        setEndDate("")
        setFlowLevel("MODERATE")
        setSymptoms([])
        setMood("NEUTRAL")
        setNotes("")
      }
    }
  }, [open, editing])

  const toggleSymptom = (s: string) => {
    setSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    )
  }

  const handleSubmit = async () => {
    if (!startDate) {
      toast.error("Start date is required")
      return
    }
    if (endDate && endDate < startDate) {
      toast.error("End date cannot be before start date")
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const res = await apiFetch<{ log: CycleLog }>(`/api/menstrual`, {
          method: "PATCH",
          body: JSON.stringify({
            id: editing.id,
            endDate: endDate || undefined,
            flowLevel,
            mood,
            notes: notes.trim() || undefined,
          }),
        })
        // Nuclear fix: gate toast + state update on the response payload.
        // Do NOT fire an un-awaited background refetch — Supabase pooler
        // read-after-write lag can cause the refetch to return a list
        // WITHOUT the updated item, wholesale-replacing state and silently
        // wiping it.
        if (!res?.log) {
          throw new Error("Server confirmed the update but did not return the record.")
        }
        toast.success("Period entry updated")
        onOpenChange(false)
        onSaved(res.log, editing.id)
      } else {
        const res = await apiFetch<{ log: CycleLog }>(`/api/menstrual`, {
          method: "POST",
          body: JSON.stringify({
            patientId,
            startDate,
            endDate: endDate || undefined,
            flowLevel,
            symptoms,
            mood,
            notes: notes.trim() || undefined,
          }),
        })
        // Nuclear fix: the POST response IS the canonical record.
        // Gate the toast + state update on the response payload so we
        // never show a false "successfully added" toast. Do NOT fire an
        // un-awaited background refetch — Supabase pooler read-after-write
        // lag can cause the refetch to return a list WITHOUT the new item,
        // which would wholesale-replace state and silently wipe it.
        if (!res?.log) {
          throw new Error("Server confirmed the save but did not return the record.")
        }
        toast.success("Period logged")
        onOpenChange(false)
        onSaved(res.log)
      }
    } catch (e) {
      toast.error((e as Error).message || "Failed to save period entry")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400">
              <Droplet className="h-4 w-4" />
            </div>
            {editing ? "Edit Period Entry" : "Log New Period"}
          </DialogTitle>
          <DialogDescription>
            Track your menstrual cycle to predict future periods and fertility
            windows.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="period-start" className="text-xs">
                Start date *
              </Label>
              <Input
                id="period-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period-end" className="text-xs">
                End date (optional)
              </Label>
              <Input
                id="period-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
                max={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Flow level</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["LIGHT", "MODERATE", "HEAVY"] as FlowLevel[]).map((f) => {
                const meta = FLOW_META[f]
                const active = flowLevel === f
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFlowLevel(f)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                      active
                        ? cn(meta.badge, "ring-1 ring-current/30")
                        : "bg-background hover:bg-muted/40"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-2 w-2 rounded-full",
                        meta.dot
                      )}
                    />
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Symptoms</Label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {SYMPTOM_OPTIONS.map((s) => {
                const checked = symptoms.includes(s)
                return (
                  <label
                    key={s}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors",
                      checked
                        ? "border-rose-300 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-500/10"
                        : "bg-background hover:bg-muted/40"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleSymptom(s)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="truncate">{s}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Mood</Label>
            <Select
              value={mood}
              onValueChange={(v) => setMood(v as Mood)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MOOD_META) as Mood[]).map((m) => {
                  const meta = MOOD_META[m]
                  const Icon = meta.icon
                  return (
                    <SelectItem key={m} value={m}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" />
                        {meta.emoji} {meta.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="period-notes" className="text-xs">
              Notes (optional)
            </Label>
            <Textarea
              id="period-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything you'd like to remember about this cycle…"
              className="min-h-[64px] resize-y text-sm"
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
            onClick={handleSubmit}
            disabled={saving}
            className="bg-gradient-to-r from-rose-600 to-pink-600 text-white hover:from-rose-700 hover:to-pink-700"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {editing ? "Update entry" : "Save entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============== Insights ==============
function InsightsCard({
  logs,
  stats,
}: {
  logs: CycleLog[]
  stats: CycleStats
}) {
  const insights = useMemo(() => {
    const out: { icon: typeof Sparkles; text: string; tone: "good" | "warn" | "info" }[] = []
    if (logs.length === 0) {
      out.push({
        icon: Sparkles,
        text: "Log your first period to unlock personalized cycle insights.",
        tone: "info",
      })
      return out
    }

    // Cycle length variability
    const completed = logs.filter((l) => l.cycleLength != null)
    if (completed.length >= 2) {
      const lengths = completed.map((l) => l.cycleLength as number)
      const max = Math.max(...lengths)
      const min = Math.min(...lengths)
      const variation = max - min
      if (variation <= 7) {
        out.push({
          icon: Sparkles,
          text: `Your cycle is regular — variation of only ${variation} day(s) across ${completed.length} cycles.`,
          tone: "good",
        })
      } else {
        out.push({
          icon: AlertCircle,
          text: `Your cycle length varies by ${variation} days. Consider consulting a gynecologist if variation exceeds 7 days.`,
          tone: "warn",
        })
      }
    } else {
      out.push({
        icon: Sparkles,
        text: "Log at least 2 completed cycles to assess cycle regularity.",
        tone: "info",
      })
    }

    // Average cycle length
    if (stats.avgCycleLength) {
      if (stats.avgCycleLength >= 21 && stats.avgCycleLength <= 35) {
        out.push({
          icon: Heart,
          text: `Average cycle length of ${stats.avgCycleLength} days falls within the normal range (21–35 days).`,
          tone: "good",
        })
      } else {
        out.push({
          icon: AlertCircle,
          text: `Average cycle length of ${stats.avgCycleLength} days is outside the typical 21–35 day range. Consider consulting a healthcare provider.`,
          tone: "warn",
        })
      }
    }

    // Period length
    if (stats.avgPeriodLength) {
      if (stats.avgPeriodLength >= 2 && stats.avgPeriodLength <= 7) {
        out.push({
          icon: Droplet,
          text: `Average period length of ${stats.avgPeriodLength} days is within the normal range (2–7 days).`,
          tone: "good",
        })
      } else {
        out.push({
          icon: Droplet,
          text: `Average period length of ${stats.avgPeriodLength} days is outside the typical 2–7 day range.`,
          tone: "warn",
        })
      }
    }

    // Heavy flow frequency
    const heavy = logs.filter((l) => l.flowLevel === "HEAVY")
    if (heavy.length >= 3) {
      out.push({
        icon: AlertCircle,
        text: `${heavy.length} cycles with heavy flow logged. If heavy flow is persistent, discuss with your doctor.`,
        tone: "warn",
      })
    }

    return out
  }, [logs, stats])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Cycle Insights
        </CardTitle>
        <CardDescription className="text-xs">
          Personalized analysis based on your tracked cycles.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {insights.map((ins, i) => {
          const Icon = ins.icon
          const toneClass =
            ins.tone === "good"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-500/10 dark:text-emerald-200"
              : ins.tone === "warn"
                ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-500/10 dark:text-amber-200"
                : "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/50 dark:bg-sky-500/10 dark:text-sky-200"
          const iconClass =
            ins.tone === "good"
              ? "text-emerald-600 dark:text-emerald-400"
              : ins.tone === "warn"
                ? "text-amber-600 dark:text-amber-400"
                : "text-sky-600 dark:text-sky-400"
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "flex items-start gap-2.5 rounded-lg border p-2.5 text-xs",
                toneClass
              )}
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconClass)} />
              <span className="leading-relaxed">{ins.text}</span>
            </motion.div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ============== Main Component ==============
export function MenstrualTracker() {
  const user = useAuthStore((s) => s.user)
  const [logs, setLogs] = useState<CycleLog[]>([])
  const [stats, setStats] = useState<CycleStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CycleLog | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()))

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ logs: CycleLog[]; stats: CycleStats }>(
        `/api/menstrual?patientId=${encodeURIComponent(user.id)}`
      )
      setLogs(res.logs || [])
      setStats(res.stats || null)
    } catch (e) {
      setError((e as Error).message || "Failed to load cycle data")
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const id = deleteId
      await apiFetch(`/api/menstrual?id=${id}`, { method: "DELETE" })
      // Optimistic delete — local state is already correct.
      setLogs((prev) => prev.filter((l) => l.id !== id))
      toast.success("Entry removed")
      setDeleteId(null)
      // No background refetch — the optimistic delete is authoritative.
    } catch (e) {
      toast.error((e as Error).message || "Failed to delete entry")
    } finally {
      setDeleting(false)
    }
  }

  // Optimistic save handler — the POST/PATCH response is the canonical record.
  // No background refetch — Supabase pooler read-after-write lag can cause a
  // refetch to return a list WITHOUT the new/updated item, wholesale-replacing
  // state and silently wiping it.
  const handleSaved = useCallback(
    (newLog?: CycleLog, editingId?: string) => {
      if (newLog) {
        setLogs((prev) => {
          if (editingId) {
            return prev.map((l) => (l.id === editingId ? { ...l, ...newLog } : l))
          }
          return [newLog, ...prev.filter((l) => l.id !== newLog.id)]
        })
      }
    },
    []
  )

  const nextPredictedCountdown = useMemo(() => {
    if (!stats?.nextPredictedStart) return null
    const diff = differenceInCalendarDays(
      toDate(stats.nextPredictedStart),
      new Date()
    )
    if (diff < 0) return "Overdue"
    if (diff === 0) return "Today"
    return `in ${diff} day${diff === 1 ? "" : "s"}`
  }, [stats?.nextPredictedStart])

  const fertileRange = useMemo(() => {
    if (!stats?.fertileStart || !stats?.fertileEnd) return null
    return `${format(toDate(stats.fertileStart), "MMM d")} – ${format(toDate(stats.fertileEnd), "MMM d")}`
  }, [stats?.fertileStart, stats?.fertileEnd])

  if (!user) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Sign in required"
        description="You must be signed in to track your cycle."
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <HeroBanner
        title="Menstrual Cycle Tracker"
        subtitle="Track periods, predict fertility, and understand your cycle patterns — privately and securely."
        icon={Flower2}
      >
        <Button
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
          className="bg-white text-rose-700 hover:bg-rose-50"
        >
          <Plus className="mr-2 h-4 w-4" />
          Log Period
        </Button>
      </HeroBanner>

      {/* Privacy banner */}
      <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 to-pink-50 p-3 text-sm text-rose-900 dark:border-rose-900/50 dark:from-rose-500/10 dark:to-pink-500/10 dark:text-rose-200">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
        <div>
          <p className="font-medium">
            This tracker is intended for female patients.
          </p>
          <p className="mt-0.5 text-xs text-rose-800/90 dark:text-rose-200/80">
            All cycle data is private and encrypted at rest. Only you can view
            your entries. Sharing with a doctor is opt-in only.
          </p>
        </div>
        <ShieldCheck className="ml-auto hidden h-5 w-5 shrink-0 text-rose-500 sm:block" />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-500/10 dark:text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)
        ) : (
          <>
            <StatCard
              title="Next predicted period"
              value={
                stats?.nextPredictedStart
                  ? format(toDate(stats.nextPredictedStart), "MMM d")
                  : "—"
              }
              icon={CalendarHeart}
              trend={nextPredictedCountdown || undefined}
              trendUp={undefined}
              color="bg-rose-50 text-rose-600 dark:bg-rose-500/10"
              accent="from-rose-500 to-pink-500"
            />
            <StatCard
              title="Average cycle length"
              value={stats ? `${stats.avgCycleLength} days` : "—"}
              icon={TrendingUp}
              color="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
              accent="from-emerald-500 to-teal-500"
              trend={
                stats?.totalCyclesTracked
                  ? `${stats.totalCyclesTracked} cycles tracked`
                  : undefined
              }
            />
            <StatCard
              title="Average period length"
              value={stats ? `${stats.avgPeriodLength} days` : "—"}
              icon={Droplet}
              color="bg-amber-50 text-amber-600 dark:bg-amber-500/10"
              accent="from-amber-500 to-orange-500"
              trend="Normal range 2–7 days"
            />
            <StatCard
              title="Fertility window"
              value={fertileRange || "—"}
              icon={Heart}
              color="bg-pink-50 text-pink-600 dark:bg-pink-500/10"
              accent="from-pink-500 to-rose-500"
              trend={
                stats?.ovulationDay
                  ? `Ovulation ~${format(toDate(stats.ovulationDay), "MMM d")}`
                  : undefined
              }
            />
          </>
        )}
      </div>

      {/* Calendar + Insights */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading ? (
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="mt-1 h-4 w-64" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ) : (
            <CalendarView
              logs={logs}
              stats={stats || ({} as CycleStats)}
              monthDate={monthDate}
              onPrev={() =>
                setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
              }
              onNext={() =>
                setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
              }
            />
          )}
        </div>
        <div className="lg:col-span-1">
          {loading ? (
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </CardContent>
            </Card>
          ) : (
            <InsightsCard logs={logs} stats={stats || ({} as CycleStats)} />
          )}
        </div>
      </div>

      {/* Cycle history */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Moon className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                Cycle History
              </CardTitle>
              <CardDescription className="mt-0.5 text-xs">
                All logged periods (newest first).
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                setEditing(null)
                setDialogOpen(true)
              }}
              size="sm"
              className="bg-gradient-to-r from-rose-600 to-pink-600 text-white hover:from-rose-700 hover:to-pink-700"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Log Period
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              icon={Flower2}
              title="No periods logged yet"
              description="Start tracking to predict your next period, fertile window, and ovulation day."
              action={
                <Button
                  onClick={() => {
                    setEditing(null)
                    setDialogOpen(true)
                  }}
                  className="bg-gradient-to-r from-rose-600 to-pink-600 text-white hover:from-rose-700 hover:to-pink-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Log first period
                </Button>
              }
            />
          ) : (
            <div className="max-h-[480px] space-y-2.5 overflow-y-auto pr-1">
              {logs.map((log, i) => {
                const flow = FLOW_META[log.flowLevel]
                const symptoms = parseSymptoms(log.symptoms)
                const MoodIcon = log.mood ? MOOD_META[log.mood].icon : null
                const moodMeta = log.mood ? MOOD_META[log.mood] : null
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    className="rounded-xl border bg-muted/20 p-3.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400">
                          <Droplet className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            {format(toDate(log.startDate), "MMM d, yyyy")}
                            {log.endDate &&
                              ` → ${format(toDate(log.endDate), "MMM d, yyyy")}`}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge
                              className={cn("border text-[10px]", flow.badge)}
                            >
                              <span
                                className={cn(
                                  "mr-1 inline-block h-1.5 w-1.5 rounded-full",
                                  flow.dot
                                )}
                              />
                              {flow.label} flow
                            </Badge>
                            {log.periodLength != null && (
                              <span className="text-[10px] text-muted-foreground">
                                {log.periodLength} day{log.periodLength === 1 ? "" : "s"}
                              </span>
                            )}
                            {log.cycleLength != null && (
                              <span className="text-[10px] text-muted-foreground">
                                · cycle {log.cycleLength}d
                              </span>
                            )}
                            {MoodIcon && moodMeta && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                · {moodMeta.emoji} {moodMeta.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => {
                            setEditing(log)
                            setDialogOpen(true)
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10"
                          onClick={() => setDeleteId(log.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {symptoms.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {symptoms.map((s) => (
                          <span
                            key={s}
                            className="rounded-full bg-rose-100/70 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}

                    {log.notes && (
                      <p className="mt-2 rounded-md bg-background/60 p-2 text-xs text-muted-foreground">
                        {log.notes}
                      </p>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <LogPeriodDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v)
          if (!v) setEditing(null)
        }}
        onSaved={handleSaved}
        patientId={user.id}
        editing={editing}
      />

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete period entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this cycle log. Predictions will be
              recalculated based on remaining entries.
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}

export default MenstrualTracker
