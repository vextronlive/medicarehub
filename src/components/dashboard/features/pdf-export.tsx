"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { format } from "date-fns"
import {
  FileText,
  Download,
  Pill,
  Calendar,
  FileSpreadsheet,
  Loader2,
  Printer,
  Shield,
  Stethoscope,
  ExternalLink,
} from "lucide-react"
import { toast } from "sonner"

import { useAuthStore } from "@/lib/auth-store"
import { apiFetch } from "@/lib/api"
import { doctorName, cn } from "@/lib/utils"
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
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ─────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────
interface Patient {
  id: string
  name: string
  mobile: string
  bloodGroup?: string | null
}

interface MedicalRecord {
  id: string
  visitType: string
  clinicName: string
  practitionerName: string
  specialization: string
  diagnosis: string
  doctorsNotes: string
  prescription: string
  attachments: string
  visitDate: string
  patient: Patient
  doctor: { id: string; name: string; specialization?: string | null }
  org?: { id: string; name: string; city?: string | null } | null
}

type ExportType = "PRESCRIPTION" | "PATIENT" | "ALL"

interface RecentExport {
  id: string
  type: ExportType
  target: string
  timestamp: number
  // state needed to regenerate
  recordId?: string
  patientId?: string
}

// ─────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function fmtDate(iso: string): string {
  try {
    return format(new Date(iso), "EEE, MMM d, yyyy")
  } catch {
    return iso
  }
}

function parsePrescription(
  p: string
): Array<Record<string, string>> | null {
  if (!p) return null
  try {
    const parsed = JSON.parse(p)
    if (Array.isArray(parsed)) return parsed as Array<Record<string, string>>
    return null
  } catch {
    return null
  }
}

function parseAttachments(a: string): string[] {
  if (!a) return []
  try {
    const parsed = JSON.parse(a)
    if (Array.isArray(parsed)) {
      return parsed
        .map((x) => {
          if (typeof x === "string") return x
          if (x && typeof x === "object") {
            return (x as { name?: string }).name || JSON.stringify(x)
          }
          return String(x)
        })
        .filter(Boolean)
    }
    return []
  } catch {
    return []
  }
}

function visitTypeLabel(v: string): string {
  return (v || "").replace(/_/g, " ")
}

function generatedByName(
  role: "DOCTOR" | "ORGANIZATION",
  user: { name?: string } | null
): string {
  if (!user?.name) return role === "DOCTOR" ? "Doctor" : "Healthcare Organization"
  return role === "DOCTOR" ? doctorName(user.name) : user.name
}

const EMERALD = "#059669"
const EMERALD_DARK = "#047857"
const EMERALD_DEEP = "#065f46"

// Shared CSS for all PDF documents
function pdfStyles(): string {
  return `
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; margin: 0; padding: 40px; line-height: 1.55; }
  .doc-head { text-align: center; border-bottom: 3px solid ${EMERALD}; padding-bottom: 16px; margin-bottom: 28px; }
  .doc-head h1 { font-size: 22px; margin: 0 0 4px; color: ${EMERALD_DARK}; }
  .doc-head .sub { font-size: 13px; color: #555; }
  .doc-head .meta-row { font-size: 12px; color: #777; margin-top: 6px; }
  .badge-enc { display: inline-block; background: #d1fae5; color: ${EMERALD_DEEP}; font-size: 10px; padding: 2px 8px; border-radius: 8px; margin-left: 6px; font-family: Arial, sans-serif; }
  .patient-block { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 18px; margin-bottom: 22px; font-size: 13px; }
  .patient-block .row { display: flex; gap: 24px; flex-wrap: wrap; }
  .patient-block .row > div { flex: 1 1 200px; }
  .patient-block b { color: #374151; }
  .record { border: 1px solid #d1d5db; border-radius: 8px; padding: 18px 20px; margin-bottom: 18px; }
  .page-break { page-break-before: always; }
  .rec-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px; }
  .rec-date { font-size: 15px; font-weight: bold; color: ${EMERALD_DEEP}; }
  .rec-type { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; background: #d1fae5; color: ${EMERALD_DEEP}; padding: 3px 10px; border-radius: 12px; font-family: Arial, sans-serif; }
  .meta { width: 100%; font-size: 13px; margin-bottom: 8px; }
  .meta td { padding: 2px 0; vertical-align: top; }
  .meta td:first-child { width: 130px; color: #555; }
  .section-label { font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin: 12px 0 3px; }
  .section-body { font-size: 13px; margin: 0 0 4px; white-space: pre-wrap; }
  table.rx { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 4px; }
  table.rx th, table.rx td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
  table.rx th { background: ${EMERALD_DARK}; color: #fff; font-weight: 600; font-family: Arial, sans-serif; }
  table.rx tbody tr:nth-child(even) td { background: #f9fafb; }
  .rx-text { font-size: 13px; white-space: pre-wrap; padding: 10px; background: #f9fafb; border-radius: 6px; border: 1px dashed #d1d5db; }
  .atts { font-size: 12px; color: #555; margin-top: 8px; }
  .rx-symbol { font-size: 26px; color: ${EMERALD_DARK}; font-weight: bold; margin: 4px 0 8px; }
  .signature { margin-top: 50px; padding-top: 18px; }
  .signature .line { border-top: 1px solid #374151; width: 220px; margin-bottom: 4px; }
  .signature .name { font-weight: bold; font-size: 14px; }
  .signature .role { font-size: 12px; color: #555; }
  .doc-foot { margin-top: 30px; padding-top: 14px; border-top: 1px solid #d1d5db; text-align: center; font-size: 11px; color: #9ca3af; }
  .group-head { background: ${EMERALD_DARK}; color: #fff; padding: 10px 16px; border-radius: 8px; margin: 22px 0 14px; font-size: 14px; font-family: Arial, sans-serif; }
  .group-head .gname { font-weight: bold; }
  .group-head .gmeta { font-size: 11px; opacity: 0.9; margin-top: 2px; }
  @media print { body { padding: 20px; } .page-break { page-break-before: always; } }
  `
}

// ─────────────────────────────────────────────────────────
//  PDF generators
// ─────────────────────────────────────────────────────────
function openPdfWindow(title: string): Window | null {
  const win = window.open("", "_blank", "width=820,height=900")
  if (!win) {
    toast.error("Pop-up blocked. Please allow pop-ups to export PDFs.")
    return null
  }
  return win
}

function writeDocFooter(win: Window): string {
  const stamp = format(new Date(), "EEEE, MMMM d, yyyy 'at' h:mm a")
  return `
  <div class="doc-foot">
    This document is confidential and was generated by MediCare Hub.<br/>
    Medical records are encrypted at rest using AES-256-CBC. Unauthorized access is prohibited.<br/>
    Generated on ${escapeHtml(stamp)}
  </div>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 300); };
  </script>`
}

function buildPatientBlock(
  patient: Patient,
  generatedBy: string
): string {
  return `
  <div class="patient-block">
    <div class="row">
      <div><b>Patient:</b> ${escapeHtml(patient.name || "—")}</div>
      <div><b>Blood Group:</b> ${escapeHtml(patient.bloodGroup || "—")}</div>
      <div><b>Mobile:</b> ${escapeHtml(patient.mobile || "—")}</div>
    </div>
    <div class="row" style="margin-top:6px;">
      <div><b>Generated by:</b> ${escapeHtml(generatedBy)}</div>
    </div>
  </div>`
}

function buildMedsTableOrText(prescription: string): string {
  const meds = parsePrescription(prescription)
  if (meds) {
    if (meds.length === 0) {
      return `<p class="rx-text">No medications recorded.</p>`
    }
    return `<table class="rx"><thead><tr><th>Medication</th><th>Dose</th><th>Frequency</th><th>Duration</th></tr></thead><tbody>${meds
      .map(
        (m) =>
          `<tr><td>${escapeHtml(m.medicine || m.name || "—")}</td><td>${escapeHtml(m.dose || m.dosage || "—")}</td><td>${escapeHtml(m.frequency || "—")}</td><td>${escapeHtml(m.duration || "—")}</td></tr>`
      )
      .join("")}</tbody></table>`
  }
  // plain text prescription
  return `<p class="rx-text">${escapeHtml(prescription || "No prescription recorded.")}</p>`
}

function buildRecordHtml(
  r: MedicalRecord,
  idx: number,
  options: { withPatient?: boolean; withSignature?: boolean; generatedBy?: string }
): string {
  const atts = parseAttachments(r.attachments)
  const attsHtml =
    atts.length > 0
      ? `<p class="atts"><b>Attachments:</b> ${atts.map((a) => escapeHtml(a)).join(", ")}</p>`
      : ""
  const signatureHtml =
    options.withSignature && options.generatedBy
      ? `<div class="signature">
          <div class="line"></div>
          <div class="name">${escapeHtml(options.generatedBy)}</div>
          <div class="role">${escapeHtml(r.specialization || r.clinicName || "")}</div>
        </div>`
      : ""
  const patientRow = options.withPatient
    ? `<tr><td><b>Patient:</b></td><td>${escapeHtml(r.patient.name)} (${escapeHtml(r.patient.bloodGroup || "—")}, ${escapeHtml(r.patient.mobile || "—")})</td></tr>`
    : ""
  return `
  <div class="record ${idx > 0 ? "page-break" : ""}">
    <div class="rec-head">
      <span class="rec-date">${escapeHtml(fmtDate(r.visitDate))}</span>
      <span class="rec-type">${escapeHtml(visitTypeLabel(r.visitType))}</span>
    </div>
    <table class="meta">
      ${patientRow}
      <tr><td><b>Doctor:</b></td><td>${escapeHtml(doctorName(r.doctor?.name || r.practitionerName || "—"))}</td></tr>
      <tr><td><b>Specialization:</b></td><td>${escapeHtml(r.specialization || "—")}</td></tr>
      <tr><td><b>Clinic:</b></td><td>${escapeHtml(r.clinicName || "—")}</td></tr>
    </table>
    <p class="section-label">Diagnosis</p>
    <p class="section-body">${escapeHtml(r.diagnosis || "—")}</p>
    <p class="section-label">Doctor's Notes</p>
    <p class="section-body">${escapeHtml(r.doctorsNotes || "—")}</p>
    <p class="section-label">Prescription</p>
    ${buildMedsTableOrText(r.prescription)}
    ${attsHtml}
    ${signatureHtml}
  </div>`
}

function exportPrescriptionPDF(
  record: MedicalRecord,
  generatedBy: string
): void {
  const win = openPdfWindow(`Prescription — ${record.patient.name}`)
  if (!win) return
  const medsHtml = buildMedsTableOrText(record.prescription)
  const atts = parseAttachments(record.attachments)
  const attsHtml =
    atts.length > 0
      ? `<p class="atts"><b>Attachments:</b> ${atts.map((a) => escapeHtml(a)).join(", ")}</p>`
      : ""
  win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Prescription — ${escapeHtml(record.patient.name)} — ${escapeHtml(fmtDate(record.visitDate))}</title>
<style>${pdfStyles()}</style>
</head>
<body>
  <div class="doc-head">
    <h1>MediCare Hub — Prescription</h1>
    <div class="sub">Rx · Single Record Export</div>
    <div class="meta-row">${escapeHtml(format(new Date(), "EEEE, MMMM d, yyyy 'at' h:mm a"))} <span class="badge-enc">AES-256 Encrypted</span></div>
  </div>
  <div class="rx-symbol">℞</div>
  ${buildPatientBlock(record.patient, generatedBy)}
  <div class="record">
    <div class="rec-head">
      <span class="rec-date">${escapeHtml(fmtDate(record.visitDate))}</span>
      <span class="rec-type">${escapeHtml(visitTypeLabel(record.visitType))}</span>
    </div>
    <table class="meta">
      <tr><td><b>Doctor:</b></td><td>${escapeHtml(doctorName(record.doctor?.name || record.practitionerName || "—"))}</td></tr>
      <tr><td><b>Specialization:</b></td><td>${escapeHtml(record.specialization || "—")}</td></tr>
      <tr><td><b>Clinic:</b></td><td>${escapeHtml(record.clinicName || "—")}</td></tr>
    </table>
    <p class="section-label">Diagnosis</p>
    <p class="section-body">${escapeHtml(record.diagnosis || "—")}</p>
    <p class="section-label">Prescription</p>
    ${medsHtml}
    ${attsHtml}
    <div class="signature">
      <div class="line"></div>
      <div class="name">${escapeHtml(generatedBy)}</div>
      <div class="role">${escapeHtml(record.specialization || record.clinicName || "")}</div>
    </div>
  </div>
  ${writeDocFooter(win)}
</body>
</html>`)
  win.document.close()
}

function exportPatientRecordsPDF(
  records: MedicalRecord[],
  patient: Patient,
  generatedBy: string
): void {
  const win = openPdfWindow(`Patient Records — ${patient.name}`)
  if (!win) return
  const sorted = [...records].sort(
    (a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
  )
  const recordsHtml =
    sorted.length === 0
      ? `<p style="text-align:center;color:#999;padding:40px;">No medical records to export.</p>`
      : sorted
          .map((r, idx) =>
            buildRecordHtml(r, idx, { withPatient: false, generatedBy })
          )
          .join("")
  win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Patient Records — ${escapeHtml(patient.name)}</title>
<style>${pdfStyles()}</style>
</head>
<body>
  <div class="doc-head">
    <h1>MediCare Hub — Patient Records</h1>
    <div class="sub">Patient: <b>${escapeHtml(patient.name)}</b> · Timeline</div>
    <div class="meta-row">${escapeHtml(format(new Date(), "EEEE, MMMM d, yyyy 'at' h:mm a"))} · ${sorted.length} record${sorted.length !== 1 ? "s" : ""} <span class="badge-enc">AES-256 Encrypted</span></div>
  </div>
  ${buildPatientBlock(patient, generatedBy)}
  ${recordsHtml}
  ${writeDocFooter(win)}
</body>
</html>`)
  win.document.close()
}

function groupRecordsByPatient(
  records: MedicalRecord[]
): Array<{ patient: Patient; records: MedicalRecord[] }> {
  const m = new Map<string, { patient: Patient; records: MedicalRecord[] }>()
  for (const r of records) {
    const key = r.patient?.id || "unknown"
    if (!m.has(key)) m.set(key, { patient: r.patient, records: [] })
    m.get(key)!.records.push(r)
  }
  return Array.from(m.values()).sort((a, b) =>
    a.patient.name.localeCompare(b.patient.name)
  )
}

function exportAllRecordsPDF(
  records: MedicalRecord[],
  generatedBy: string
): void {
  const win = openPdfWindow("All Records Export")
  if (!win) return

  // Group records by patient id
  const groups = groupRecordsByPatient(records)

  const total = records.length
  const groupsHtml =
    groups.length === 0
      ? `<p style="text-align:center;color:#999;padding:40px;">No medical records to export.</p>`
      : groups
          .map((g, gi) => {
            const sorted = [...g.records].sort(
              (a, b) =>
                new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
            )
            const recsHtml = sorted
              .map((r, idx) =>
                buildRecordHtml(r, idx, { withPatient: false, generatedBy })
              )
              .join("")
            return `
            <div class="${gi > 0 ? "page-break" : ""}">
              <div class="group-head">
                <div class="gname">${escapeHtml(g.patient.name)}</div>
                <div class="gmeta">${escapeHtml(g.patient.bloodGroup || "—")} · ${escapeHtml(g.patient.mobile || "—")} · ${sorted.length} record${sorted.length !== 1 ? "s" : ""}</div>
              </div>
              ${recsHtml}
            </div>`
          })
          .join("")

  win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>All Records Export — MediCare Hub</title>
<style>${pdfStyles()}</style>
</head>
<body>
  <div class="doc-head">
    <h1>MediCare Hub — Full Records Export</h1>
    <div class="sub">Generated by: <b>${escapeHtml(generatedBy)}</b></div>
    <div class="meta-row">${escapeHtml(format(new Date(), "EEEE, MMMM d, yyyy 'at' h:mm a"))} · ${total} record${total !== 1 ? "s" : ""} across ${groups.length} patient${groups.length !== 1 ? "s" : ""} <span class="badge-enc">AES-256 Encrypted</span></div>
  </div>
  ${groupsHtml}
  ${writeDocFooter(win)}
</body>
</html>`)
  win.document.close()
}

// ─────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────
export function PdfExport({
  role,
}: {
  role: "DOCTOR" | "ORGANIZATION"
}) {
  const user = useAuthStore((s) => s.user)

  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Patient selection
  const [patientId, setPatientId] = useState<string>("")
  const [recordId, setRecordId] = useState<string>("")

  // Per-export busy state
  const [busy, setBusy] = useState<ExportType | null>(null)
  // Recent exports (in-memory, last 5)
  const [recent, setRecent] = useState<RecentExport[]>([])

  const fetchRecords = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<{ records: MedicalRecord[] }>(
        `/api/records?userId=${encodeURIComponent(user.id)}&role=${encodeURIComponent(role)}`
      )
      setRecords(data.records || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load records")
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [user, role])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  // Deduplicated patient list (sorted by name)
  const patients = useMemo(() => {
    const map = new Map<string, Patient>()
    for (const r of records) {
      if (r.patient?.id && !map.has(r.patient.id)) {
        map.set(r.patient.id, r.patient)
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }, [records])

  // Records for the selected patient
  const selectedPatientRecords = useMemo(() => {
    if (!patientId) return []
    return records
      .filter((r) => r.patient?.id === patientId)
      .sort(
        (a, b) =>
          new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
      )
  }, [records, patientId])

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === patientId) || null,
    [patients, patientId]
  )

  const selectedRecord = useMemo(
    () =>
      selectedPatientRecords.find((r) => r.id === recordId) || null,
    [selectedPatientRecords, recordId]
  )

  // Reset record selection when patient changes
  useEffect(() => {
    setRecordId("")
  }, [patientId])

  const generatedBy = generatedByName(role, user)

  // ── Export handlers ───────────────────────────────────
  const pushRecent = (entry: RecentExport) => {
    setRecent((prev) => [entry, ...prev].slice(0, 5))
  }

  const handlePrescriptionExport = async () => {
    if (!selectedRecord) {
      toast.error("Select a patient and a medical record first.")
      return
    }
    setBusy("PRESCRIPTION")
    try {
      await new Promise((r) => setTimeout(r, 150)) // let UI paint the spinner
      exportPrescriptionPDF(selectedRecord, generatedBy)
      pushRecent({
        id: crypto.randomUUID(),
        type: "PRESCRIPTION",
        target: `${selectedRecord.patient.name} — ${fmtDate(selectedRecord.visitDate)} (${visitTypeLabel(selectedRecord.visitType)})`,
        timestamp: Date.now(),
        recordId: selectedRecord.id,
      })
      toast.success("Prescription PDF opened in a new tab.")
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to generate prescription PDF."
      )
    } finally {
      setBusy(null)
    }
  }

  const handlePatientExport = async () => {
    if (!selectedPatient) {
      toast.error("Select a patient first.")
      return
    }
    setBusy("PATIENT")
    try {
      await new Promise((r) => setTimeout(r, 150))
      exportPatientRecordsPDF(
        selectedPatientRecords,
        selectedPatient,
        generatedBy
      )
      pushRecent({
        id: crypto.randomUUID(),
        type: "PATIENT",
        target: `${selectedPatient.name} (${selectedPatientRecords.length} record${
          selectedPatientRecords.length !== 1 ? "s" : ""
        })`,
        timestamp: Date.now(),
        patientId: selectedPatient.id,
      })
      toast.success("Patient records PDF opened in a new tab.")
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to generate patient PDF."
      )
    } finally {
      setBusy(null)
    }
  }

  const handleAllExport = async () => {
    if (records.length === 0) {
      toast.error("No records available to export.")
      return
    }
    setBusy("ALL")
    try {
      await new Promise((r) => setTimeout(r, 150))
      exportAllRecordsPDF(records, generatedBy)
      pushRecent({
        id: crypto.randomUUID(),
        type: "ALL",
        target: `All Patients (${records.length} record${
          records.length !== 1 ? "s" : ""
        })`,
        timestamp: Date.now(),
      })
      toast.success("Full records PDF opened in a new tab.")
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to generate full PDF."
      )
    } finally {
      setBusy(null)
    }
  }

  // Re-open a recent export
  const handleReopen = (entry: RecentExport) => {
    try {
      if (entry.type === "PRESCRIPTION" && entry.recordId) {
        const r = records.find((x) => x.id === entry.recordId)
        if (r) {
          exportPrescriptionPDF(r, generatedBy)
          toast.success("Prescription PDF re-opened.")
          return
        }
      } else if (entry.type === "PATIENT" && entry.patientId) {
        const p = patients.find((x) => x.id === entry.patientId)
        if (p) {
          const recs = records.filter((x) => x.patient?.id === p.id)
          exportPatientRecordsPDF(recs, p, generatedBy)
          toast.success("Patient records PDF re-opened.")
          return
        }
      } else if (entry.type === "ALL") {
        exportAllRecordsPDF(records, generatedBy)
        toast.success("Full records PDF re-opened.")
        return
      }
      toast.error("This export is no longer available — the underlying record may have been removed.")
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to re-open PDF."
      )
    }
  }

  // ── Render guards ─────────────────────────────────────
  if (!user) return null

  if (loading) {
    return (
      <div className="space-y-6">
        <HeroBanner
          title="Export Center"
          subtitle="Generate print-ready PDFs of medical records, prescriptions, and patient summaries."
          icon={FileText}
        />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-32 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <HeroBanner
          title="Export Center"
          subtitle="Generate print-ready PDFs of medical records, prescriptions, and patient summaries."
          icon={FileText}
        />
        <EmptyState
          icon={FileText}
          title="Could not load records"
          description={error}
          action={
            <Button onClick={fetchRecords} variant="outline">
              Retry
            </Button>
          }
        />
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="space-y-6">
        <HeroBanner
          title="Export Center"
          subtitle="Generate print-ready PDFs of medical records, prescriptions, and patient summaries."
          icon={FileText}
        />
        <EmptyState
          icon={FileText}
          title="No medical records yet"
          description="No medical records yet — create a record first to enable PDF export."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <HeroBanner
          title="Export Center"
          subtitle="Generate print-ready PDFs of medical records, prescriptions, and patient summaries."
          icon={FileText}
        />
      </motion.div>

      {/* Export type cards */}
      <div className="grid gap-5 md:grid-cols-3">
        {/* 1. Prescription PDF */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <Card className="h-full overflow-hidden">
            <CardHeader className="p-5 pb-3">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/20">
                <Pill className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Prescription PDF</CardTitle>
              <CardDescription className="text-xs">
                Single record · print-ready Rx with medication table
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Patient
                </Label>
                <Select value={patientId} onValueChange={setPatientId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.bloodGroup ? ` · ${p.bloodGroup}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Medical record
                </Label>
                <Select
                  value={recordId}
                  onValueChange={setRecordId}
                  disabled={!patientId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        patientId
                          ? "Select a record"
                          : "Select a patient first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedPatientRecords.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No records for this patient
                      </SelectItem>
                    ) : (
                      selectedPatientRecords.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {fmtDate(r.visitDate)} · {visitTypeLabel(r.visitType)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={!selectedRecord || busy !== null}
                onClick={handlePrescriptionExport}
              >
                {busy === "PRESCRIPTION" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Printer className="mr-2 h-4 w-4" />
                    Export Prescription
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* 2. Patient Records PDF */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="h-full overflow-hidden">
            <CardHeader className="p-5 pb-3">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/20">
                <Calendar className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Patient Records PDF</CardTitle>
              <CardDescription className="text-xs">
                Per-patient · all records in a timeline format
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Patient
                </Label>
                <Select value={patientId} onValueChange={setPatientId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.bloodGroup ? ` · ${p.bloodGroup}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedPatient && (
                <div className="rounded-lg bg-emerald-50/60 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  {selectedPatientRecords.length} record
                  {selectedPatientRecords.length !== 1 ? "s" : ""} will be
                  included for{" "}
                  <span className="font-semibold">{selectedPatient.name}</span>.
                </div>
              )}
              <Button
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={!selectedPatient || busy !== null}
                onClick={handlePatientExport}
              >
                {busy === "PATIENT" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Printer className="mr-2 h-4 w-4" />
                    Export Patient Records
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* 3. All Records PDF */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <Card className="h-full overflow-hidden">
            <CardHeader className="p-5 pb-3">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/20">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">All Records PDF</CardTitle>
              <CardDescription className="text-xs">
                Full export · every record you created, grouped by patient
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-2">
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-3 text-xs dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total records</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                    {records.length}
                  </span>
                </div>
                <Separator className="my-2" />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Patients</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                    {patients.length}
                  </span>
                </div>
              </div>
              <Button
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={records.length === 0 || busy !== null}
                onClick={handleAllExport}
              >
                {busy === "ALL" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export All Records
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent exports */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Card>
          <CardHeader className="p-5 pb-3">
            <SectionHeader
              title="Recent Exports"
              description="Your last 5 export actions — click Open PDF to re-generate."
              icon={Stethoscope}
            />
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-8 text-center">
                <FileText className="mb-2 h-8 w-8 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">
                  No exports yet. Generate a PDF above to see it here.
                </p>
              </div>
            ) : (
              <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {recent.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-sm transition-colors hover:bg-accent/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                          entry.type === "PRESCRIPTION"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                            : entry.type === "PATIENT"
                              ? "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300"
                              : "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300"
                        )}
                      >
                        {entry.type === "PRESCRIPTION" ? (
                          <Pill className="h-4 w-4" />
                        ) : entry.type === "PATIENT" ? (
                          <Calendar className="h-4 w-4" />
                        ) : (
                          <FileSpreadsheet className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {entry.target}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(entry.timestamp), "MMM d, yyyy · h:mm a")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="hidden border-emerald-200 bg-emerald-50 text-emerald-700 sm:inline-flex dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                      >
                        <Shield className="mr-1 h-3 w-3" />
                        {entry.type === "PRESCRIPTION"
                          ? "Prescription"
                          : entry.type === "PATIENT"
                            ? "Patient"
                            : "Full Export"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                        onClick={() => handleReopen(entry)}
                      >
                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                        Open PDF
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

export default PdfExport
