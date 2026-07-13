"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { format, parseISO } from "date-fns"
import { toast } from "sonner"
import {
  Pill,
  Stethoscope,
  Calendar,
  Building2,
  FlaskConical,
  Loader2,
  RefreshCw,
  CheckCircle2,
  FileText,
  Plus,
} from "lucide-react"

import { useAuthStore } from "@/lib/auth-store"
import { apiFetch } from "@/lib/api"
import { cn, doctorName } from "@/lib/utils"
import {
  HeroBanner,
  EmptyState,
} from "@/components/dashboard/shared/primitives"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

// ---------- Types ----------
type VisitType =
  | "CONSULTATION"
  | "EMERGENCY"
  | "FOLLOW_UP"
  | "CHECKUP"
  | "PROCEDURE"

interface RecordDoctor {
  id: string
  name: string
  specialization?: string | null
}

interface MedicalRecord {
  id: string
  patientId: string
  doctorId: string
  visitType: VisitType
  clinicName: string
  practitionerName?: string | null
  specialization?: string | null
  diagnosis: string
  doctorsNotes: string
  prescription: string
  attachments: string
  visitDate: string
  doctor?: RecordDoctor | null
}

interface PrescriptionMed {
  medicine: string
  dose: string
  frequency: string
  duration: string
}

type ParsedPrescription =
  | { kind: "json"; meds: PrescriptionMed[] }
  | { kind: "text"; text: string }

// ---------- Helpers ----------
function parsePrescription(raw: string): ParsedPrescription {
  if (!raw) return { kind: "text", text: "" }
  const trimmed = raw.trim()
  if (!trimmed) return { kind: "text", text: "" }
  // Heuristic: looks like JSON
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        const meds = parsed
          .filter(
            (m) =>
              m &&
              typeof m === "object" &&
              typeof (m as PrescriptionMed).medicine === "string"
          )
          .map((m) => ({
            medicine: String((m as PrescriptionMed).medicine ?? "").trim(),
            dose: String((m as PrescriptionMed).dose ?? "").trim(),
            frequency: String((m as PrescriptionMed).frequency ?? "").trim(),
            duration: String((m as PrescriptionMed).duration ?? "").trim(),
          }))
          .filter((m) => m.medicine.length > 0)
        if (meds.length > 0) return { kind: "json", meds }
      }
    } catch {
      // fall through to text
    }
  }
  return { kind: "text", text: trimmed }
}

const VISIT_TYPE_CONFIG: Record<
  VisitType,
  { label: string; badge: string }
> = {
  CONSULTATION:
    "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20",
  EMERGENCY:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20",
  FOLLOW_UP:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  CHECKUP:
    "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/20",
  PROCEDURE:
    "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-500/10 dark:text-fuchsia-300 dark:border-fuchsia-500/20",
}

function VisitTypeBadge({ type }: { type: VisitType }) {
  const cfg = VISIT_TYPE_CONFIG[type] || VISIT_TYPE_CONFIG.CONSULTATION
  const label = type.replace(/_/g, " ")
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        cfg
      )}
    >
      {label}
    </Badge>
  )
}

function truncate(text: string, max: number) {
  if (!text) return ""
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}

// ---------- Skeletons ----------
function RecordsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-56 rounded-xl" />
      ))}
    </div>
  )
}

// ---------- Prescription Preview ----------
function PrescriptionPreview({
  parsed,
  requestedKeys,
  onRequest,
}: {
  parsed: ParsedPrescription
  requestedKeys: Set<string>
  onRequest: (med: PrescriptionMed | null) => void
}) {
  if (parsed.kind === "json") {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <FlaskConical className="h-3.5 w-3.5" />
          Prescribed medicines
        </p>
        <div className="flex flex-wrap gap-1.5">
          {parsed.meds.map((m, idx) => {
            const key = `${m.medicine}-${idx}`
            const requested = requestedKeys.has(key)
            return (
              <Badge
                key={key}
                variant="secondary"
                className={cn(
                  "gap-1 rounded-full px-2.5 py-1 text-xs",
                  requested
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "bg-muted text-foreground"
                )}
              >
                <Pill className="h-3 w-3" />
                {m.medicine}
                {requested && (
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                )}
              </Badge>
            )
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {parsed.meds.map((m, idx) => {
            const key = `${m.medicine}-${idx}`
            const requested = requestedKeys.has(key)
            return (
              <Button
                key={`btn-${key}`}
                type="button"
                size="sm"
                variant={requested ? "outline" : "default"}
                disabled={requested}
                onClick={() => onRequest(m)}
                className={cn(
                  "h-8 gap-1.5 rounded-full px-3 text-xs",
                  !requested && "bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                {requested ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Refill requested
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refill {m.medicine}
                  </>
                )}
              </Button>
            )
          })}
        </div>
      </div>
    )
  }

  // Plain text
  const snippet = truncate(parsed.text, 100)
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        Prescription
      </p>
      <p className="rounded-lg bg-muted/40 p-3 text-sm text-foreground">
        {snippet || "—"}
      </p>
      <div>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5 rounded-full bg-emerald-600 px-3 text-xs hover:bg-emerald-700"
          onClick={() => onRequest(null)}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Request Refill
        </Button>
      </div>
    </div>
  )
}

// ---------- Record Card ----------
function RecordCard({
  record,
  requestedKeys,
  onRequest,
  index,
}: {
  record: MedicalRecord
  requestedKeys: Set<string>
  onRequest: (med: PrescriptionMed | null) => void
  index: number
}) {
  const parsed = useMemo(
    () => parsePrescription(record.prescription),
    [record.prescription]
  )
  const visitDate = format(parseISO(record.visitDate), "MMM d, yyyy")
  const docName = record.doctor?.name
    ? doctorName(record.doctor.name)
    : record.practitionerName
      ? doctorName(record.practitionerName)
      : "Doctor"
  const specialization =
    record.doctor?.specialization || record.specialization || ""

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.04, 0.32) }}
    >
      <Card className="h-full transition-all duration-200 hover:shadow-md hover:shadow-emerald-500/5">
        <CardContent className="flex h-full flex-col p-5">
          {/* Header: date + visit type */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                <Pill className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {visitDate}
                </p>
                <p className="truncate text-sm font-semibold">{docName}</p>
              </div>
            </div>
            <VisitTypeBadge type={record.visitType} />
          </div>

          {/* Specialization + clinic */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {specialization && (
              <Badge
                variant="outline"
                className="rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
              >
                <Stethoscope className="mr-1 h-3 w-3" />
                {specialization}
              </Badge>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span className="max-w-[200px] truncate">{record.clinicName}</span>
            </span>
          </div>

          {/* Diagnosis */}
          {record.diagnosis && (
            <div className="mt-3 rounded-lg bg-muted/30 p-3">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Diagnosis
              </p>
              <p className="text-sm text-foreground">{truncate(record.diagnosis, 140)}</p>
            </div>
          )}

          <Separator className="my-4" />

          {/* Prescription preview + actions */}
          <div className="mt-auto">
            <PrescriptionPreview
              parsed={parsed}
              requestedKeys={requestedKeys}
              onRequest={(med) => onRequest(m)}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ---------- Main Component ----------
export function RefillFromRecord() {
  const user = useAuthStore((s) => s.user)

  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // session-tracked requested keys: `${recordId}::${medicine}`
  const [requested, setRequested] = useState<Set<string>>(new Set())

  // dialog context
  const [activeRecord, setActiveRecord] = useState<MedicalRecord | null>(null)
  const [activeMed, setActiveMed] = useState<PrescriptionMed | null>(null)

  // form fields
  const [medicineName, setMedicineName] = useState("")
  const [dosage, setDosage] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [note, setNote] = useState("")
  const [medicineEditable, setMedicineEditable] = useState(false)

  const loadRecords = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await apiFetch<{ records: MedicalRecord[] }>(
        `/api/records?userId=${encodeURIComponent(user.id)}&role=PATIENT`
      )
      // only keep records with non-empty prescription
      setRecords(
        (data.records || []).filter(
          (r) => r.prescription && r.prescription.trim().length > 0
        )
      )
    } catch (e) {
      toast.error("Failed to load medical records", {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) loadRecords()
  }, [user, loadRecords])

  const keyFor = (recordId: string, med: PrescriptionMed | null) =>
    med ? `${recordId}::${med.medicine}` : `${recordId}::__text__`

  const openRefillDialog = (record: MedicalRecord, med: PrescriptionMed | null) => {
    const visitDate = format(parseISO(record.visitDate), "MMM d, yyyy")
    setActiveRecord(record)
    setActiveMed(med)
    if (med) {
      setMedicineName(med.medicine)
      setDosage(med.dose || "")
      setMedicineEditable(false)
    } else {
      // plain-text case: pre-fill with snippet if short enough
      const parsed = parsePrescription(record.prescription)
      const snippet = parsed.kind === "text" ? parsed.text.trim() : ""
      setMedicineName(snippet.length > 0 && snippet.length <= 80 ? snippet : "")
      setDosage("")
      setMedicineEditable(true)
    }
    setQuantity("1")
    setNote(`Refill requested from record dated ${visitDate}`)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setActiveRecord(null)
    setActiveMed(null)
    setMedicineName("")
    setDosage("")
    setQuantity("1")
    setNote("")
    setMedicineEditable(false)
  }

  const handleSubmit = async () => {
    if (!user || !activeRecord) return
    if (!medicineName.trim()) {
      toast.error("Medicine name is required")
      return
    }
    if (!activeRecord.doctor?.id && !activeRecord.doctorId) {
      toast.error("This record is missing a doctor reference")
      return
    }
    setSubmitting(true)
    try {
      await apiFetch("/api/refills", {
        method: "POST",
        body: JSON.stringify({
          patientId: user.id,
          doctorId: activeRecord.doctor?.id || activeRecord.doctorId,
          recordId: activeRecord.id,
          medicineName: medicineName.trim(),
          dosage: dosage.trim(),
          quantity: Number(quantity) || 1,
          note: note.trim() || undefined,
        }),
      })
      toast.success("Refill request submitted", {
        description: `${medicineName.trim()} — your doctor will review it shortly.`,
      })
      // mark requested in session
      const key = keyFor(activeRecord.id, activeMed)
      setRequested((prev) => new Set(prev).add(key))
      closeDialog()
      // refresh records list to reflect any UI state
      await loadRecords()
    } catch (e) {
      toast.error("Failed to submit refill request", {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) return null

  const doctorDisplay =
    activeRecord?.doctor?.name ||
    activeRecord?.practitionerName ||
    "Doctor"

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <HeroBanner
          title="Refill from Records"
          subtitle="Quickly request a refill from any past prescription — we'll pre-fill the details."
          icon={Pill}
        />
      </motion.div>

      {/* Section header */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
            <FlaskConical className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">
              Prescriptions on file
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Tap a medicine to request a refill from the original prescriber.
            </p>
          </div>
        </div>
        {!loading && records.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={loadRecords}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        )}
      </div>

      {loading ? (
        <RecordsSkeleton />
      ) : records.length === 0 ? (
        <EmptyState
          icon={Pill}
          title="No prescriptions found"
          description="Once your doctor creates a record with medications, you can request refills from here."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {records.map((r, i) => (
            <RecordCard
              key={r.id}
              record={r}
              index={i}
              requestedKeys={requested}
              onRequest={(med) => openRefillDialog(r, med)}
            />
          ))}
        </div>
      )}

      {/* Refill dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => (o ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="h-4 w-4 text-emerald-600" />
              Request Refill
            </DialogTitle>
            <DialogDescription>
              We&apos;ve pre-filled the details from your past prescription.
              Adjust the dosage, quantity, or note as needed.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {/* Doctor (read-only) */}
            <div className="grid gap-2">
              <Label>Prescribing doctor</Label>
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <Stethoscope className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {doctorName(doctorDisplay)}
                  </p>
                  {activeRecord?.doctor?.specialization && (
                    <p className="truncate text-xs text-muted-foreground">
                      {activeRecord.doctor.specialization}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Medicine name */}
            <div className="grid gap-2">
              <Label htmlFor="refill-medicine">
                Medicine name <span className="text-rose-500">*</span>
              </Label>
              {medicineEditable ? (
                <Input
                  id="refill-medicine"
                  value={medicineName}
                  onChange={(e) => setMedicineName(e.target.value)}
                  placeholder="Type the medicine you need refilled"
                />
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                  <Pill className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="truncate text-sm font-medium">
                    {medicineName}
                  </span>
                </div>
              )}
            </div>

            {/* Dosage */}
            <div className="grid gap-2">
              <Label htmlFor="refill-dosage">Dosage</Label>
              <Input
                id="refill-dosage"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="e.g. 1 tablet twice daily"
              />
            </div>

            {/* Quantity */}
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

            {/* Note */}
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
              onClick={closeDialog}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Submit Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default RefillFromRecord
