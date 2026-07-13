"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { format, parseISO } from "date-fns"
import { toast } from "sonner"
import {
  Pill,
  Plus,
  Clock,
  CheckCircle2,
  PackageCheck,
  XCircle,
  Loader2,
  Phone,
  Droplet,
  Calendar,
  Stethoscope,
  FlaskConical,
} from "lucide-react"

import { useAuthStore } from "@/lib/auth-store"
import { apiFetch } from "@/lib/api"
import { cn, doctorName } from "@/lib/utils"
import {
  StatCard,
  SectionHeader,
  EmptyState,
  HeroBanner,
} from "@/components/dashboard/shared/primitives"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

// ---------- Types ----------
type RefillStatus = "PENDING" | "APPROVED" | "FULFILLED" | "DENIED"

interface RefillPatient {
  id: string
  name: string
  mobile?: string | null
  bloodGroup?: string | null
}
interface RefillDoctor {
  id: string
  name: string
  specialization?: string | null
}
interface RefillRequest {
  id: string
  patientId: string
  doctorId: string
  recordId: string | null
  medicineName: string
  dosage: string
  quantity: number
  note: string | null
  status: RefillStatus
  doctorNote: string | null
  createdAt: string
  updatedAt: string
  patient: RefillPatient
  doctor: RefillDoctor
}

interface DoctorOption {
  id: string
  name: string
  specialization?: string | null
  city?: string | null
  avgRating?: number
}

// ---------- Status helpers ----------
const STATUS_CONFIG: Record<
  RefillStatus,
  { label: string; badge: string; accent: string; icon: typeof Clock }
> = {
  PENDING: {
    label: "Pending",
    badge:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
    accent: "from-amber-500 to-orange-500",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved",
    badge:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
    accent: "from-emerald-500 to-teal-500",
    icon: CheckCircle2,
  },
  FULFILLED: {
    label: "Fulfilled",
    badge:
      "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/20",
    accent: "from-teal-500 to-cyan-500",
    icon: PackageCheck,
  },
  DENIED: {
    label: "Denied",
    badge:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20",
    accent: "from-rose-500 to-pink-500",
    icon: XCircle,
  },
}

function StatusBadge({ status }: { status: RefillStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <Badge variant="outline" className={cn("gap-1 rounded-full px-2.5", cfg.badge)}>
      <cfg.icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  )
}

const FILTERS: { key: "ALL" | RefillStatus; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "FULFILLED", label: "Fulfilled" },
  { key: "DENIED", label: "Denied" },
]

function FilterPills({
  active,
  onChange,
}: {
  active: "ALL" | RefillStatus
  onChange: (v: "ALL" | RefillStatus) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => onChange(f.key)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
            active === f.key
              ? "bg-emerald-600 text-white shadow-sm shadow-emerald-500/20"
              : "bg-muted text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-500/10"
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  )
}

function CardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-52 rounded-xl" />
      ))}
    </div>
  )
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 truncate text-foreground">{value}</p>
    </div>
  )
}

// ---------- Patient view ----------
function PatientRefills({ userId }: { userId: string }) {
  const [refills, setRefills] = useState<RefillRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"ALL" | RefillStatus>("ALL")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // form state
  const [doctorId, setDoctorId] = useState("")
  const [medicineName, setMedicineName] = useState("")
  const [dosage, setDosage] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [note, setNote] = useState("")

  // doctors list
  const [doctors, setDoctors] = useState<DoctorOption[]>([])
  const [doctorsLoading, setDoctorsLoading] = useState(false)

  const loadRefills = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<{ refills: RefillRequest[] }>(
        `/api/refills?userId=${encodeURIComponent(userId)}&role=PATIENT`
      )
      setRefills(data.refills || [])
    } catch (e) {
      toast.error("Failed to load refill requests", {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadRefills()
  }, [loadRefills])

  const openDialog = async () => {
    setDialogOpen(true)
    if (doctors.length === 0) {
      setDoctorsLoading(true)
      try {
        const data = await apiFetch<{ doctors: DoctorOption[] }>(
          "/api/doctors"
        )
        setDoctors(data.doctors || [])
      } catch (e) {
        toast.error("Could not load doctor list", {
          description: e instanceof Error ? e.message : undefined,
        })
      } finally {
        setDoctorsLoading(false)
      }
    }
  }

  const resetForm = () => {
    setDoctorId("")
    setMedicineName("")
    setDosage("")
    setQuantity("1")
    setNote("")
  }

  const handleSubmit = async () => {
    if (!doctorId) {
      toast.error("Please select a doctor")
      return
    }
    if (!medicineName.trim()) {
      toast.error("Medicine name is required")
      return
    }
    setSubmitting(true)
    try {
      const res = await apiFetch<{ refill: RefillRequest }>("/api/refills", {
        method: "POST",
        body: JSON.stringify({
          patientId: userId,
          doctorId,
          medicineName: medicineName.trim(),
          dosage: dosage.trim(),
          quantity: Number(quantity) || 1,
          note: note.trim() || undefined,
        }),
      })
      // Nuclear fix: the POST response IS the canonical record.
      // Gate the toast + state update on the response payload so we
      // never show a false "successfully added" toast. Do NOT fire an
      // un-awaited background refetch — Supabase pooler read-after-write
      // lag can cause the refetch to return a list WITHOUT the new item,
      // which would wholesale-replace state and silently wipe it.
      if (!res?.refill) {
        throw new Error("Server confirmed the save but did not return the record.")
      }
      setRefills((prev) => [res.refill, ...prev])
      toast.success("Refill request submitted", {
        description: "Your doctor will review it shortly.",
      })
      setDialogOpen(false)
      resetForm()
      // No background refetch — the POST response above is the source of truth.
    } catch (e) {
      toast.error("Failed to submit request", {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const counts = useMemo(
    () => ({
      PENDING: refills.filter((r) => r.status === "PENDING").length,
      APPROVED: refills.filter((r) => r.status === "APPROVED").length,
      FULFILLED: refills.filter((r) => r.status === "FULFILLED").length,
      DENIED: refills.filter((r) => r.status === "DENIED").length,
    }),
    [refills]
  )

  const filtered = useMemo(() => {
    if (filter === "ALL") return refills
    return refills.filter((r) => r.status === filter)
  }, [refills, filter])

  return (
    <div className="space-y-6">
      <HeroBanner
        title="Prescription Refills"
        subtitle="Request refills from your doctors and track approval status."
        icon={Pill}
      >
        <Button
          onClick={openDialog}
          className="bg-white text-emerald-700 hover:bg-emerald-50"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Request Refill</span>
          <span className="sm:hidden">New</span>
        </Button>
      </HeroBanner>

      {loading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            title="Pending"
            value={counts.PENDING}
            icon={Clock}
            color="bg-amber-50 text-amber-600 dark:bg-amber-500/10"
            accent="from-amber-500 to-orange-500"
          />
          <StatCard
            title="Approved"
            value={counts.APPROVED}
            icon={CheckCircle2}
            color="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
            accent="from-emerald-500 to-teal-500"
          />
          <StatCard
            title="Fulfilled"
            value={counts.FULFILLED}
            icon={PackageCheck}
            color="bg-teal-50 text-teal-600 dark:bg-teal-500/10"
            accent="from-teal-500 to-cyan-500"
          />
          <StatCard
            title="Denied"
            value={counts.DENIED}
            icon={XCircle}
            color="bg-rose-50 text-rose-600 dark:bg-rose-500/10"
            accent="from-rose-500 to-pink-500"
          />
        </div>
      )}

      <SectionHeader
        title="Your Refill Requests"
        description="Track each request from submission to fulfillment."
        icon={FlaskConical}
        action={<FilterPills active={filter} onChange={setFilter} />}
      />

      {loading ? (
        <CardsSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Pill}
          title="No refill requests"
          description={
            filter === "ALL"
              ? "When you request a refill, it will appear here."
              : `No ${filter.toLowerCase()} refill requests at the moment.`
          }
          action={
            filter === "ALL" ? (
              <Button
                onClick={openDialog}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                Request a Refill
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: Math.min(i * 0.04, 0.32) }}
            >
              <PatientRefillCard refill={r} />
            </motion.div>
          ))}
        </div>
      )}

      {/* Request dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request a Refill</DialogTitle>
            <DialogDescription>
              Choose a doctor and the medicine you need refilled.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="refill-doctor">Doctor</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger id="refill-doctor" className="w-full">
                  <SelectValue
                    placeholder={
                      doctorsLoading ? "Loading doctors…" : "Select a doctor"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {doctorsLoading && (
                    <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </div>
                  )}
                  {!doctorsLoading && doctors.length === 0 && (
                    <div className="px-2 py-3 text-sm text-muted-foreground">
                      No doctors available.
                    </div>
                  )}
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {doctorName(d.name)}
                      {d.specialization ? ` — ${d.specialization}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="refill-medicine">
                Medicine name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="refill-medicine"
                value={medicineName}
                onChange={(e) => setMedicineName(e.target.value)}
                placeholder="e.g. Metformin 500mg"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="refill-dosage">Dosage</Label>
                <Input
                  id="refill-dosage"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  placeholder="1 tablet twice daily"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="refill-quantity">Quantity</Label>
                <Input
                  id="refill-quantity"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="refill-note">Note (optional)</Label>
              <Textarea
                id="refill-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add context for your doctor…"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PatientRefillCard({ refill }: { refill: RefillRequest }) {
  const created = format(parseISO(refill.createdAt), "MMM d, yyyy")
  return (
    <Card className="h-full transition-all duration-200 hover:shadow-md hover:shadow-emerald-500/5">
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
              <Pill className="h-5 w-5" />
            </div>
            <h3 className="truncate font-semibold">{refill.medicineName}</h3>
          </div>
          <StatusBadge status={refill.status} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <DetailItem
            icon={<Stethoscope className="h-3.5 w-3.5" />}
            label="Doctor"
            value={doctorName(refill.doctor.name)}
          />
          <DetailItem
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Requested"
            value={created}
          />
          {refill.dosage && (
            <DetailItem
              icon={<FlaskConical className="h-3.5 w-3.5" />}
              label="Dosage"
              value={refill.dosage}
            />
          )}
          <DetailItem
            icon={<PackageCheck className="h-3.5 w-3.5" />}
            label="Quantity"
            value={String(refill.quantity)}
          />
        </div>

        {(refill.note || refill.doctorNote) && (
          <Separator className="my-4" />
        )}

        {refill.note && (
          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your note
            </p>
            <p className="text-foreground">{refill.note}</p>
          </div>
        )}

        {refill.doctorNote && (
          <div
            className={cn(
              "mt-2 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 text-sm",
              "dark:border-emerald-500/20 dark:bg-emerald-500/5"
            )}
          >
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Doctor&apos;s response
            </p>
            <p className="text-foreground">{refill.doctorNote}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------- Doctor / Organization view ----------
function DoctorRefills({
  userId,
  role,
}: {
  userId: string
  role: "DOCTOR" | "ORGANIZATION"
}) {
  const [refills, setRefills] = useState<RefillRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"ALL" | RefillStatus>("ALL")
  // doctor notes being drafted, keyed by refill id
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({})
  const [actingId, setActingId] = useState<string | null>(null)

  const loadRefills = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<{ refills: RefillRequest[] }>(
        `/api/refills?userId=${encodeURIComponent(userId)}&role=${role}`
      )
      setRefills(data.refills || [])
    } catch (e) {
      toast.error("Failed to load refill queue", {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [userId, role])

  useEffect(() => {
    loadRefills()
  }, [loadRefills])

  const counts = useMemo(
    () => ({
      PENDING: refills.filter((r) => r.status === "PENDING").length,
      APPROVED: refills.filter((r) => r.status === "APPROVED").length,
      FULFILLED: refills.filter((r) => r.status === "FULFILLED").length,
      DENIED: refills.filter((r) => r.status === "DENIED").length,
    }),
    [refills]
  )

  const filtered = useMemo(() => {
    if (filter === "ALL") return refills
    return refills.filter((r) => r.status === filter)
  }, [refills, filter])

  const updateStatus = async (
    id: string,
    status: RefillStatus,
    successMsg: string
  ) => {
    setActingId(id)
    const note = draftNotes[id]?.trim() || undefined
    try {
      const res = await apiFetch<{ refill: RefillRequest }>("/api/refills", {
        method: "PATCH",
        body: JSON.stringify({ id, status, doctorNote: note }),
      })
      // Nuclear fix: the PATCH response IS the canonical record.
      // Gate the toast + state update on the response payload so we
      // never show a false "updated" toast. Do NOT fire an un-awaited
      // background refetch — Supabase pooler read-after-write lag can
      // cause the refetch to return stale data, which would
      // wholesale-replace state and silently wipe the optimistic update.
      if (!res?.refill) {
        throw new Error("Server confirmed the update but did not return the record.")
      }
      setRefills((prev) => prev.map((r) => (r.id === id ? res.refill : r)))
      toast.success(successMsg)
      setDraftNotes((p) => {
        const next = { ...p }
        delete next[id]
        return next
      })
      // No background refetch — the PATCH response above is the source of truth.
    } catch (e) {
      toast.error("Update failed", {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <HeroBanner
        title="Refill Requests"
        subtitle="Review and respond to prescription refill requests from your patients."
        icon={Pill}
      />

      {loading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            title="Pending"
            value={counts.PENDING}
            icon={Clock}
            color="bg-amber-50 text-amber-600 dark:bg-amber-500/10"
            accent="from-amber-500 to-orange-500"
          />
          <StatCard
            title="Approved"
            value={counts.APPROVED}
            icon={CheckCircle2}
            color="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
            accent="from-emerald-500 to-teal-500"
          />
          <StatCard
            title="Fulfilled"
            value={counts.FULFILLED}
            icon={PackageCheck}
            color="bg-teal-50 text-teal-600 dark:bg-teal-500/10"
            accent="from-teal-500 to-cyan-500"
          />
          <StatCard
            title="Denied"
            value={counts.DENIED}
            icon={XCircle}
            color="bg-rose-50 text-rose-600 dark:bg-rose-500/10"
            accent="from-rose-500 to-pink-500"
          />
        </div>
      )}

      <SectionHeader
        title="Refill Queue"
        description="Approve, deny, or fulfill incoming patient requests."
        icon={FlaskConical}
        action={<FilterPills active={filter} onChange={setFilter} />}
      />

      {loading ? (
        <CardsSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Pill}
          title="No refill requests"
          description={
            filter === "ALL"
              ? "Patient refill requests will appear here."
              : `No ${filter.toLowerCase()} requests at the moment.`
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: Math.min(i * 0.04, 0.32) }}
            >
              <DoctorRefillCard
                refill={r}
                draftNote={draftNotes[r.id] || ""}
                onDraftNote={(v) =>
                  setDraftNotes((p) => ({ ...p, [r.id]: v }))
                }
                acting={actingId === r.id}
                onApprove={() =>
                  updateStatus(r.id, "APPROVED", "Refill approved")
                }
                onDeny={() => updateStatus(r.id, "DENIED", "Refill denied")}
                onFulfill={() =>
                  updateStatus(r.id, "FULFILLED", "Refill fulfilled")
                }
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

function DoctorRefillCard({
  refill,
  draftNote,
  onDraftNote,
  acting,
  onApprove,
  onDeny,
  onFulfill,
}: {
  refill: RefillRequest
  draftNote: string
  onDraftNote: (v: string) => void
  acting: boolean
  onApprove: () => void
  onDeny: () => void
  onFulfill: () => void
}) {
  const created = format(parseISO(refill.createdAt), "MMM d, yyyy")
  const initials = refill.patient.name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <Card className="h-full transition-all duration-200 hover:shadow-md hover:shadow-emerald-500/5">
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                {initials || "P"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-semibold">{refill.patient.name}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                {refill.patient.bloodGroup && (
                  <span className="inline-flex items-center gap-1">
                    <Droplet className="h-3 w-3 text-rose-500" />
                    {refill.patient.bloodGroup}
                  </span>
                )}
                {refill.patient.mobile && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {refill.patient.mobile}
                  </span>
                )}
              </div>
            </div>
          </div>
          <StatusBadge status={refill.status} />
        </div>

        <Separator className="my-4" />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
              <Pill className="h-4 w-4" />
            </div>
            <h3 className="font-semibold">{refill.medicineName}</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {refill.dosage && (
              <DetailItem
                icon={<FlaskConical className="h-3.5 w-3.5" />}
                label="Dosage"
                value={refill.dosage}
              />
            )}
            <DetailItem
              icon={<PackageCheck className="h-3.5 w-3.5" />}
              label="Quantity"
              value={String(refill.quantity)}
            />
            <DetailItem
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Requested"
              value={created}
            />
          </div>
        </div>

        {refill.note && (
          <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Patient note
            </p>
            <p className="text-foreground">{refill.note}</p>
          </div>
        )}

        {refill.doctorNote && refill.status !== "PENDING" && (
          <div
            className={cn(
              "mt-2 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 text-sm",
              "dark:border-emerald-500/20 dark:bg-emerald-500/5"
            )}
          >
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Your response
            </p>
            <p className="text-foreground">{refill.doctorNote}</p>
          </div>
        )}

        {refill.status === "PENDING" && (
          <div className="mt-4 space-y-3">
            <Textarea
              value={draftNote}
              onChange={(e) => onDraftNote(e.target.value)}
              placeholder="Optional note for the patient…"
              rows={2}
              className="text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={onApprove}
                disabled={acting}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {acting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onDeny}
                disabled={acting}
                className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10"
              >
                <XCircle className="h-4 w-4" />
                Deny
              </Button>
            </div>
          </div>
        )}

        {refill.status === "APPROVED" && (
          <div className="mt-4">
            <Button
              size="sm"
              onClick={onFulfill}
              disabled={acting}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {acting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PackageCheck className="h-4 w-4" />
              )}
              Mark Fulfilled
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------- Exported component ----------
export function RefillRequests({
  role,
}: {
  role: "PATIENT" | "DOCTOR" | "ORGANIZATION"
}) {
  const user = useAuthStore((s) => s.user)
  if (!user) return null

  if (role === "PATIENT") {
    return <PatientRefills userId={user.id} />
  }
  return <DoctorRefills userId={user.id} role={role} />
}

export default RefillRequests
