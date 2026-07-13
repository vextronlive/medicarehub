"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import ReactMarkdown from "react-markdown"
import { format, formatDistanceToNow, parseISO } from "date-fns"
import {
  Brain,
  Sparkles,
  Loader2,
  Activity,
  Heart,
  Droplet,
  Wind,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react"
import {
  LineChart,
  Line,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts"
import { toast } from "sonner"

import { useAuthStore } from "@/lib/auth-store"
import { apiFetch } from "@/lib/api"
import {
  HeroBanner,
  EmptyState,
} from "@/components/dashboard/shared/primitives"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// ============== Types ==============
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

type AlertKind = "rose" | "amber" | "emerald"

interface ComputedAlert {
  kind: AlertKind
  icon: typeof AlertTriangle
  title: string
  message: string
}

// ============== Helpers ==============
function toDate(v: string | Date): Date {
  if (v instanceof Date) return v
  return parseISO(v)
}

function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

function avg(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function round1(n: number | null): number | null {
  if (n == null) return null
  return Math.round(n * 10) / 10
}

function minMax(values: number[]): { min: number | null; max: number | null } {
  if (!values.length) return { min: null, max: null }
  return { min: Math.min(...values), max: Math.max(...values) }
}

// ============== Sparkline Tooltip ==============
interface SparkTipProps {
  active?: boolean
  payload?: Array<{
    name?: string
    value?: number | string
    color?: string
    payload?: any
  }>
  unit?: string
}

function SparkTip({ active, payload, unit }: SparkTipProps) {
  if (!active || !payload || !payload.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-emerald-100 bg-white/95 px-2.5 py-1.5 text-[11px] shadow-md backdrop-blur dark:border-emerald-900/50 dark:bg-slate-900/95">
      <p className="font-medium text-foreground">
        {format(toDate(p.rawDate), "d MMM yyyy")}
      </p>
      {payload.map((entry, i) => (
        <p key={i} className="mt-0.5" style={{ color: entry.color }}>
          <span className="font-medium">{entry.name}:</span> {entry.value}
          {unit ? ` ${unit}` : ""}
        </p>
      ))}
    </div>
  )
}

// ============== Mini Summary Stat Card ==============
const ACCENT_CLASSES: Record<
  string,
  { icon: string; ring: string; chip: string }
> = {
  emerald: {
    icon: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    ring: "ring-emerald-100 dark:ring-emerald-500/20",
    chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  rose: {
    icon: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
    ring: "ring-rose-100 dark:ring-rose-500/20",
    chip: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  },
  amber: {
    icon: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    ring: "ring-amber-100 dark:ring-amber-500/20",
    chip: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  },
  sky: {
    icon: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
    ring: "ring-sky-100 dark:ring-sky-500/20",
    chip: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  },
}

function MiniStat({
  icon: Icon,
  label,
  value,
  unit,
  count,
  accent,
}: {
  icon: typeof Activity
  label: string
  value: string
  unit?: string
  count: number
  accent: keyof typeof ACCENT_CLASSES
}) {
  const a = ACCENT_CLASSES[accent]
  return (
    <Card className="overflow-hidden rounded-xl shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1",
              a.icon,
              a.ring
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight">
          {value}
          {unit && (
            <span className="ml-1 text-sm font-medium text-muted-foreground">
              {unit}
            </span>
          )}
        </p>
        <p className="mt-1">
          <Badge
            variant="secondary"
            className={cn("text-[10px] font-medium", a.chip)}
          >
            +{count} {count === 1 ? "entry" : "entries"}
          </Badge>
        </p>
      </CardContent>
    </Card>
  )
}

// ============== Sparkline Card ==============
function SparklineCard({
  title,
  icon: Icon,
  data,
  lines,
  unit,
  accent,
}: {
  title: string
  icon: typeof Activity
  data: any[]
  lines: { key: string; name: string; color: string }[]
  unit?: string
  accent: keyof typeof ACCENT_CLASSES
}) {
  const a = ACCENT_CLASSES[accent]
  return (
    <Card className="overflow-hidden rounded-xl shadow-sm">
      <CardHeader className="p-5 pb-1">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md ring-1",
              a.icon,
              a.ring
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-1">
        {data.length === 0 ? (
          <div className="flex h-[100px] items-center justify-center rounded-lg border border-dashed bg-muted/20 text-xs text-muted-foreground">
            No data
          </div>
        ) : (
          <div className="h-[100px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 4, right: 6, left: 6, bottom: 0 }}
              >
                <RTooltip
                  content={<SparkTip unit={unit} />}
                  cursor={{ stroke: "currentColor", strokeWidth: 1, strokeDasharray: "3 3" }}
                />
                {lines.map((l) => (
                  <Line
                    key={l.key}
                    type="monotone"
                    dataKey={l.key}
                    name={l.name}
                    stroke={l.color}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============== Alert Item ==============
const ALERT_KIND_CLASSES: Record<
  AlertKind,
  { wrap: string; icon: string; title: string }
> = {
  rose: {
    wrap: "border-rose-200 bg-rose-50/60 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100",
    icon: "text-rose-600 dark:text-rose-400",
    title: "text-rose-900 dark:text-rose-100",
  },
  amber: {
    wrap: "border-amber-200 bg-amber-50/60 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
    icon: "text-amber-600 dark:text-amber-400",
    title: "text-amber-900 dark:text-amber-100",
  },
  emerald: {
    wrap: "border-emerald-200 bg-emerald-50/60 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
    icon: "text-emerald-600 dark:text-emerald-400",
    title: "text-emerald-900 dark:text-emerald-100",
  },
}

function HealthAlertItem({ alert }: { alert: ComputedAlert }) {
  const a = ALERT_KIND_CLASSES[alert.kind]
  const Icon = alert.icon
  return (
    <Alert className={cn("flex items-start gap-3", a.wrap)}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", a.icon)} />
      <div className="min-w-0">
        <AlertTitle className={cn("font-semibold", a.title)}>
          {alert.title}
        </AlertTitle>
        <AlertDescription className="text-sm opacity-90">
          {alert.message}
        </AlertDescription>
      </div>
    </Alert>
  )
}

// ============== Markdown renderer wrapper ==============
function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed text-foreground [&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-1.5 [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-medium [&_li]:my-0.5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_strong]:font-semibold [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}

// ============== Loading skeleton ==============
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ============== Main Component ==============
export function AIVitalsInsights({
  onSwitchTab,
}: {
  onSwitchTab?: (tab: string) => void
} = {}) {
  const user = useAuthStore((s) => s.user)

  const [loading, setLoading] = useState(true)
  const [vitals, setVitals] = useState<VitalsEntry[]>([])
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const fetchVitals = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await apiFetch<{ vitals: VitalsEntry[] }>(
        `/api/vitals?patientId=${encodeURIComponent(user.id)}`
      )
      setVitals(data.vitals ?? [])
    } catch (e) {
      toast.error("Failed to load vitals", {
        description: e instanceof Error ? e.message : undefined,
      })
      setVitals([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void fetchVitals()
  }, [fetchVitals])

  // ============== Computed values ==============
  // vitals are newest-first from API. Reverse for chronological computations.
  const chronological = useMemo(
    () => [...vitals].sort((a, b) => +toDate(a.recordedAt) - +toDate(b.recordedAt)),
    [vitals]
  )

  const latest = vitals[0] ?? null
  const oldest = chronological[0] ?? null

  const bpEntries = useMemo(
    () => vitals.filter((v) => num(v.systolic) != null && num(v.diastolic) != null),
    [vitals]
  )
  const hrEntries = useMemo(
    () => vitals.filter((v) => num(v.heartRate) != null),
    [vitals]
  )
  const glucoseEntries = useMemo(
    () => vitals.filter((v) => num(v.glucose) != null),
    [vitals]
  )
  const spo2Entries = useMemo(
    () => vitals.filter((v) => num(v.oxygenSat) != null),
    [vitals]
  )
  const weightEntries = useMemo(
    () => vitals.filter((v) => num(v.weight) != null),
    [vitals]
  )

  const latestBP =
    latest && num(latest.systolic) != null && num(latest.diastolic) != null
      ? `${latest.systolic}/${latest.diastolic}`
      : "—"
  const latestHR = latest && num(latest.heartRate) != null ? `${latest.heartRate}` : "—"
  const latestGlucose =
    latest && num(latest.glucose) != null ? `${latest.glucose}` : "—"
  const latestSpO2 =
    latest && num(latest.oxygenSat) != null ? `${latest.oxygenSat}` : "—"

  // ============== Sparkline data (last 14 entries, oldest→newest) ==============
  const last14 = useMemo(() => {
    const slice = vitals.slice(0, 14)
    return [...slice].sort(
      (a, b) => +toDate(a.recordedAt) - +toDate(b.recordedAt)
    )
  }, [vitals])

  const bpSparkData = useMemo(
    () =>
      last14
        .filter((v) => num(v.systolic) != null || num(v.diastolic) != null)
        .map((v) => ({
          label: format(toDate(v.recordedAt), "d MMM"),
          rawDate: v.recordedAt,
          systolic: num(v.systolic),
          diastolic: num(v.diastolic),
        })),
    [last14]
  )

  const hrSparkData = useMemo(
    () =>
      last14
        .filter((v) => num(v.heartRate) != null)
        .map((v) => ({
          label: format(toDate(v.recordedAt), "d MMM"),
          rawDate: v.recordedAt,
          heartRate: num(v.heartRate),
        })),
    [last14]
  )

  const glucoseSparkData = useMemo(
    () =>
      last14
        .filter((v) => num(v.glucose) != null)
        .map((v) => ({
          label: format(toDate(v.recordedAt), "d MMM"),
          rawDate: v.recordedAt,
          glucose: num(v.glucose),
        })),
    [last14]
  )

  // ============== Health alerts ==============
  const alerts = useMemo<ComputedAlert[]>(() => {
    const out: ComputedAlert[] = []
    if (latest) {
      const s = num(latest.systolic)
      const d = num(latest.diastolic)
      if ((s != null && s > 140) || (d != null && d > 90)) {
        out.push({
          kind: "rose",
          icon: AlertTriangle,
          title: "Elevated blood pressure detected",
          message:
            "Elevated blood pressure detected — consider consulting your doctor.",
        })
      }
      const g = num(latest.glucose)
      if (g != null && g > 126) {
        out.push({
          kind: "amber",
          icon: AlertTriangle,
          title: "High fasting glucose",
          message:
            "High fasting glucose — diabetes screening recommended.",
        })
      }
      const o = num(latest.oxygenSat)
      if (o != null && o < 95) {
        out.push({
          kind: "rose",
          icon: AlertTriangle,
          title: "Low oxygen saturation",
          message:
            "Low oxygen saturation — seek medical advice if persistent.",
        })
      }
      const hr = num(latest.heartRate)
      if (hr != null && (hr > 100 || hr < 60)) {
        out.push({
          kind: "amber",
          icon: AlertTriangle,
          title: "Resting heart rate out of range",
          message: "Resting heart rate out of normal range.",
        })
      }
    }
    if (out.length === 0) {
      out.push({
        kind: "emerald",
        icon: CheckCircle2,
        title: "All vitals within normal ranges",
        message: "All vitals within normal ranges. Keep up the healthy habits!",
      })
    }
    return out
  }, [latest])

  // ============== Generate AI analysis ==============
  const handleGenerate = useCallback(async () => {
    if (vitals.length === 0) {
      toast.error(
        "No vitals logged yet. Log your first measurements on the Vitals tab to enable AI analysis."
      )
      return
    }
    setGenerating(true)
    try {
      const systolicVals = vitals
        .map((v) => num(v.systolic))
        .filter((v): v is number => v != null)
      const diastolicVals = vitals
        .map((v) => num(v.diastolic))
        .filter((v): v is number => v != null)
      const hrVals = hrEntries
        .map((v) => num(v.heartRate))
        .filter((v): v is number => v != null)
      const glucoseVals = glucoseEntries
        .map((v) => num(v.glucose))
        .filter((v): v is number => v != null)
      const weightVals = weightEntries
        .map((v) => num(v.weight))
        .filter((v): v is number => v != null)
      const spo2Vals = spo2Entries
        .map((v) => num(v.oxygenSat))
        .filter((v): v is number => v != null)

      const summaryStats = {
        totalEntries: vitals.length,
        dateRange: oldest
          ? { from: oldest.recordedAt, to: latest?.recordedAt ?? oldest.recordedAt }
          : null,
        averages: {
          systolic: round1(avg(systolicVals)),
          diastolic: round1(avg(diastolicVals)),
          heartRate: round1(avg(hrVals)),
          glucose: round1(avg(glucoseVals)),
          weight: round1(avg(weightVals)),
          oxygenSat: round1(avg(spo2Vals)),
        },
        minMax: {
          systolic: minMax(systolicVals),
          diastolic: minMax(diastolicVals),
          heartRate: minMax(hrVals),
          glucose: minMax(glucoseVals),
          weight: minMax(weightVals),
          oxygenSat: minMax(spo2Vals),
        },
      }

      const body = {
        records: [] as unknown[],
        period: "all",
        role: "PATIENT_VITALS",
        extraContext: {
          patientName: user?.name ?? "Patient",
          vitals: vitals.map((v) => ({
            date: v.recordedAt,
            systolic: v.systolic ?? null,
            diastolic: v.diastolic ?? null,
            heartRate: v.heartRate ?? null,
            glucose: v.glucose ?? null,
            weight: v.weight ?? null,
            temperature: v.temperature ?? null,
            oxygenSat: v.oxygenSat ?? null,
            steps: v.steps ?? null,
            note: v.note ?? null,
          })),
          summaryStats,
        },
      }

      const data = await apiFetch<{ result: string }>(
        "/api/ai/insights",
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      )
      setResult(data.result || "No analysis returned.")
      toast.success("AI vitals analysis generated.")
    } catch (e) {
      toast.error("Failed to generate AI analysis", {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setGenerating(false)
    }
  }, [vitals, oldest, latest, hrEntries, glucoseEntries, weightEntries, spo2Entries, user])

  // ============== Render guards ==============
  if (!user) return null

  const hasVitals = vitals.length > 0

  const containerVariants = {
    hidden: { opacity: 0, y: 8 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.05, duration: 0.3, ease: "easeOut" as const },
    }),
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <motion.div
        custom={0}
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <HeroBanner
          title="AI Vitals Insights"
          subtitle="Personalized health analysis based on your tracked vitals — trends, anomalies, and lifestyle recommendations."
          icon={Brain}
        />
      </motion.div>

      {loading ? (
        <LoadingSkeleton />
      ) : !hasVitals ? (
        <motion.div
          custom={1}
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <EmptyState
            icon={Brain}
            title="No vitals to analyze yet"
            description="Visit the Vitals tab to log your first measurements."
            action={
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => onSwitchTab?.("vitals")}
                    >
                      <Activity className="h-4 w-4" />
                      Go to Vitals
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Use the Vitals tab</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            }
          />
        </motion.div>
      ) : (
        <>
          {/* Stat row */}
          <motion.div
            custom={1}
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MiniStat
                icon={Activity}
                label="Latest BP"
                value={latestBP}
                unit={latestBP !== "—" ? "mmHg" : undefined}
                count={bpEntries.length}
                accent="emerald"
              />
              <MiniStat
                icon={Heart}
                label="Latest Heart Rate"
                value={latestHR}
                unit={latestHR !== "—" ? "bpm" : undefined}
                count={hrEntries.length}
                accent="rose"
              />
              <MiniStat
                icon={Droplet}
                label="Latest Glucose"
                value={latestGlucose}
                unit={latestGlucose !== "—" ? "mg/dL" : undefined}
                count={glucoseEntries.length}
                accent="amber"
              />
              <MiniStat
                icon={Wind}
                label="Latest SpO2"
                value={latestSpO2}
                unit={latestSpO2 !== "—" ? "%" : undefined}
                count={spo2Entries.length}
                accent="sky"
              />
            </div>
          </motion.div>

          {/* Trends preview */}
          <motion.div
            custom={2}
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="p-5 pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20">
                    <TrendingUp className="h-3.5 w-3.5" />
                  </div>
                  <CardTitle className="text-sm font-semibold">
                    Vitals Trends Preview
                  </CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">
                  Last 14 entries per metric. Generate the AI analysis below for a full narrative report.
                </p>
              </CardHeader>
              <CardContent className="p-5 pt-2">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <SparklineCard
                    title="Blood Pressure"
                    icon={Activity}
                    data={bpSparkData}
                    unit="mmHg"
                    accent="emerald"
                    lines={[
                      { key: "systolic", name: "Systolic", color: "#10b981" },
                      { key: "diastolic", name: "Diastolic", color: "#5eead4" },
                    ]}
                  />
                  <SparklineCard
                    title="Heart Rate"
                    icon={Heart}
                    data={hrSparkData}
                    unit="bpm"
                    accent="rose"
                    lines={[{ key: "heartRate", name: "Heart Rate", color: "#f43f5e" }]}
                  />
                  <SparklineCard
                    title="Glucose"
                    icon={Droplet}
                    data={glucoseSparkData}
                    unit="mg/dL"
                    accent="amber"
                    lines={[{ key: "glucose", name: "Glucose", color: "#f59e0b" }]}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Health alerts */}
          <motion.div
            custom={3}
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="p-5 pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20">
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </div>
                  <CardTitle className="text-sm font-semibold">
                    Health Alerts
                  </CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">
                  Auto-computed from your most recent entry.{" "}
                  {latest && (
                    <>
                      Last updated{" "}
                      {formatDistanceToNow(toDate(latest.recordedAt), {
                        addSuffix: true,
                      })}
                      {" "}({format(toDate(latest.recordedAt), "d MMM yyyy, h:mm a")})
                    </>
                  )}
                </p>
              </CardHeader>
              <CardContent className="p-5 pt-2">
                <div className="space-y-3">
                  {alerts.map((a, i) => (
                    <HealthAlertItem key={i} alert={a} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Generate AI analysis */}
          <motion.div
            custom={4}
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="p-5 pb-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <CardTitle className="text-sm font-semibold">
                      AI Vitals Analysis
                    </CardTitle>
                  </div>
                  <Button
                    onClick={() => void handleGenerate()}
                    disabled={generating}
                    className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing your vitals...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate AI Vitals Analysis
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {result
                    ? "Your personalized AI report is ready below. Click the button again to refresh."
                    : "Generate a personalized health report covering trends, anomalies, and lifestyle recommendations."}
                </p>
              </CardHeader>
              <CardContent className="p-5 pt-2">
                {generating && !result ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 py-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                    <div>
                      <p className="text-sm font-medium">
                        Analyzing your vitals...
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        The AI is reviewing your trends, averages, and anomalies.
                      </p>
                    </div>
                  </div>
                ) : result ? (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                    <MarkdownContent content={result} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 py-10 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20">
                      <Brain className="h-5 w-5" />
                    </div>
                    <div className="max-w-md">
                      <p className="text-sm font-medium">
                        No analysis generated yet
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Click the button above to generate a personalized AI report based on your {vitals.length} vitals {vitals.length === 1 ? "entry" : "entries"}.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Disclaimer */}
          <motion.div
            custom={5}
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            <Alert className="border-emerald-200 bg-emerald-50/50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
              <Info className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <AlertTitle className="font-semibold text-emerald-900 dark:text-emerald-100">
                Medical Disclaimer
              </AlertTitle>
              <AlertDescription className="text-sm opacity-90">
                AI-generated insights are for informational purposes only and do
                not replace professional medical advice. Always consult your
                doctor for medical decisions.
              </AlertDescription>
            </Alert>
          </motion.div>
        </>
      )}
    </div>
  )
}

export default AIVitalsInsights
