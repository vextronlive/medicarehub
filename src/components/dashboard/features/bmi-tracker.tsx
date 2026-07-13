"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { format, parseISO } from "date-fns"
import {
  Scale,
  Activity,
  Ruler,
  Weight,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  HeartPulse,
  Info,
  Pencil,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

// ============== Types ==============
type BmiCategory = "UNDERWEIGHT" | "NORMAL" | "OVERWEIGHT" | "OBESE"

interface BmiLog {
  id: string
  heightCm: number
  weightKg: number
  bmi: number
  category: BmiCategory
  note: string | null
  loggedAt: string
}

// ============== Category Metadata ==============
const CATEGORY_META: Record<
  BmiCategory,
  {
    label: string
    range: string
    badge: string
    dot: string
    fill: string
    stroke: string
    band: string
  }
> = {
  UNDERWEIGHT: {
    label: "Underweight",
    range: "< 18.5",
    badge:
      "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-900/50",
    dot: "bg-sky-500",
    fill: "rgba(14,165,233,0.15)",
    stroke: "#0ea5e9",
    band: "fill-sky-200/30 dark:fill-sky-500/10",
  },
  NORMAL: {
    label: "Normal",
    range: "18.5 – 24.9",
    badge:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-900/50",
    dot: "bg-emerald-500",
    fill: "rgba(16,185,129,0.15)",
    stroke: "#10b981",
    band: "fill-emerald-200/30 dark:fill-emerald-500/10",
  },
  OVERWEIGHT: {
    label: "Overweight",
    range: "25.0 – 29.9",
    badge:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-900/50",
    dot: "bg-amber-500",
    fill: "rgba(245,158,11,0.15)",
    stroke: "#f59e0b",
    band: "fill-amber-200/30 dark:fill-amber-500/10",
  },
  OBESE: {
    label: "Obese",
    range: "≥ 30.0",
    badge:
      "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-900/50",
    dot: "bg-rose-500",
    fill: "rgba(244,63,94,0.15)",
    stroke: "#f43f5e",
    band: "fill-rose-200/30 dark:fill-rose-500/10",
  },
}

function categoryFromBmi(bmi: number): BmiCategory {
  if (bmi < 18.5) return "UNDERWEIGHT"
  if (bmi < 25) return "NORMAL"
  if (bmi < 30) return "OVERWEIGHT"
  return "OBESE"
}

// ============== Tooltip ==============
function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: { bmi: number; date: string; label: string } }>
}) {
  if (!active || !payload || payload.length === 0) return null
  const d = payload[0].payload
  const cat = categoryFromBmi(d.bmi)
  const meta = CATEGORY_META[cat]
  return (
    <div className="rounded-lg border bg-background/95 p-2.5 shadow-md backdrop-blur">
      <p className="text-xs font-medium">{d.label}</p>
      <p className="mt-0.5 text-sm font-bold">
        BMI: {d.bmi.toFixed(1)}{" "}
        <span
          className={cn(
            "ml-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold",
            meta.badge
          )}
        >
          {meta.label}
        </span>
      </p>
    </div>
  )
}

// ============== BMI Chart with reference bands ==============
function BmiChart({ logs }: { logs: BmiLog[] }) {
  // Show oldest → newest (last 30 entries)
  const data = useMemo(() => {
    return [...logs]
      .reverse()
      .slice(-30)
      .map((l) => ({
        label: format(parseISO(l.loggedAt), "MMM d"),
        date: l.loggedAt,
        bmi: l.bmi,
      }))
  }, [logs])

  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        No measurements yet — log your first BMI to see the trend.
      </div>
    )
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 12, bottom: 4, left: -16 }}
        >
          <defs>
            <linearGradient id="bmiLineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.8} />
            </linearGradient>
          </defs>

          {/* Reference bands — BMI categories */}
          <ReferenceArea
            y1={0}
            y2={18.5}
            fill="#0ea5e9"
            fillOpacity={0.08}
            ifOverflow="extendDomain"
          />
          <ReferenceArea
            y1={18.5}
            y2={25}
            fill="#10b981"
            fillOpacity={0.1}
            ifOverflow="extendDomain"
          />
          <ReferenceArea
            y1={25}
            y2={30}
            fill="#f59e0b"
            fillOpacity={0.08}
            ifOverflow="extendDomain"
          />
          <ReferenceArea
            y1={30}
            y2={40}
            fill="#f43f5e"
            fillOpacity={0.08}
            ifOverflow="extendDomain"
          />

          {/* Boundary lines */}
          <ReferenceLine
            y={18.5}
            stroke="#0ea5e9"
            strokeDasharray="3 3"
            strokeOpacity={0.5}
          />
          <ReferenceLine
            y={25}
            stroke="#f59e0b"
            strokeDasharray="3 3"
            strokeOpacity={0.5}
          />
          <ReferenceLine
            y={30}
            stroke="#f43f5e"
            strokeDasharray="3 3"
            strokeOpacity={0.5}
          />

          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.18} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          <YAxis
            domain={[15, 38]}
            tick={{ fontSize: 11 }}
            stroke="currentColor"
            className="text-muted-foreground"
            width={44}
          />
          <Tooltip content={<ChartTooltip />} />
          <Line
            type="monotone"
            dataKey="bmi"
            stroke="url(#bmiLineGrad)"
            strokeWidth={3}
            dot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
            activeDot={{ r: 6, fill: "#0f766e", stroke: "#fff", strokeWidth: 2 }}
            isAnimationActive
            animationDuration={600}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        {(["UNDERWEIGHT", "NORMAL", "OVERWEIGHT", "OBESE"] as BmiCategory[]).map(
          (c) => {
            const meta = CATEGORY_META[c]
            return (
              <span key={c} className="flex items-center gap-1.5">
                <span className={cn("inline-block h-2.5 w-2.5 rounded-sm", meta.dot)} />
                {meta.label} ({meta.range})
              </span>
            )
          }
        )}
      </div>
    </div>
  )
}

// ============== Log Dialog ==============
function LogBmiDialog({
  open,
  onOpenChange,
  onSaved,
  patientId,
  initial,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: (newLog?: { id: string; heightCm: number; weightKg: number; bmi: number; note?: string | null; recordedAt: string }) => void
  patientId: string
  initial?: { heightCm?: number; weightKg?: number; note?: string } | null
}) {
  const [heightCm, setHeightCm] = useState("")
  const [weightKg, setWeightKg] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setHeightCm(initial?.heightCm ? String(initial.heightCm) : "")
      setWeightKg(initial?.weightKg ? String(initial.weightKg) : "")
      setNote(initial?.note ?? "")
    }
  }, [open, initial])

  const h = Number(heightCm)
  const w = Number(weightKg)
  const liveBmi =
    h > 0 && w > 0 ? Number((w / Math.pow(h / 100, 2)).toFixed(2)) : null
  const liveCategory = liveBmi ? categoryFromBmi(liveBmi) : null

  const handleSubmit = async () => {
    if (!h || !w) {
      toast.error("Enter both height and weight")
      return
    }
    if (h < 30 || h > 250 || w < 2 || w > 400) {
      toast.error("Measurements out of range")
      return
    }
    setSaving(true)
    try {
      const res = await apiFetch<{ log: { id: string; heightCm: number; weightKg: number; bmi: number; note?: string | null; recordedAt: string } }>(`/api/bmi`, {
        method: "POST",
        body: JSON.stringify({
          patientId,
          heightCm: h,
          weightKg: w,
          note: note.trim() || undefined,
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
      toast.success("BMI logged")
      onOpenChange(false)
      onSaved(res.log)
    } catch (e) {
      toast.error((e as Error).message || "Failed to log BMI")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
              <Scale className="h-4 w-4" />
            </div>
            Log New Measurement
          </DialogTitle>
          <DialogDescription>
            Enter your height and weight — BMI is computed automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bmi-height" className="text-xs">
                Height (cm)
              </Label>
              <Input
                id="bmi-height"
                type="number"
                step="0.1"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="170"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bmi-weight" className="text-xs">
                Weight (kg)
              </Label>
              <Input
                id="bmi-weight"
                type="number"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="65"
                inputMode="decimal"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bmi-note" className="text-xs">
              Note (optional)
            </Label>
            <Textarea
              id="bmi-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Morning measurement, after workout…"
              className="min-h-[64px] resize-y text-sm"
            />
          </div>

          {/* Live preview */}
          {liveBmi && liveCategory && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border p-3",
                CATEGORY_META[liveCategory].badge
              )}
            >
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide opacity-80">
                  Calculated BMI
                </p>
                <p className="text-2xl font-bold leading-tight">
                  {liveBmi.toFixed(1)}
                </p>
              </div>
              <Badge className={cn("border", CATEGORY_META[liveCategory].badge)}>
                {CATEGORY_META[liveCategory].label}
              </Badge>
            </motion.div>
          )}
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
            className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Save measurement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============== Main Component ==============
export function BmiTracker() {
  const user = useAuthStore((s) => s.user)
  const [logs, setLogs] = useState<BmiLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ logs: BmiLog[] }>(
        `/api/bmi?patientId=${encodeURIComponent(user.id)}`
      )
      setLogs(res.logs || [])
    } catch (e) {
      setError((e as Error).message || "Failed to load BMI logs")
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Optimistic save — the POST response is the canonical record.
  // No background refetch — Supabase pooler read-after-write lag can cause
  // a refetch to return a list WITHOUT the new item, wholesale-replacing
  // state and silently wiping it.
  const handleSaved = useCallback(
    (newLog?: BmiLog) => {
      if (newLog) {
        setLogs((prev) => [newLog, ...prev.filter((l) => l.id !== newLog.id)])
      }
    },
    []
  )

  useEffect(() => {
    load()
  }, [load])

  const latest = logs[0]
  const previous = logs[1]
  const currentCategory = latest ? categoryFromBmi(latest.bmi) : null
  const trend = useMemo(() => {
    if (!latest || !previous) return null
    return Number((latest.bmi - previous.bmi).toFixed(2))
  }, [latest, previous])

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const id = deleteId
      await apiFetch(`/api/bmi?id=${id}`, { method: "DELETE" })
      // Optimistic delete — local state is already correct.
      setLogs((prev) => prev.filter((l) => l.id !== id))
      toast.success("Log removed")
      setDeleteId(null)
      // No background refetch — the optimistic delete is authoritative.
    } catch (e) {
      toast.error((e as Error).message || "Failed to delete log")
    } finally {
      setDeleting(false)
    }
  }

  if (!user) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Sign in required"
        description="You must be signed in to track your BMI."
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
        title="BMI Tracker"
        subtitle="Track your Body Mass Index over time. Maintain a BMI of 18.5–25 for optimal health."
        icon={Scale}
      >
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-white text-emerald-700 hover:bg-emerald-50"
        >
          <Plus className="mr-2 h-4 w-4" />
          Log Measurement
        </Button>
      </HeroBanner>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-500/10 dark:text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stat row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)
        ) : (
          <>
            <Card className="relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/5">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Current BMI
                  </p>
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      currentCategory
                        ? CATEGORY_META[currentCategory].badge
                        : "bg-muted"
                    )}
                  >
                    <Activity className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 text-3xl font-bold tracking-tight">
                  {latest ? latest.bmi.toFixed(1) : "—"}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  {currentCategory && (
                    <Badge className={cn("border", CATEGORY_META[currentCategory].badge)}>
                      <span
                        className={cn(
                          "mr-1 inline-block h-1.5 w-1.5 rounded-full",
                          CATEGORY_META[currentCategory].dot
                        )}
                      />
                      {CATEGORY_META[currentCategory].label}
                    </Badge>
                  )}
                  {trend !== null && (
                    <span
                      className={cn(
                        "flex items-center gap-1 text-[11px] font-medium",
                        trend > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : trend < 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground"
                      )}
                    >
                      {trend > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : trend < 0 ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : (
                        <Minus className="h-3 w-3" />
                      )}
                      {trend > 0 ? "+" : ""}
                      {trend}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <StatCard
              title="Height"
              value={latest ? `${latest.heightCm} cm` : "—"}
              icon={Ruler}
              color="bg-teal-50 text-teal-600 dark:bg-teal-500/10"
              accent="from-teal-500 to-cyan-500"
              trend={previous ? `${previous.heightCm} cm prior` : undefined}
            />
            <StatCard
              title="Weight"
              value={latest ? `${latest.weightKg} kg` : "—"}
              icon={Weight}
              color="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
              accent="from-emerald-500 to-teal-500"
              trend={
                previous && latest
                  ? `${(latest.weightKg - previous.weightKg).toFixed(1)} kg vs last`
                  : undefined
              }
              trendUp={
                previous && latest
                  ? latest.weightKg > previous.weightKg
                  : undefined
              }
            />
            <StatCard
              title="Entries logged"
              value={logs.length}
              icon={HeartPulse}
              color="bg-rose-50 text-rose-600 dark:bg-rose-500/10"
              accent="from-rose-500 to-red-500"
              trend={
                logs.length > 0
                  ? `Since ${format(parseISO(logs[logs.length - 1].loggedAt), "MMM yyyy")}`
                  : "No data yet"
              }
            />
          </>
        )}
      </div>

      {/* Chart + History */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Chart */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              BMI Trend
            </CardTitle>
            <CardDescription className="text-xs">
              Your BMI over time with WHO category reference bands. Dashed lines
              mark category boundaries.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <BmiChart logs={logs} />
            )}
          </CardContent>
        </Card>

        {/* Educational */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              BMI Categories & Tips
            </CardTitle>
            <CardDescription className="text-xs">
              WHO classification — BMI = weight (kg) / height² (m²)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {(["UNDERWEIGHT", "NORMAL", "OVERWEIGHT", "OBESE"] as BmiCategory[]).map(
              (c) => {
                const meta = CATEGORY_META[c]
                const isCurrent = currentCategory === c
                return (
                  <div
                    key={c}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg border p-2.5 transition-colors",
                      isCurrent
                        ? cn(meta.badge, "ring-1 ring-current/30")
                        : "bg-muted/30"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={cn(
                          "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
                          meta.dot
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{meta.label}</p>
                        <p className="text-[10px] text-muted-foreground">
                          BMI {meta.range}
                        </p>
                      </div>
                    </div>
                    {isCurrent && (
                      <Badge className={cn("border", meta.badge)}>You</Badge>
                    )}
                  </div>
                )
              }
            )}

            <div className="rounded-lg bg-emerald-50/60 p-3 text-xs text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
              <p className="flex items-center gap-1.5 font-medium">
                <HeartPulse className="h-3.5 w-3.5" />
                Health tip
              </p>
              <p className="mt-1 leading-relaxed">
                Maintain a BMI between <strong>18.5 and 25</strong> for optimal
                cardiovascular health. Pair tracking with regular exercise and
                balanced nutrition. Consult your doctor before making major
                dietary changes.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Measurement History
              </CardTitle>
              <CardDescription className="mt-0.5 text-xs">
                All logged BMI entries (newest first).
              </CardDescription>
            </div>
            <Button
              onClick={() => setDialogOpen(true)}
              size="sm"
              className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              icon={Scale}
              title="No measurements yet"
              description="Log your first BMI measurement to start tracking your health trend."
              action={
                <Button
                  onClick={() => setDialogOpen(true)}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Log first measurement
                </Button>
              }
            />
          ) : (
            <div className="max-h-[420px] overflow-y-auto pr-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Height</TableHead>
                    <TableHead className="text-xs">Weight</TableHead>
                    <TableHead className="text-xs">BMI</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs">Note</TableHead>
                    <TableHead className="text-right text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => {
                    const cat = categoryFromBmi(l.bmi)
                    const meta = CATEGORY_META[cat]
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs font-medium">
                          {format(parseISO(l.loggedAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-xs">
                          {l.heightCm} cm
                        </TableCell>
                        <TableCell className="text-xs">
                          {l.weightKg} kg
                        </TableCell>
                        <TableCell className="text-xs font-semibold">
                          {l.bmi.toFixed(1)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              "border text-[10px]",
                              meta.badge
                            )}
                          >
                            <span
                              className={cn(
                                "mr-1 inline-block h-1.5 w-1.5 rounded-full",
                                meta.dot
                              )}
                            />
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {l.note || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10"
                            onClick={() => setDeleteId(l.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <LogBmiDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={handleSaved}
        patientId={user.id}
        initial={latest ? { heightCm: latest.heightCm, weightKg: latest.weightKg } : null}
      />

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete measurement?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the BMI log entry. This action
              cannot be undone.
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

export default BmiTracker
