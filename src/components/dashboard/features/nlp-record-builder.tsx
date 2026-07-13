"use client"

/**
 * MoM Point #7 — AI Medical Record Builder
 * Free-text → structured medical record draft (NLP).
 *
 * Self-contained client component. POSTs free text to /api/ai/nlp-record,
 * then renders an editable draft (diagnosis, notes, prescription table,
 * follow-up, red flags) for the user to review & save.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles,
  Wand2,
  Trash2,
  Plus,
  X,
  Save,
  RotateCcw,
  Stethoscope,
  Pill,
  ClipboardList,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Lightbulb,
  ShieldAlert,
} from "lucide-react"
import { toast } from "sonner"

import {
  HeroBanner,
  SectionHeader,
  EmptyState,
} from "@/components/dashboard/shared/primitives"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { apiFetch, ApiError } from "@/lib/api"

// ============== Types ==============
type VisitType =
  | "CONSULTATION"
  | "EMERGENCY"
  | "FOLLOW_UP"
  | "CHECKUP"
  | "PROCEDURE"

interface Prescription {
  medicine: string
  dosage: string
  frequency: string
  duration: string
}

interface RecordDraft {
  visitType: VisitType
  diagnosis: string
  doctorsNotes: string
  prescription: Prescription[]
  followUpInDays: number | null
  redFlags: string[]
}

interface NlpResponse {
  ok: boolean
  draft?: RecordDraft
  raw?: string
  error?: string
}

interface NlpRecordBuilderProps {
  /** Called when the user clicks "Save as Medical Record". */
  onSaveRecord?: (record: RecordDraft) => void
  /** Pre-fill the textarea from outside (e.g. from a voice memo transcript). */
  initialFreeText?: string
}

// ============== Constants ==============
const VISIT_TYPE_META: Record<
  VisitType,
  { label: string; badge: string; dot: string }
> = {
  CONSULTATION: {
    label: "Consultation",
    badge:
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30",
    dot: "bg-sky-500",
  },
  EMERGENCY: {
    label: "Emergency",
    badge:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30",
    dot: "bg-rose-500",
  },
  FOLLOW_UP: {
    label: "Follow-up",
    badge:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  CHECKUP: {
    label: "Checkup",
    badge:
      "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/30",
    dot: "bg-teal-500",
  },
  PROCEDURE: {
    label: "Procedure",
    badge:
      "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-500/10 dark:text-fuchsia-300 dark:border-fuchsia-500/30",
    dot: "bg-fuchsia-500",
  },
}

const VALID_VISIT_TYPES: VisitType[] = [
  "CONSULTATION",
  "EMERGENCY",
  "FOLLOW_UP",
  "CHECKUP",
  "PROCEDURE",
]

const PLACEHOLDER_EXAMPLE =
  "Patient came in with fever 102F and body ache for 3 days. Diagnosed viral fever. Prescribed paracetamol 500mg TID x5 days, rest, fluids. Follow up in 3 days if fever persists."

const EXAMPLE_PROMPTS: { title: string; icon: typeof Stethoscope; text: string }[] = [
  {
    title: "Viral fever",
    icon: Stethoscope,
    text: "Patient came in with fever 102F and body ache for 3 days. Diagnosed viral fever. Prescribed paracetamol 500mg TID x5 days, rest, fluids. Follow up in 3 days if fever persists.",
  },
  {
    title: "Hypertension follow-up",
    icon: Pill,
    text: "Follow-up visit for hypertension. BP today 140/90, down from 150/95 last month. Continue telmisartan 40mg OD. Reduce salt. Walk 30 minutes daily. Review in 2 weeks.",
  },
  {
    title: "Child checkup",
    icon: CheckCircle2,
    text: "5-year-old child brought for routine checkup. Weight 18kg, height 110cm, both normal for age. Immunization up to date. Healthy, no complaints. Next checkup in 6 months.",
  },
  {
    title: "Dental procedure",
    icon: FileText,
    text: "Performed extraction of lower right molar under local anesthesia. Patient tolerated procedure well. Prescribed amoxicillin 500mg TID x5 days and ibuprofen 400mg TID x3 days. Soft diet for 2 days. Review in 1 week.",
  },
]

// ============== Helpers ==============
function coerceDraft(raw: unknown): RecordDraft {
  const obj = (raw || {}) as Partial<RecordDraft>
  const vt = (obj.visitType as VisitType) || "CONSULTATION"
  return {
    visitType: VALID_VISIT_TYPES.includes(vt) ? vt : "CONSULTATION",
    diagnosis: typeof obj.diagnosis === "string" ? obj.diagnosis : "",
    doctorsNotes: typeof obj.doctorsNotes === "string" ? obj.doctorsNotes : "",
    prescription: Array.isArray(obj.prescription)
      ? obj.prescription.map((p) => ({
          medicine: p?.medicine ?? "",
          dosage: p?.dosage ?? "",
          frequency: p?.frequency ?? "",
          duration: p?.duration ?? "",
        }))
      : [],
    followUpInDays:
      typeof obj.followUpInDays === "number" && !isNaN(obj.followUpInDays)
        ? obj.followUpInDays
        : null,
    redFlags: Array.isArray(obj.redFlags)
      ? obj.redFlags.filter((r) => typeof r === "string" && r.trim().length > 0)
      : [],
  }
}

// ============== Sub-components ==============

function VisitTypeBadge({ type }: { type: VisitType }) {
  const meta = VISIT_TYPE_META[type] || VISIT_TYPE_META.CONSULTATION
  return (
    <Badge variant="outline" className={cn("gap-1.5", meta.badge)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </Badge>
  )
}

function VisitTypeSelector({
  value,
  onChange,
}: {
  value: VisitType
  onChange: (v: VisitType) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {VALID_VISIT_TYPES.map((vt) => {
        const meta = VISIT_TYPE_META[vt]
        const active = value === vt
        return (
          <button
            key={vt}
            type="button"
            onClick={() => onChange(vt)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
              active
                ? cn(meta.badge, "ring-2 ring-offset-1 ring-offset-background")
                : "border-border bg-transparent text-muted-foreground hover:bg-muted/50"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
            {meta.label}
          </button>
        )
      })}
    </div>
  )
}

function PrescriptionRow({
  row,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  row: Prescription
  index: number
  onChange: (patch: Partial<Prescription>) => void
  onRemove: () => void
  canRemove: boolean
}) {
  return (
    <div className="grid grid-cols-1 gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5 sm:grid-cols-12 sm:items-center">
      <div className="sm:col-span-4">
        <Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:sr-only">
          Medicine
        </Label>
        <Input
          value={row.medicine}
          onChange={(e) => onChange({ medicine: e.target.value })}
          placeholder="e.g. Paracetamol"
          className="h-9 text-sm"
          aria-label={`Medicine ${index + 1}`}
        />
      </div>
      <div className="sm:col-span-2">
        <Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:sr-only">
          Dosage
        </Label>
        <Input
          value={row.dosage}
          onChange={(e) => onChange({ dosage: e.target.value })}
          placeholder="500mg"
          className="h-9 text-sm"
          aria-label={`Dosage ${index + 1}`}
        />
      </div>
      <div className="sm:col-span-3">
        <Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:sr-only">
          Frequency
        </Label>
        <Input
          value={row.frequency}
          onChange={(e) => onChange({ frequency: e.target.value })}
          placeholder="TID / twice daily"
          className="h-9 text-sm"
          aria-label={`Frequency ${index + 1}`}
        />
      </div>
      <div className="flex items-end gap-1 sm:col-span-3">
        <div className="flex-1">
          <Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:sr-only">
            Duration
          </Label>
          <Input
            value={row.duration}
            onChange={(e) => onChange({ duration: e.target.value })}
            placeholder="5 days"
            className="h-9 text-sm"
            aria-label={`Duration ${index + 1}`}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={!canRemove}
          className="h-9 w-9 shrink-0 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
          aria-label={`Remove prescription ${index + 1}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function PrescriptionTable({
  prescription,
  onChange,
}: {
  prescription: Prescription[]
  onChange: (next: Prescription[]) => void
}) {
  const updateRow = (i: number, patch: Partial<Prescription>) =>
    onChange(prescription.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  const removeRow = (i: number) => onChange(prescription.filter((_, idx) => idx !== i))
  const addRow = () =>
    onChange([
      ...prescription,
      { medicine: "", dosage: "", frequency: "", duration: "" },
    ])

  return (
    <div className="space-y-2.5">
      {/* Header (desktop only) */}
      <div className="hidden grid-cols-12 gap-2 px-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
        <div className="col-span-4">Medicine</div>
        <div className="col-span-2">Dosage</div>
        <div className="col-span-3">Frequency</div>
        <div className="col-span-3">Duration</div>
      </div>

      {prescription.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 text-center">
          <Pill className="h-6 w-6 text-muted-foreground/60" />
          <p className="mt-2 text-sm text-muted-foreground">
            No medications yet
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            className="mt-3 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Add medication
          </Button>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {prescription.map((row, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <PrescriptionRow
                row={row}
                index={i}
                onChange={(patch) => updateRow(i, patch)}
                onRemove={() => removeRow(i)}
                canRemove={prescription.length > 1}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      {prescription.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Add another medication
        </Button>
      )}
    </div>
  )
}

function RedFlagsEditor({
  flags,
  onChange,
}: {
  flags: string[]
  onChange: (next: string[]) => void
}) {
  const [input, setInput] = useState("")

  const addFlag = () => {
    const v = input.trim()
    if (!v) return
    if (flags.some((f) => f.toLowerCase() === v.toLowerCase())) {
      toast.info("Already added")
      setInput("")
      return
    }
    onChange([...flags, v])
    setInput("")
  }

  return (
    <div className="space-y-2">
      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {flags.map((f, i) => (
            <motion.span
              key={`${f}-${i}`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 py-1 pl-2.5 pr-1 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
            >
              <ShieldAlert className="h-3 w-3" />
              {f}
              <button
                type="button"
                onClick={() => onChange(flags.filter((_, idx) => idx !== i))}
                className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/20"
                aria-label={`Remove ${f}`}
              >
                <X className="h-3 w-3" />
              </button>
            </motion.span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addFlag()
            }
          }}
          placeholder="e.g. High fever, breathing difficulty…"
          className="h-9 text-sm"
          aria-label="Add a red flag"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addFlag}
          className="shrink-0 gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </div>
  )
}

function ReviewWarning() {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          Review before saving
        </p>
        <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300/90">
          AI-generated drafts may contain errors. Verify every field — especially
          drug, dose, and frequency — before saving this as a medical record.
        </p>
      </div>
    </div>
  )
}

function DraftEditor({
  draft,
  onChange,
  onSave,
  onDiscard,
  onRegenerate,
  isSaving,
}: {
  draft: RecordDraft
  onChange: (patch: Partial<RecordDraft>) => void
  onSave: () => void
  onDiscard: () => void
  onRegenerate: () => void
  isSaving: boolean
}) {
  return (
    <Card className="overflow-hidden border-emerald-200/60 dark:border-emerald-500/20">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-fuchsia-500" />
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">AI-Generated Draft</CardTitle>
              <CardDescription className="mt-0.5 text-xs">
                Edit any field before saving.
              </CardDescription>
            </div>
          </div>
          <VisitTypeBadge type={draft.visitType} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <ReviewWarning />

        {/* Visit type selector */}
        <div>
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Visit type
          </Label>
          <VisitTypeSelector
            value={draft.visitType}
            onChange={(v) => onChange({ visitType: v })}
          />
        </div>

        {/* Diagnosis */}
        <div>
          <Label
            htmlFor="draft-diagnosis"
            className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            <Stethoscope className="h-3.5 w-3.5" /> Diagnosis
          </Label>
          <Input
            id="draft-diagnosis"
            value={draft.diagnosis}
            onChange={(e) => onChange({ diagnosis: e.target.value })}
            placeholder="Primary diagnosis"
            className="text-sm"
          />
        </div>

        {/* Doctor's notes */}
        <div>
          <Label
            htmlFor="draft-notes"
            className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            <ClipboardList className="h-3.5 w-3.5" /> Doctor&apos;s notes
          </Label>
          <Textarea
            id="draft-notes"
            value={draft.doctorsNotes}
            onChange={(e) => onChange({ doctorsNotes: e.target.value })}
            placeholder="Clinical observations, vitals, differentials…"
            className="min-h-[100px] text-sm"
          />
        </div>

        {/* Prescription */}
        <div>
          <Label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Pill className="h-3.5 w-3.5" /> Prescription
          </Label>
          <PrescriptionTable
            prescription={draft.prescription}
            onChange={(next) => onChange({ prescription: next })}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Follow up */}
          <div>
            <Label
              htmlFor="draft-followup"
              className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              <CalendarClock className="h-3.5 w-3.5" /> Follow-up (days)
            </Label>
            <Input
              id="draft-followup"
              type="number"
              min={0}
              value={draft.followUpInDays ?? ""}
              onChange={(e) => {
                const v = e.target.value
                onChange({
                  followUpInDays: v === "" ? null : Math.max(0, parseInt(v, 10) || 0),
                })
              }}
              placeholder="e.g. 7"
              className="text-sm"
            />
          </div>

          {/* Red flags */}
          <div>
            <Label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" /> Red flags
            </Label>
            <RedFlagsEditor
              flags={draft.redFlags}
              onChange={(next) => onChange({ redFlags: next })}
            />
          </div>
        </div>

        <Separator />

        {/* Action buttons */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md hover:from-emerald-700 hover:to-teal-700"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save as Medical Record
          </Button>
          <Button
            onClick={onRegenerate}
            variant="ghost"
            className="gap-1.5 text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Regenerate
          </Button>
          <Button
            onClick={onDiscard}
            variant="ghost"
            className="gap-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Discard draft
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============== Main component ==============

export function NlpRecordBuilder({
  onSaveRecord,
  initialFreeText,
}: NlpRecordBuilderProps) {
  const [freeText, setFreeText] = useState(initialFreeText || "")
  const [patientName, setPatientName] = useState("")
  const [visitDate, setVisitDate] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [draft, setDraft] = useState<RecordDraft | null>(null)
  const [rawOutput, setRawOutput] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  // If parent updates initialFreeText (e.g. user converts voice memo), sync it.
  useEffect(() => {
    if (initialFreeText !== undefined && initialFreeText !== null) {
      setFreeText(initialFreeText)
      // Reset previous draft so the user re-generates
      setDraft(null)
      setRawOutput(null)
      setParseError(null)
    }
  }, [initialFreeText])

  const charCount = freeText.length
  const canGenerate = freeText.trim().length >= 5 && !isLoading

  const handleGenerate = useCallback(async () => {
    if (freeText.trim().length < 5) {
      toast.error("Please enter at least a few words")
      return
    }
    setIsLoading(true)
    setDraft(null)
    setRawOutput(null)
    setParseError(null)

    const context = [
      patientName ? `Patient: ${patientName}` : null,
      visitDate ? `Visit date: ${visitDate}` : null,
    ]
      .filter(Boolean)
      .join(" · ")

    try {
      const res = await apiFetch<NlpResponse>("/api/ai/nlp-record", {
        method: "POST",
        body: JSON.stringify({ freeText, context: context || undefined }),
      })

      if (res?.ok && res.draft) {
        setDraft(coerceDraft(res.draft))
        toast.success("AI structured your note into a draft")
      } else {
        setRawOutput(res?.raw || "")
        setParseError(
          res?.error || "Could not parse structured record — please refine your note."
        )
        toast.error("Couldn't parse your note", {
          description: "Try rephrasing or adding more detail.",
        })
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? (err.body as { error?: string })?.error || err.message
          : (err as Error).message
      setParseError(msg || "Failed to generate structured record")
      toast.error("AI request failed", { description: msg })
    } finally {
      setIsLoading(false)
    }
  }, [freeText, patientName, visitDate])

  const handleClear = useCallback(() => {
    setFreeText("")
    setDraft(null)
    setRawOutput(null)
    setParseError(null)
    toast.info("Input cleared")
  }, [])

  const handleDraftChange = useCallback((patch: Partial<RecordDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  const handleSave = useCallback(async () => {
    if (!draft) return
    setIsSaving(true)
    try {
      // Simulate brief save latency for UX feedback
      await new Promise((r) => setTimeout(r, 400))
      if (onSaveRecord) {
        onSaveRecord(draft)
      } else {
        toast.success("Draft saved", {
          description: "Connect onSaveRecord to persist this medical record.",
        })
      }
    } finally {
      setIsSaving(false)
    }
  }, [draft, onSaveRecord])

  const handleDiscard = useCallback(() => {
    setDraft(null)
    setRawOutput(null)
    setParseError(null)
    toast.info("Draft discarded")
  }, [])

  const handleRegenerate = useCallback(() => {
    void handleGenerate()
  }, [handleGenerate])

  const examplePrompt = useMemo(
    () => EXAMPLE_PROMPTS[0],
    []
  )

  return (
    <div className="space-y-6">
      <HeroBanner
        title="AI Medical Record Builder"
        subtitle="Describe the patient visit in your own words. AI will structure it into a medical record you can review and save."
        icon={Wand2}
      />

      {/* Input card */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Describe the visit</CardTitle>
              <CardDescription className="mt-0.5 text-xs">
                Write naturally — the AI will extract diagnosis, prescription, and follow-up.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Context inputs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label
                htmlFor="ctx-patient"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Patient name (optional)
              </Label>
              <Input
                id="ctx-patient"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="e.g. Ramesh Patel"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label
                htmlFor="ctx-date"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Visit date (optional)
              </Label>
              <Input
                id="ctx-date"
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Free-text textarea */}
          <div className="relative">
            <Textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder={PLACEHOLDER_EXAMPLE}
              className="min-h-[160px] resize-y text-sm leading-relaxed"
              aria-label="Free-text clinical note"
            />
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{charCount} characters</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={!freeText && !draft}
                className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </Button>
            </div>
          </div>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md hover:from-emerald-700 hover:to-teal-700 sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> AI is structuring your note…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate Structured Record
              </>
            )}
          </Button>

          {/* Example prompts */}
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5" /> Try an example
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((p) => (
                <button
                  key={p.title}
                  type="button"
                  onClick={() => {
                    setFreeText(p.text)
                    setDraft(null)
                    setRawOutput(null)
                    setParseError(null)
                  }}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/50 px-3 py-1 text-xs font-medium text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                >
                  <p.icon className="h-3 w-3" />
                  {p.title}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card className="overflow-hidden border-emerald-200/60 dark:border-emerald-500/20">
              <CardContent className="flex flex-col items-center justify-center gap-4 p-8">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10"
                >
                  <Sparkles className="h-6 w-6 text-emerald-600" />
                </motion.div>
                <div className="text-center">
                  <p className="text-sm font-semibold">AI is structuring your note…</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Extracting diagnosis, prescription, follow-up, and red flags.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error / raw output state */}
      <AnimatePresence>
        {parseError && !draft && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card className="border-amber-200 dark:border-amber-500/30">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      Couldn&apos;t parse a structured record
                    </p>
                    <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300/90">
                      {parseError}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Try rephrasing your note — include diagnosis, prescriptions,
                      and follow-up explicitly.
                    </p>
                  </div>
                </div>

                {rawOutput && (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Raw AI output
                    </p>
                    <pre className="max-h-48 overflow-auto rounded-lg border bg-muted/30 p-3 text-[11px] leading-relaxed text-foreground/80">
                      {rawOutput.slice(0, 1500)}
                    </pre>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                  className="gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Try again
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Draft editor */}
      <AnimatePresence>
        {draft && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <DraftEditor
              draft={draft}
              onChange={handleDraftChange}
              onSave={handleSave}
              onDiscard={handleDiscard}
              onRegenerate={handleRegenerate}
              isSaving={isSaving}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty hint when no draft and not loading */}
      {!draft && !isLoading && !parseError && (
        <SectionHeader
          title="Tips for best results"
          description="The more structured your note, the better the AI can parse it."
          icon={Lightbulb}
        />
      )}
      {!draft && !isLoading && !parseError && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                <Stethoscope className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Mention the diagnosis</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  &quot;Diagnosed viral fever&quot; is clearer than &quot;has fever&quot;.
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-500/10">
                <Pill className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">List drugs with doses</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  &quot;paracetamol 500mg TID x5 days&quot; parses perfectly.
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/10">
                <CalendarClock className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Add follow-up &amp; warnings</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  &quot;Follow up in 3 days if fever persists&quot; gives context.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Suppress unused warning for examplePrompt (kept for future placeholder preview) */}
      <span className="sr-only">{examplePrompt.title}</span>

      {/* Empty state fallback when absolutely nothing happened yet */}
      {!draft && !isLoading && !parseError && freeText.length === 0 && (
        <EmptyState
          icon={Wand2}
          title="No draft yet"
          description="Write your visit summary above and tap Generate Structured Record to let AI build a draft."
        />
      )}
    </div>
  )
}

export default NlpRecordBuilder
