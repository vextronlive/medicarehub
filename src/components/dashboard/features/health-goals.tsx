"use client"

import { useCallback, useEffect, useMemo, useState, useId } from "react"
import { motion } from "framer-motion"
import {
  format,
  formatDistanceToNow,
  parseISO,
  differenceInCalendarDays,
} from "date-fns"
import {
  Target,
  Plus,
  Footprints,
  Weight,
  HeartPulse,
  Heart,
  Moon,
  Droplet,
  Dumbbell,
  Activity,
  CheckCircle2,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  TrendingUp,
  Award,
  Calendar,
  MoreHorizontal,
  AlertCircle,
} from "lucide-react"
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  YAxis,
  Tooltip as RTooltip,
} from "recharts"
import { toast } from "sonner"

import { useAuthStore } from "@/lib/auth-store"
import { apiFetch } from "@/lib/api"
import {
  HeroBanner,
  StatCard,
  EmptyState,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

// ============== Types ==============
type Metric =
  | "STEPS"
  | "WEIGHT"
  | "BP_SYSTOLIC"
  | "BP_DIASTOLIC"
  | "HEART_RATE"
  | "SLEEP_HOURS"
  | "WATER_INTAKE"
  | "EXERCISE_MINS"
  | "GLUCOSE"

type Period = "DAILY" | "WEEKLY" | "MONTHLY" | "ONE_TIME"
type GoalStatus = "ACTIVE" | "COMPLETED" | "PAUSED" | "FAILED"

interface GoalLog {
  id: string
  goalId: string
  patientId: string
  value: number
  loggedAt: string
  note?: string | null
}

interface HealthGoal {
  id: string
  patientId: string
  title: string
  metric: Metric
  targetValue: number
  currentValue: number
  unit: string
  period: Period
  status: GoalStatus
  startDate: string
  endDate?: string | null
  createdAt: string
  updatedAt: string
  logs?: GoalLog[]
}

// ============== Metric metadata ==============
type LucideIcon = typeof Target

interface MetricMeta {
  label: string
  unit: string
  icon: LucideIcon
  // tailwind classes for the 40px icon circle
  color: string
  // hex used for the sparkline stroke + area fill gradient
  stroke: string
}

const METRIC_META: Record<Metric, MetricMeta> = {
  STEPS: {
    label: "Steps",
    unit: "steps",
    icon: Footprints,
    color:
      "bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20",
    stroke: "#10b981",
  },
  WEIGHT: {
    label: "Weight",
    unit: "kg",
    icon: Weight,
    color:
      "bg-violet-50 text-violet-600 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/20",
    stroke: "#8b5cf6",
  },
  BP_SYSTOLIC: {
    label: "Systolic BP",
    unit: "mmHg",
    icon: HeartPulse,
    color:
      "bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20",
    stroke: "#f43f5e",
  },
  BP_DIASTOLIC: {
    label: "Diastolic BP",
    unit: "mmHg",
    icon: HeartPulse,
    color:
      "bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20",
    stroke: "#fb7185",
  },
  HEART_RATE: {
    label: "Heart Rate",
    unit: "bpm",
    icon: Heart,
    color:
      "bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20",
    stroke: "#e11d48",
  },
  SLEEP_HOURS: {
    label: "Sleep",
    unit: "hours",
    icon: Moon,
    color:
      "bg-teal-50 text-teal-600 ring-teal-100 dark:bg-teal-500/10 dark:text-teal-400 dark:ring-teal-500/20",
    stroke: "#14b8a6",
  },
  WATER_INTAKE: {
    label: "Water Intake",
    unit: "mL",
    icon: Droplet,
    color:
      "bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/20",
    stroke: "#0ea5e9",
  },
  EXERCISE_MINS: {
    label: "Exercise",
    unit: "mins",
    icon: Dumbbell,
    color:
      "bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20",
    stroke: "#f59e0b",
  },
  GLUCOSE: {
    label: "Glucose",
    unit: "mg/dL",
    icon: Activity,
    color:
      "bg-fuchsia-50 text-fuchsia-600 ring-fuchsia-100 dark:bg-fuchsia-500/10 dark:text-fuchsia-400 dark:ring-fuchsia-500/20",
    stroke: "#d946ef",
  },
}

const METRIC_KEYS = Object.keys(METRIC_META) as Metric[]

const PERIOD_META: Record<Period, { label: string }> = {
  DAILY: { label: "Daily" },
  WEEKLY: { label: "Weekly" },
  MONTHLY: { label: "Monthly" },
  ONE_TIME: { label: "One-time" },
}

const STATUS_META: Record<GoalStatus, { label: string; badge: string }> = {
  ACTIVE: {
    label: "Active",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  COMPLETED: {
    label: "Completed",
    badge:
      "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500",
  },
  PAUSED: {
    label: "Paused",
    badge:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  },
  FAILED: {
    label: "Failed",
    badge:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
  },
}

// ============== Helpers ==============
function toDate(v: string | Date): Date {
  if (v instanceof Date) return v
  return parseISO(v)
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "0"
  if (Number.isInteger(n)) return n.toLocaleString("en-US")
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 })
}

function progressPct(goal: HealthGoal): number {
  if (goal.targetValue <= 0) return 0
  const p = (goal.currentValue / goal.targetValue) * 100
  return Math.max(0, Math.min(100, p))
}

function progressColor(pct: number): "emerald" | "amber" | "rose" {
  if (pct >= 80) return "emerald"
  if (pct >= 50) return "amber"
  return "rose"
}

const PROGRESS_HEX: Record<
  "emerald" | "amber" | "rose",
  { from: string; to: string }
> = {
  emerald: { from: "#34d399", to: "#10b981" },
  amber: { from: "#fbbf24", to: "#f59e0b" },
  rose: { from: "#fb7185", to: "#f43f5e" },
}

/** Longest run of consecutive calendar days with at least one log entry. */
function computeStreak(logs: GoalLog[] | undefined): number {
  if (!logs || logs.length === 0) return 0
  const days = Array.from(
    new Set(logs.map((l) => format(toDate(l.loggedAt), "yyyy-MM-dd")))
  ).sort()
  if (days.length === 0) return 0
  let best = 1
  let cur = 1
  for (let i = 1; i < days.length; i++) {
    const prev = parseISO(days[i - 1])
    const curr = parseISO(days[i])
    if (differenceInCalendarDays(curr, prev) === 1) {
      cur += 1
      if (cur > best) best = cur
    } else {
      cur = 1
    }
  }
  return best
}

// ============== Progress Ring ==============
function ProgressRing({ pct }: { pct: number }) {
  const rawId = useId()
  const gid = `grad-${rawId.replace(/:/g, "")}`
  const size = 80
  const stroke = 8
  const r = 36
  const cx = 40
  const cy = 40
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - pct / 100)
  const tone = progressColor(pct)
  const hex = PROGRESS_HEX[tone]

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Progress ${Math.round(pct)} percent`}
    >
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={hex.from} />
          <stop offset="100%" stopColor={hex.to} />
        </linearGradient>
      </defs>
      {/* Background track */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-muted/25"
      />
      {/* Progress arc — rotated -90deg around center so it starts at the top */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        className="transition-all duration-700 ease-out"
      />
      {/* Center percentage label */}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground text-[14px] font-bold"
      >
        {Math.round(pct)}%
      </text>
    </svg>
  )
}

// ============== Sparkline ==============
interface SparkTipProps {
  active?: boolean
  payload?: Array<{
    name?: string
    value?: number | string
    color?: string
    payload?: { rawDate?: string; value?: number }
  }>
  unit?: string
}

function SparkTip({ active, payload, unit }: SparkTipProps) {
  if (!active || !payload || !payload.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-emerald-100 bg-white/95 px-2.5 py-1.5 text-[11px] shadow-md backdrop-blur dark:border-emerald-900/50 dark:bg-slate-900/95">
      {p?.rawDate && (
        <p className="font-medium text-foreground">
          {format(toDate(p.rawDate), "d MMM yyyy")}
        </p>
      )}
      <p style={{ color: payload[0].color }}>
        <span className="font-medium">Value:</span> {p?.value}
        {unit ? ` ${unit}` : ""}
      </p>
    </div>
  )
}

function Sparkline({
  data,
  color,
  unit,
}: {
  data: { label: string; value: number; rawDate: string }[]
  color: string
  unit: string
}) {
  const rawId = useId()
  const gid = `spark-${rawId.replace(/:/g, "")}`
  if (data.length === 0) {
    return (
      <div className="flex h-[80px] items-center justify-center text-[11px] text-muted-foreground">
        No progress logged yet
      </div>
    )
  }
  return (
    <div className="h-[80px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["auto", "auto"]} />
          <RTooltip
            content={<SparkTip unit={unit} />}
            cursor={{
              stroke: "currentColor",
              strokeWidth: 1,
              strokeDasharray: "3 3",
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            name="Value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gid})`}
            isAnimationActive={false}
            dot={false}
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ============== Goal Card ==============
function GoalCard({
  goal,
  index,
  onLog,
  onEdit,
  onDelete,
}: {
  goal: HealthGoal
  index: number
  onLog: (g: HealthGoal) => void
  onEdit: (g: HealthGoal) => void
  onDelete: (g: HealthGoal) => void
}) {
  const meta = METRIC_META[goal.metric] || METRIC_META.STEPS
  const Icon = meta.icon
  const pct = progressPct(goal)
  const status = STATUS_META[goal.status] || STATUS_META.ACTIVE
  const isCompleted = goal.status === "COMPLETED"

  const sparkData = useMemo(() => {
    const logs = [...(goal.logs || [])].sort(
      (a, b) => toDate(a.loggedAt).getTime() - toDate(b.loggedAt).getTime()
    )
    return logs.slice(-14).map((l) => ({
      label: format(toDate(l.loggedAt), "d MMM"),
      rawDate: l.loggedAt,
      value: l.value,
    }))
  }, [goal.logs])

  const lastLog = useMemo(() => {
    if (!goal.logs || goal.logs.length === 0) return null
    return [...goal.logs].sort(
      (a, b) => toDate(b.loggedAt).getTime() - toDate(a.loggedAt).getTime()
    )[0]
  }, [goal.logs])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4) }}
    >
      <Card
        className={cn(
          "h-full overflow-hidden rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
          isCompleted &&
            "bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20"
        )}
      >
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1",
                  meta.color
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate font-semibold leading-tight">
                  {goal.title}
                </h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={cn("gap-1 text-[10px] font-medium", status.badge)}
                  >
                    {isCompleted && <CheckCircle2 className="h-3 w-3" />}
                    {status.label}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] font-medium">
                    {PERIOD_META[goal.period]?.label || goal.period}
                  </Badge>
                </div>
              </div>
            </div>
            {isCompleted ? (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            ) : (
              <DropdownActions
                onLog={() => onLog(goal)}
                onEdit={() => onEdit(goal)}
                onDelete={() => onDelete(goal)}
              />
            )}
          </div>

          {/* Progress + current/target */}
          <div className="mt-4 flex items-center gap-4">
            <div className="shrink-0">
              <ProgressRing pct={pct} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Current / Target
              </p>
              <p className="mt-0.5 text-lg font-bold leading-tight">
                {fmtNum(goal.currentValue)}
                <span className="font-normal text-muted-foreground">
                  {" "}
                  / {fmtNum(goal.targetValue)}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">{goal.unit}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {lastLog
                  ? `Last log ${formatDistanceToNow(toDate(lastLog.loggedAt), {
                      addSuffix: true,
                    })}`
                  : "No logs yet"}
              </p>
            </div>
          </div>

          {/* Sparkline */}
          <div className="mt-3 rounded-lg border bg-muted/20 p-2">
            <Sparkline data={sparkData} color={meta.stroke} unit={goal.unit} />
          </div>

          {/* Footer actions */}
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => onLog(goal)}
              disabled={isCompleted}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Log Progress
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(goal)}
              className="h-8 w-8 p-0"
              aria-label="Edit goal"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDelete(goal)}
              className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10"
              aria-label="Delete goal"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {goal.endDate && (
            <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Ends {format(toDate(goal.endDate), "d MMM yyyy")}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============== Dropdown Actions (mobile-compact) ==============
function DropdownActions({
  onLog,
  onEdit,
  onDelete,
}: {
  onLog: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Goal actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onLog}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Log Progress
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-rose-600 focus:text-rose-700 dark:text-rose-400"
          onClick={onDelete}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ============== Goal Form Dialog ==============
interface GoalForm {
  title: string
  metric: Metric
  targetValue: string
  unit: string
  period: Period
  endDate: string
}

const EMPTY_GOAL_FORM: GoalForm = {
  title: "",
  metric: "STEPS",
  targetValue: "",
  unit: "steps",
  period: "DAILY",
  endDate: "",
}

function GoalFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  onSubmit,
  submitting,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: HealthGoal | null
  form: GoalForm
  setForm: React.Dispatch<React.SetStateAction<GoalForm>>
  onSubmit: () => void
  submitting: boolean
}) {
  const targetNum = Number(form.targetValue)
  const targetValid =
    form.targetValue !== "" && Number.isFinite(targetNum) && targetNum > 0
  const titleValid = form.title.trim().length > 0
  const canSubmit = titleValid && targetValid && !submitting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Goal" : "Set a New Health Goal"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the target or period for this goal."
              : "Choose a metric, set a target, and start building a healthy habit."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1 py-2">
          {/* Title */}
          <div className="grid gap-2">
            <Label htmlFor="goal-title">
              Goal Title <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="goal-title"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="e.g. Walk 10,000 steps a day"
            />
          </div>

          {/* Metric */}
          <div className="grid gap-2">
            <Label>Metric</Label>
            <Select
              value={form.metric}
              onValueChange={(v) => {
                const metric = v as Metric
                setForm((f) => ({
                  ...f,
                  metric,
                  unit: METRIC_META[metric]?.unit || f.unit,
                }))
              }}
              disabled={!!editing}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select metric" />
              </SelectTrigger>
              <SelectContent>
                {METRIC_KEYS.map((m) => {
                  const M = METRIC_META[m]
                  const Icon = M.icon
                  return (
                    <SelectItem key={m} value={m}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {M.label}
                        <span className="text-muted-foreground">({M.unit})</span>
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {editing && (
              <p className="text-[11px] text-muted-foreground">
                Metric can&apos;t be changed after creation.
              </p>
            )}
          </div>

          {/* Target + Unit */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="goal-target">
                Target Value <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="goal-target"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={form.targetValue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, targetValue: e.target.value }))
                }
                placeholder="e.g. 10000"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal-unit">Unit</Label>
              <Input
                id="goal-unit"
                value={form.unit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unit: e.target.value }))
                }
                placeholder="e.g. steps"
              />
            </div>
          </div>

          {/* Period + End Date */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Period</Label>
              <Select
                value={form.period}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, period: v as Period }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PERIOD_META) as Period[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PERIOD_META[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal-end-date">End Date (optional)</Label>
              <Input
                id="goal-end-date"
                type="date"
                value={form.endDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endDate: e.target.value }))
                }
              />
            </div>
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
            onClick={onSubmit}
            disabled={!canSubmit}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : editing ? (
              "Save Changes"
            ) : (
              "Create Goal"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============== Log Progress Dialog ==============
function LogProgressDialog({
  open,
  onOpenChange,
  goal,
  value,
  setValue,
  note,
  setNote,
  onSubmit,
  submitting,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  goal: HealthGoal | null
  value: string
  setValue: React.Dispatch<React.SetStateAction<string>>
  note: string
  setNote: React.Dispatch<React.SetStateAction<string>>
  onSubmit: () => void
  submitting: boolean
}) {
  const meta = goal ? METRIC_META[goal.metric] : null
  const valueNum = Number(value)
  const valueValid = value !== "" && Number.isFinite(valueNum) && valueNum >= 0
  const canSubmit = valueValid && !submitting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Log Progress</DialogTitle>
          <DialogDescription>
            {goal
              ? `Update "${goal.title}" — current ${fmtNum(goal.currentValue)} / ${fmtNum(goal.targetValue)} ${goal.unit}`
              : "Record your latest value for this goal."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="log-value">
              New Value {meta && <span className="text-muted-foreground">· {meta.unit}</span>}
            </Label>
            <Input
              id="log-value"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 7500"
              autoFocus
            />
            {goal && goal.targetValue > 0 && valueValid && (
              <p className="text-[11px] text-muted-foreground">
                This will bring you to{" "}
                <span className="font-medium text-foreground">
                  {Math.min(
                    100,
                    Math.round((valueNum / goal.targetValue) * 100)
                  )}
                  %
                </span>{" "}
                of your target.
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="log-note">Note (optional)</Label>
            <Textarea
              id="log-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Felt great today, walked after dinner"
            />
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
            onClick={onSubmit}
            disabled={!canSubmit}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Logging...
              </>
            ) : (
              "Save Log"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============== Delete Dialog ==============
function DeleteGoalDialog({
  open,
  onOpenChange,
  goal,
  onConfirm,
  submitting,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  goal: HealthGoal | null
  onConfirm: () => void
  submitting: boolean
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this goal?</AlertDialogTitle>
          <AlertDialogDescription>
            {goal
              ? `"${goal.title}" and all of its progress logs will be permanently removed. This action can't be undone.`
              : "This goal and its progress logs will be permanently removed."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={submitting}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Goal"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ============== Insights Card ==============
function InsightsCard({ goals }: { goals: HealthGoal[] }) {
  const insights = useMemo(() => {
    const active = goals.filter((g) => g.status === "ACTIVE")
    if (active.length === 0) return null

    const withPct = active.map((g) => ({ goal: g, pct: progressPct(g) }))
    const sorted = [...withPct].sort((a, b) => b.pct - a.pct)
    const best = sorted[0]
    const worst = sorted[sorted.length - 1]

    return { best, worst, total: active.length }
  }, [goals])

  if (!insights) return null

  return (
    <Card className="overflow-hidden rounded-xl">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Goal Insights</h3>
            <p className="text-[11px] text-muted-foreground">
              Quick highlights from your {insights.total} active{" "}
              {insights.total === 1 ? "goal" : "goals"}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Closest to completing */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/5">
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
              <Award className="h-3.5 w-3.5" />
              <p className="text-[11px] font-medium uppercase tracking-wide">
                Closest to completing
              </p>
            </div>
            <p className="mt-1 truncate font-semibold">
              {insights.best.goal.title}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {Math.round(insights.best.pct)}% complete ·{" "}
              {fmtNum(insights.best.goal.currentValue)} /{" "}
              {fmtNum(insights.best.goal.targetValue)}{" "}
              {insights.best.goal.unit}
            </p>
          </div>

          {/* Needs attention */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/20 dark:bg-amber-500/5">
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-3.5 w-3.5" />
              <p className="text-[11px] font-medium uppercase tracking-wide">
                Needs attention
              </p>
            </div>
            <p className="mt-1 truncate font-semibold">
              {insights.worst.goal.title}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {Math.round(insights.worst.pct)}% complete ·{" "}
              {fmtNum(insights.worst.goal.currentValue)} /{" "}
              {fmtNum(insights.worst.goal.targetValue)}{" "}
              {insights.worst.goal.unit}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============== Loading Skeleton ==============
function LoadingState() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[22rem] w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ============== Main Component ==============
export function HealthGoals() {
  const user = useAuthStore((s) => s.user)

  const [goals, setGoals] = useState<HealthGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Goal form dialog state
  const [goalDialogOpen, setGoalDialogOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<HealthGoal | null>(null)
  const [goalForm, setGoalForm] = useState<GoalForm>(EMPTY_GOAL_FORM)

  // Log progress dialog state
  const [logDialogOpen, setLogDialogOpen] = useState(false)
  const [logGoal, setLogGoal] = useState<HealthGoal | null>(null)
  const [logValue, setLogValue] = useState("")
  const [logNote, setLogNote] = useState("")

  // Delete dialog state
  const [deleteGoalState, setDeleteGoalState] = useState<HealthGoal | null>(null)

  const fetchGoals = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const data = await apiFetch<{ goals: HealthGoal[] }>(
        `/api/goals?patientId=${encodeURIComponent(user.id)}&logs=true`
      )
      setGoals(data.goals || [])
    } catch (e) {
      toast.error("Failed to load health goals", {
        description: (e as Error).message,
      })
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  // ─── Derived stats ───
  const stats = useMemo(() => {
    const total = goals.length
    const active = goals.filter((g) => g.status === "ACTIVE").length
    const completed = goals.filter((g) => g.status === "COMPLETED").length
    const withPct = goals
      .filter((g) => g.status !== "FAILED")
      .map((g) => progressPct(g))
    const avgProgress =
      withPct.length === 0
        ? 0
        : Math.round(withPct.reduce((a, b) => a + b, 0) / withPct.length)
    const bestStreak = goals.reduce(
      (max, g) => Math.max(max, computeStreak(g.logs)),
      0
    )
    return { total, active, completed, avgProgress, bestStreak }
  }, [goals])

  // ─── Handlers ───
  const openCreate = () => {
    setEditingGoal(null)
    setGoalForm({ ...EMPTY_GOAL_FORM })
    setGoalDialogOpen(true)
  }

  const openEdit = (g: HealthGoal) => {
    setEditingGoal(g)
    setGoalForm({
      title: g.title,
      metric: g.metric,
      targetValue: String(g.targetValue ?? ""),
      unit: g.unit,
      period: g.period,
      endDate: g.endDate
        ? format(toDate(g.endDate), "yyyy-MM-dd")
        : "",
    })
    setGoalDialogOpen(true)
  }

  const openLog = (g: HealthGoal) => {
    setLogGoal(g)
    setLogValue("")
    setLogNote("")
    setLogDialogOpen(true)
  }

  const openDelete = (g: HealthGoal) => {
    setDeleteGoalState(g)
  }

  const handleGoalSubmit = async () => {
    if (!user) return
    const title = goalForm.title.trim()
    if (!title) {
      toast.error("Please enter a goal title.")
      return
    }
    const targetNum = Number(goalForm.targetValue)
    if (!Number.isFinite(targetNum) || targetNum <= 0) {
      toast.error("Please enter a valid target value greater than 0.")
      return
    }

    const unit = goalForm.unit.trim() || METRIC_META[goalForm.metric].unit
    const payload: Record<string, unknown> = {
      patientId: user.id,
      title,
      metric: goalForm.metric,
      targetValue: targetNum,
      unit,
      period: goalForm.period,
    }
    if (goalForm.endDate) {
      const endISO = new Date(goalForm.endDate).toISOString()
      payload.endDate = endISO
    }

    try {
      setSubmitting(true)
      if (editingGoal) {
        const res = await apiFetch<{ goal: HealthGoal }>("/api/goals", {
          method: "PATCH",
          body: JSON.stringify({ id: editingGoal.id, ...payload }),
        })
        // Nuclear fix: gate toast + state update on the response payload.
        if (!res?.goal) {
          throw new Error("Server confirmed the update but did not return the record.")
        }
        setGoals((prev) =>
          prev.map((g) => (g.id === editingGoal.id ? { ...g, ...res.goal } : g))
        )
        toast.success("Goal updated successfully.")
      } else {
        const res = await apiFetch<{ goal: HealthGoal }>("/api/goals", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        // Nuclear fix: the POST response IS the canonical record.
        // Gate the toast + state update on the response payload so we
        // never show a false "successfully added" toast. Do NOT fire an
        // un-awaited background refetch — Supabase pooler read-after-write
        // lag can cause the refetch to return a list WITHOUT the new item,
        // which would wholesale-replace state and silently wipe it.
        if (!res?.goal) {
          throw new Error("Server confirmed the save but did not return the record.")
        }
        setGoals((prev) => [res.goal, ...prev])
        toast.success("Goal created. Start logging your progress!")
      }
      setGoalDialogOpen(false)
      setEditingGoal(null)
      // No background refetch — the POST response above is the source of truth.
    } catch (e) {
      toast.error(editingGoal ? "Failed to update goal" : "Failed to create goal", {
        description: (e as Error).message,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogSubmit = async () => {
    if (!user || !logGoal) return
    const valueNum = Number(logValue)
    if (!Number.isFinite(valueNum) || valueNum < 0) {
      toast.error("Please enter a valid non-negative value.")
      return
    }
    try {
      setSubmitting(true)
      const payload: Record<string, unknown> = {
        goalId: logGoal.id,
        patientId: user.id,
        value: valueNum,
      }
      const noteTrim = logNote.trim()
      if (noteTrim) payload.note = noteTrim
      const res = await apiFetch<{ log: GoalLog; goal: HealthGoal }>(
        "/api/goals/log",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      )
      toast.success(
        res?.goal?.status === "COMPLETED"
          ? "Goal completed! 🎉"
          : "Progress logged."
      )
      setLogDialogOpen(false)
      setLogGoal(null)
      await fetchGoals()
    } catch (e) {
      toast.error("Failed to log progress", {
        description: (e as Error).message,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteGoalState) return
    const id = deleteGoalState.id
    try {
      setSubmitting(true)
      await apiFetch(`/api/goals?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      // Optimistic delete — local state is already correct.
      setGoals((prev) => prev.filter((g) => g.id !== id))
      toast.success("Goal deleted.")
      setDeleteGoalState(null)
      // No background refetch — the optimistic delete is authoritative.
    } catch (e) {
      toast.error("Failed to delete goal", {
        description: (e as Error).message,
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Guards ───
  if (!user) return null

  if (loading) {
    return (
      <div className="space-y-6">
        <HeroBanner
          title="Health Goals"
          subtitle="Set targets, track progress, build healthy habits"
          icon={Target}
        />
        <LoadingState />
      </div>
    )
  }

  // ─── Empty state ───
  if (goals.length === 0) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <HeroBanner
            title="Health Goals"
            subtitle="Set targets, track progress, build healthy habits"
            icon={Target}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <EmptyState
            icon={Target}
            title="No health goals yet"
            description="Set your first goal — track steps, sleep, water, weight, or any of 9 health metrics. Visualize your progress and build lasting healthy habits."
            action={
              <Button
                onClick={openCreate}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                Set Your First Goal
              </Button>
            }
          />
        </motion.div>

        <GoalFormDialog
          open={goalDialogOpen}
          onOpenChange={setGoalDialogOpen}
          editing={editingGoal}
          form={goalForm}
          setForm={setGoalForm}
          onSubmit={handleGoalSubmit}
          submitting={submitting}
        />
      </div>
    )
  }

  // ─── Main render ───
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <HeroBanner
          title="Health Goals"
          subtitle="Set targets, track progress, build healthy habits"
          icon={Target}
        >
          <Button
            onClick={openCreate}
            className="bg-white text-emerald-700 shadow-md hover:bg-emerald-50"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Goal</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </HeroBanner>
      </motion.div>

      {/* Stat cards row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          title="Active Goals"
          value={stats.active}
          icon={Target}
          trend={`${stats.total} total`}
          color="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
          accent="from-emerald-500 to-teal-500"
        />
        <StatCard
          title="Completed"
          value={stats.completed}
          icon={CheckCircle2}
          trend={stats.completed > 0 ? "Goals achieved" : "None yet"}
          trendUp={stats.completed > 0}
          color="bg-teal-50 text-teal-600 dark:bg-teal-500/10"
          accent="from-teal-500 to-emerald-500"
        />
        <StatCard
          title="Avg Progress"
          value={`${stats.avgProgress}%`}
          icon={TrendingUp}
          trend={stats.avgProgress >= 70 ? "On track" : "Keep pushing"}
          trendUp={stats.avgProgress >= 70}
          color="bg-amber-50 text-amber-600 dark:bg-amber-500/10"
          accent="from-amber-500 to-orange-500"
        />
        <StatCard
          title="Best Streak"
          value={stats.bestStreak}
          icon={Award}
          trend={stats.bestStreak === 1 ? "day logged" : "days logged"}
          color="bg-violet-50 text-violet-600 dark:bg-violet-500/10"
          accent="from-violet-500 to-fuchsia-500"
        />
      </motion.div>

      {/* Goals grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {goals.map((g, i) => (
          <GoalCard
            key={g.id}
            goal={g}
            index={i}
            onLog={openLog}
            onEdit={openEdit}
            onDelete={openDelete}
          />
        ))}
      </div>

      {/* Insights card */}
      <InsightsCard goals={goals} />

      {/* Dialogs */}
      <GoalFormDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        editing={editingGoal}
        form={goalForm}
        setForm={setGoalForm}
        onSubmit={handleGoalSubmit}
        submitting={submitting}
      />
      <LogProgressDialog
        open={logDialogOpen}
        onOpenChange={setLogDialogOpen}
        goal={logGoal}
        value={logValue}
        setValue={setLogValue}
        note={logNote}
        setNote={setLogNote}
        onSubmit={handleLogSubmit}
        submitting={submitting}
      />
      <DeleteGoalDialog
        open={!!deleteGoalState}
        onOpenChange={(v) => !v && setDeleteGoalState(null)}
        goal={deleteGoalState}
        onConfirm={handleDelete}
        submitting={submitting}
      />
    </div>
  )
}

export default HealthGoals
