"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { format, formatDistanceToNow, parseISO } from "date-fns"
import {
  Activity,
  Heart,
  Droplet,
  Wind,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  MoreHorizontal,
  Scale,
  Thermometer,
  Footprints,
  Stethoscope,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts"
import { toast } from "sonner"

import { useAuthStore } from "@/lib/auth-store"
import { apiFetch } from "@/lib/api"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

interface FormState {
  systolic: string
  diastolic: string
  heartRate: string
  glucose: string
  weight: string
  temperature: string
  oxygenSat: string
  steps: string
  note: string
  recordedAt: string
}

const EMPTY_FORM: FormState = {
  systolic: "",
  diastolic: "",
  heartRate: "",
  glucose: "",
  weight: "",
  temperature: "",
  oxygenSat: "",
  steps: "",
  note: "",
  recordedAt: "",
}

const NUMERIC_FIELDS = [
  "systolic",
  "diastolic",
  "heartRate",
  "glucose",
  "weight",
  "temperature",
  "oxygenSat",
  "steps",
] as const

// ============== Helpers ==============
function nowLocalInput(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

function toDate(v: string | Date): Date {
  if (v instanceof Date) return v
  return parseISO(v)
}

function numOrNull(v: string): number | null {
  if (v.trim() === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// ============== Chart Tooltip ==============
interface ChartTipProps {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; color?: string; payload?: any }>
  unit?: string
}

function ChartTip({ active, payload, unit }: ChartTipProps) {
  if (!active || !payload || !payload.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-emerald-100 bg-white/95 p-3 text-xs shadow-md backdrop-blur dark:border-emerald-900/50 dark:bg-slate-900/95">
      <p className="font-medium text-foreground">
        {format(toDate(p.rawDate), "d MMM yyyy, h:mm a")}
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

// ============== Mini Summary Card ==============
function MiniStat({
  icon: Icon,
  label,
  value,
  unit,
  time,
  color,
}: {
  icon: typeof Activity
  label: string
  value: string
  unit: string
  time?: string
  color: string
}) {
  return (
    <Card className="overflow-hidden rounded-xl shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              color
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight">
          {value}
          <span className="ml-1 text-sm font-medium text-muted-foreground">
            {unit}
          </span>
        </p>
        {time ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">{time}</p>
        ) : (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            No data yet
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ============== Single-line Chart Card ==============
function ChartCard({
  title,
  description,
  data,
  dataKey,
  name,
  unit,
  color,
  referenceLines,
  referenceArea,
  domain,
}: {
  title: string
  description: string
  data: any[]
  dataKey: string
  name: string
  unit: string
  color: string
  referenceLines?: { y: number; label: string; color: string }[]
  referenceArea?: { y1: number; y2: number; color: string }
  domain?: [number | string, number | string]
}) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="p-5 pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-5 pt-2">
        {data.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed bg-muted/20 text-xs text-muted-foreground">
            No data yet — log a measurement to see your trend.
          </div>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-muted/30"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
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
                  width={42}
                  domain={domain}
                />
                <Tooltip content={<ChartTip unit={unit} />} />
                {referenceArea && (
                  <ReferenceArea
                    y1={referenceArea.y1}
                    y2={referenceArea.y2}
                    fill={referenceArea.color}
                    fillOpacity={0.15}
                  />
                )}
                {referenceLines?.map((rl, i) => (
                  <ReferenceLine
                    key={i}
                    y={rl.y}
                    stroke={rl.color}
                    strokeDasharray="4 4"
                    label={{
                      value: rl.label,
                      fontSize: 9,
                      fill: rl.color,
                      position: "insideTopRight",
                    }}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey={dataKey}
                  name={name}
                  stroke={color}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: color, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============== Blood Pressure (dual-line) Chart Card ==============
function BPChartCard({ data }: { data: any[] }) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="p-5 pb-2">
        <CardTitle className="text-base font-semibold">Blood Pressure</CardTitle>
        <CardDescription className="text-xs">
          Systolic &amp; diastolic over time. Reference lines at 120/80 mmHg.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5 pt-2">
        {data.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed bg-muted/20 text-xs text-muted-foreground">
            No data yet — log a measurement to see your trend.
          </div>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-muted/30"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
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
                  width={42}
                />
                <Tooltip content={<ChartTip unit="mmHg" />} />
                <ReferenceLine
                  y={120}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  label={{
                    value: "120",
                    fontSize: 9,
                    fill: "#10b981",
                    position: "insideTopRight",
                  }}
                />
                <ReferenceLine
                  y={80}
                  stroke="#14b8a6"
                  strokeDasharray="4 4"
                  label={{
                    value: "80",
                    fontSize: 9,
                    fill: "#14b8a6",
                    position: "insideTopRight",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="systolic"
                  name="Systolic"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                  isAnimationActive
                />
                <Line
                  type="monotone"
                  dataKey="diastolic"
                  name="Diastolic"
                  stroke="#14b8a6"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#14b8a6", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                  isAnimationActive
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============== Form Field ==============
function NumberField({
  id,
  label,
  value,
  onChange,
  icon: Icon,
  unit,
  min,
  max,
  step,
  placeholder,
}: {
  id: keyof FormState
  label: string
  value: string
  onChange: (v: string) => void
  icon: typeof Activity
  unit: string
  min?: number
  max?: number
  step?: number
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
        <span className="text-muted-foreground">· {unit}</span>
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg"
      />
    </div>
  )
}

// ============== Main Component ==============
export function VitalsTracker() {
  const user = useAuthStore((s) => s.user)
  const [vitals, setVitals] = useState<VitalsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const fetchVitals = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const data = await apiFetch<{ vitals: VitalsEntry[] }>(
        `/api/vitals?patientId=${encodeURIComponent(user.id)}`
      )
      setVitals(data.vitals || [])
    } catch (e) {
      toast.error("Failed to load vitals", {
        description: (e as Error).message,
      })
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchVitals()
  }, [fetchVitals])

  const setField = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, recordedAt: nowLocalInput() })
    setEditingId(null)
    setDialogOpen(true)
  }

  const openEdit = (v: VitalsEntry) => {
    setForm({
      systolic: v.systolic != null ? String(v.systolic) : "",
      diastolic: v.diastolic != null ? String(v.diastolic) : "",
      heartRate: v.heartRate != null ? String(v.heartRate) : "",
      glucose: v.glucose != null ? String(v.glucose) : "",
      weight: v.weight != null ? String(v.weight) : "",
      temperature: v.temperature != null ? String(v.temperature) : "",
      oxygenSat: v.oxygenSat != null ? String(v.oxygenSat) : "",
      steps: v.steps != null ? String(v.steps) : "",
      note: v.note || "",
      recordedAt: format(toDate(v.recordedAt), "yyyy-MM-dd'T'HH:mm"),
    })
    setEditingId(v.id)
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!user) return

    const measurements: Record<string, number | null> = {}
    for (const k of NUMERIC_FIELDS) {
      measurements[k] = numOrNull(form[k])
    }
    const hasMeasurement = Object.values(measurements).some((v) => v != null)
    if (!hasMeasurement) {
      toast.error("Please enter at least one measurement.")
      return
    }

    const noteVal = form.note.trim() || null
    const recordedAtVal = form.recordedAt
      ? new Date(form.recordedAt).toISOString()
      : undefined

    try {
      setSubmitting(true)
      if (editingId) {
        const patch: Record<string, unknown> = {
          id: editingId,
          ...measurements,
          note: noteVal,
        }
        if (recordedAtVal) patch.recordedAt = recordedAtVal
        const res = await apiFetch<{ vital: VitalsEntry }>("/api/vitals", {
          method: "PATCH",
          body: JSON.stringify(patch),
        })
        // Nuclear fix: gate toast + state update on the response payload.
        if (!res?.vital) {
          throw new Error("Server confirmed the update but did not return the record.")
        }
        setVitals((prev) =>
          prev.map((v) => (v.id === editingId ? { ...v, ...res.vital } : v))
        )
        toast.success("Vitals updated successfully.")
      } else {
        const payload: Record<string, unknown> = {
          patientId: user.id,
          ...measurements,
          note: noteVal,
        }
        if (recordedAtVal) payload.recordedAt = recordedAtVal
        const res = await apiFetch<{ vital: VitalsEntry }>("/api/vitals", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        // Nuclear fix: the POST response IS the canonical record.
        // Gate the toast + state update on the response payload so we
        // never show a false "successfully added" toast. Do NOT fire an
        // un-awaited background refetch — Supabase pooler read-after-write
        // lag can cause the refetch to return a list WITHOUT the new item,
        // which would wholesale-replace state and silently wipe it.
        if (!res?.vital) {
          throw new Error("Server confirmed the save but did not return the record.")
        }
        setVitals((prev) => [res.vital, ...prev])
        toast.success("Vitals logged successfully.")
      }
      setDialogOpen(false)
      setEditingId(null)
      // No background refetch — the POST response above is the source of truth.
    } catch (e) {
      toast.error(editingId ? "Failed to update vitals" : "Failed to log vitals", {
        description: (e as Error).message,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const id = deleteId
    try {
      setSubmitting(true)
      await apiFetch(`/api/vitals?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      // Optimistic delete — local state is already correct.
      setVitals((prev) => prev.filter((v) => v.id !== id))
      toast.success("Entry deleted.")
      setDeleteId(null)
      // No background refetch — the optimistic delete is authoritative.
    } catch (e) {
      toast.error("Failed to delete entry", {
        description: (e as Error).message,
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ============== Derived data ==============
  const latestBP = useMemo(
    () => vitals.find((v) => v.systolic != null || v.diastolic != null),
    [vitals]
  )
  const latestHR = useMemo(
    () => vitals.find((v) => v.heartRate != null),
    [vitals]
  )
  const latestGlucose = useMemo(
    () => vitals.find((v) => v.glucose != null),
    [vitals]
  )
  const latestSpO2 = useMemo(
    () => vitals.find((v) => v.oxygenSat != null),
    [vitals]
  )

  const chartData = useMemo(() => {
    const oldest = [...vitals].sort(
      (a, b) => toDate(a.recordedAt).getTime() - toDate(b.recordedAt).getTime()
    )
    const last30 = oldest.slice(-30)

    const bp = last30
      .filter((v) => v.systolic != null || v.diastolic != null)
      .map((v) => ({
        label: format(toDate(v.recordedAt), "d MMM"),
        rawDate: v.recordedAt,
        systolic: v.systolic ?? null,
        diastolic: v.diastolic ?? null,
      }))

    const pick = (key: keyof VitalsEntry) =>
      last30
        .filter((v) => v[key] != null)
        .map((v) => ({
          label: format(toDate(v.recordedAt), "d MMM"),
          rawDate: v.recordedAt,
          value: v[key] as number,
        }))

    return {
      bp,
      hr: pick("heartRate"),
      glucose: pick("glucose"),
      weight: pick("weight"),
      spo2: pick("oxygenSat"),
    }
  }, [vitals])

  if (!user) return null

  const fmtFull = (v?: VitalsEntry) =>
    v
      ? `${format(toDate(v.recordedAt), "d MMM yyyy, h:mm a")} · ${formatDistanceToNow(
          toDate(v.recordedAt),
          { addSuffix: true }
        )}`
      : undefined

  // ============== Loading state ==============
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-44 rounded-lg" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    )
  }

  // ============== Empty state ==============
  if (vitals.length === 0) {
    return (
      <div className="space-y-6">
        <HeroBanner
          title="Health Vitals"
          subtitle="Track your blood pressure, glucose, weight and more — visualize trends over time."
          icon={Activity}
        />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <EmptyState
            icon={Activity}
            title="No vitals logged yet"
            description="Start tracking your health by logging your first set of measurements — blood pressure, heart rate, glucose, weight and more."
            action={
              <Button
                onClick={openCreate}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                Log New Vitals
              </Button>
            }
          />
        </motion.div>

        <VitalsFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editingId={editingId}
          form={form}
          setField={setField}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
        <DeleteAlertDialog
          open={!!deleteId}
          onOpenChange={(o) => !o && setDeleteId(null)}
          onConfirm={handleDelete}
          submitting={submitting}
        />
      </div>
    )
  }

  // ============== Main render ==============
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <HeroBanner
          title="Health Vitals"
          subtitle="Track your blood pressure, glucose, weight and more — visualize trends over time."
          icon={Activity}
        />
      </motion.div>

      {/* Stat row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <MiniStat
          icon={Activity}
          label="Blood Pressure"
          value={
            latestBP
              ? `${latestBP.systolic ?? "—"}/${latestBP.diastolic ?? "—"}`
              : "—"
          }
          unit="mmHg"
          time={fmtFull(latestBP)}
          color="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
        />
        <MiniStat
          icon={Heart}
          label="Heart Rate"
          value={latestHR ? String(latestHR.heartRate) : "—"}
          unit="bpm"
          time={fmtFull(latestHR)}
          color="bg-rose-50 text-rose-600 dark:bg-rose-500/10"
        />
        <MiniStat
          icon={Droplet}
          label="Glucose"
          value={latestGlucose ? String(latestGlucose.glucose) : "—"}
          unit="mg/dL"
          time={fmtFull(latestGlucose)}
          color="bg-amber-50 text-amber-600 dark:bg-amber-500/10"
        />
        <MiniStat
          icon={Wind}
          label="Oxygen Sat"
          value={latestSpO2 ? String(latestSpO2.oxygenSat) : "—"}
          unit="%"
          time={fmtFull(latestSpO2)}
          color="bg-sky-50 text-sky-600 dark:bg-sky-500/10"
        />
      </motion.div>

      {/* Section header + log button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          title="Trend Analysis"
          description="Visualize how your key metrics change over time (last 30 entries)."
          icon={Activity}
        />
        <Button
          onClick={openCreate}
          className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Log New Vitals
        </Button>
      </div>

      {/* Charts */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        <BPChartCard data={chartData.bp} />
        <ChartCard
          title="Heart Rate"
          description="Resting & active heart rate over time (bpm)."
          data={chartData.hr}
          dataKey="value"
          name="Heart Rate"
          unit="bpm"
          color="#10b981"
          domain={[0, "auto"]}
        />
        <ChartCard
          title="Glucose"
          description="Blood glucose over time. Healthy band: 70–100 mg/dL."
          data={chartData.glucose}
          dataKey="value"
          name="Glucose"
          unit="mg/dL"
          color="#0d9488"
          referenceArea={{ y1: 70, y2: 100, color: "#10b981" }}
        />
        <ChartCard
          title="Weight"
          description="Body weight over time (kg)."
          data={chartData.weight}
          dataKey="value"
          name="Weight"
          unit="kg"
          color="#14b8a6"
          domain={["auto", "auto"]}
        />
        <ChartCard
          title="Oxygen Saturation"
          description="SpO₂ over time. Reference line at 95%."
          data={chartData.spo2}
          dataKey="value"
          name="SpO₂"
          unit="%"
          color="#059669"
          referenceLines={[{ y: 95, label: "95%", color: "#10b981" }]}
          domain={[50, 100]}
        />
      </motion.div>

      {/* History table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Activity className="h-4 w-4 text-emerald-600" />
              Vitals History
            </CardTitle>
            <CardDescription className="text-xs">
              All logged entries, newest first. Use the menu to edit or delete.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="max-h-96 overflow-y-auto rounded-lg border border-border/60 pr-1">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">BP</TableHead>
                    <TableHead className="text-xs">HR</TableHead>
                    <TableHead className="text-xs">Glucose</TableHead>
                    <TableHead className="text-xs">Weight</TableHead>
                    <TableHead className="text-xs">SpO₂</TableHead>
                    <TableHead className="text-xs">Note</TableHead>
                    <TableHead className="w-[40px] text-xs text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vitals.map((v) => (
                    <TableRow key={v.id} className="hover:bg-muted/40">
                      <TableCell className="whitespace-nowrap text-xs font-medium">
                        {format(toDate(v.recordedAt), "d MMM yyyy, h:mm a")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {v.systolic != null || v.diastolic != null ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-500/10 dark:text-emerald-400"
                          >
                            {v.systolic ?? "—"}/{v.diastolic ?? "—"}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {v.heartRate != null ? (
                          <span className="font-medium text-rose-600 dark:text-rose-400">
                            {v.heartRate}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {v.glucose != null ? (
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            {v.glucose}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {v.weight != null ? (
                          <span className="font-medium">{v.weight}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {v.oxygenSat != null ? (
                          <span className="font-medium text-sky-600 dark:text-sky-400">
                            {v.oxygenSat}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {v.note || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuLabel className="text-xs text-muted-foreground">
                              Actions
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEdit(v)}>
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteId(v.id)}
                              className="text-rose-600 focus:text-rose-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Log/Edit dialog */}
      <VitalsFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingId={editingId}
        form={form}
        setField={setField}
        onSubmit={handleSubmit}
        submitting={submitting}
      />

      {/* Delete confirmation */}
      <DeleteAlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={handleDelete}
        submitting={submitting}
      />
    </div>
  )
}

// ============== Form Dialog subcomponent ==============
function VitalsFormDialog({
  open,
  onOpenChange,
  editingId,
  form,
  setField,
  onSubmit,
  submitting,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  editingId: string | null
  form: FormState
  setField: (key: keyof FormState, value: string) => void
  onSubmit: () => void
  submitting: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b p-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-emerald-600" />
            {editingId ? "Edit Vitals Entry" : "Log New Vitals"}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {editingId
              ? "Update the measurements for this entry. All fields are optional, but at least one measurement is required."
              : "Enter your measurements below. All fields are optional, but at least one measurement is required."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField
              id="systolic"
              label="Systolic"
              value={form.systolic}
              onChange={(v) => setField("systolic", v)}
              icon={Activity}
              unit="mmHg"
              min={50}
              max={300}
              step={1}
              placeholder="120"
            />
            <NumberField
              id="diastolic"
              label="Diastolic"
              value={form.diastolic}
              onChange={(v) => setField("diastolic", v)}
              icon={Activity}
              unit="mmHg"
              min={30}
              max={200}
              step={1}
              placeholder="80"
            />
            <NumberField
              id="heartRate"
              label="Heart Rate"
              value={form.heartRate}
              onChange={(v) => setField("heartRate", v)}
              icon={Heart}
              unit="bpm"
              min={20}
              max={250}
              step={1}
              placeholder="72"
            />
            <NumberField
              id="glucose"
              label="Glucose"
              value={form.glucose}
              onChange={(v) => setField("glucose", v)}
              icon={Droplet}
              unit="mg/dL"
              min={20}
              max={600}
              step={1}
              placeholder="95"
            />
            <NumberField
              id="weight"
              label="Weight"
              value={form.weight}
              onChange={(v) => setField("weight", v)}
              icon={Scale}
              unit="kg"
              min={10}
              max={500}
              step={0.1}
              placeholder="70.0"
            />
            <NumberField
              id="temperature"
              label="Temperature"
              value={form.temperature}
              onChange={(v) => setField("temperature", v)}
              icon={Thermometer}
              unit="°C"
              min={30}
              max={45}
              step={0.1}
              placeholder="36.6"
            />
            <NumberField
              id="oxygenSat"
              label="Oxygen Saturation"
              value={form.oxygenSat}
              onChange={(v) => setField("oxygenSat", v)}
              icon={Wind}
              unit="%"
              min={50}
              max={100}
              step={1}
              placeholder="98"
            />
            <NumberField
              id="steps"
              label="Steps"
              value={form.steps}
              onChange={(v) => setField("steps", v)}
              icon={Footprints}
              unit="count"
              min={0}
              max={100000}
              step={1}
              placeholder="8000"
            />
          </div>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor="note" className="flex items-center gap-1.5 text-xs font-medium">
              <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
              Note <span className="text-muted-foreground">· optional</span>
            </Label>
            <Textarea
              id="note"
              value={form.note}
              onChange={(e) => setField("note", e.target.value)}
              placeholder="Any context — e.g. measured after morning walk, fasting, etc."
              className="min-h-[72px] resize-y rounded-lg"
            />
          </div>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor="recordedAt" className="flex items-center gap-1.5 text-xs font-medium">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              Recorded At
            </Label>
            <Input
              id="recordedAt"
              type="datetime-local"
              value={form.recordedAt}
              onChange={(e) => setField("recordedAt", e.target.value)}
              className="rounded-lg"
            />
          </div>
        </div>

        <DialogFooter className="border-t p-6 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={submitting}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {editingId ? "Updating…" : "Saving…"}
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                {editingId ? "Update Entry" : "Log Vitals"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============== Delete Confirmation ==============
function DeleteAlertDialog({
  open,
  onOpenChange,
  onConfirm,
  submitting,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onConfirm: () => void
  submitting: boolean
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-rose-600" />
            Delete this vitals entry?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The entry and all its measurements will
            be permanently removed from your history.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            disabled={submitting}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete Entry
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default VitalsTracker
