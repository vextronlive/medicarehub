import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { encrypt } from "@/lib/crypto"
import crypto from "crypto"

/**
 * MoM Point 8 & 9 — Patient QR code generation (with encryption).
 *
 * Generates an AES-256-CBC encrypted QR payload containing the patient's
 * health summary. Doctors scan via /api/qr/scan (which decrypts only for
 * accounts with role DOCTOR or ORGANIZATION).
 *
 * GET /api/qr/patient?patientId=...&purpose=CHECKIN|RECORD_ACCESS|EMERGENCY
 *   → returns { payload, hash, qrDataUrl } — qrDataUrl is a data URL
 *     containing the encrypted JSON (frontend renders it as a QR image).
 *
 * POST /api/qr/patient { patientId, purpose }  → rotate / create new QR
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get("patientId")
  const purpose = (searchParams.get("purpose") || "CHECKIN") as
    | "CHECKIN"
    | "RECORD_ACCESS"
    | "EMERGENCY"

  if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 })

  const patient = await db.account.findUnique({
    where: { id: patientId },
    include: {
      patientRecords: {
        take: 5,
        orderBy: { visitDate: "desc" },
        select: { visitType: true, diagnosis: true, visitDate: true },
      },
      insurance: true,
    },
  })
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 })

  // Build the summary — different fields per purpose
  const summary: Record<string, unknown> = {
    v: 1,
    patientId: patient.id,
    name: patient.name,
    age: patient.dateOfBirth
      ? new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()
      : null,
    gender: patient.gender,
    bloodGroup: patient.bloodGroup,
    purpose,
    generatedAt: new Date().toISOString(),
  }

  if (purpose === "EMERGENCY") {
    summary.emergencyName = patient.emergencyName
    summary.emergencyMobile = patient.emergencyMobile
    summary.knownConditions = patient.patientRecords
      .map((r) => r.diagnosis)
      .filter(Boolean)
      .slice(0, 3)
  }

  if (purpose === "RECORD_ACCESS") {
    summary.insuranceProvider = patient.insurance?.providerName
    summary.policyNumber = patient.insurance?.policyNumber
  }

  // Encrypt the payload — only doctor/org accounts can decrypt via /scan
  const payload = encrypt(JSON.stringify(summary))
  const payloadHash = crypto.createHash("sha256").update(payload).digest("hex")

  // Persist (deactivate previous QRs of the same purpose, then create new)
  await db.patientQrCode.updateMany({
    where: { patientId, purpose, isActive: true },
    data: { isActive: false },
  })
  const qr = await db.patientQrCode.create({
    data: {
      patientId,
      payload,
      payloadHash,
      purpose,
      isActive: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h validity
    },
  })

  // The QR "data" is the payload string — the frontend encodes it to a QR image
  return NextResponse.json({
    ok: true,
    qrId: qr.id,
    payload,
    hash: payloadHash,
    expiresAt: qr.expiresAt,
    // The data the frontend embeds into the QR image
    qrData: payload,
    purpose,
  })
}

export async function POST(req: NextRequest) {
  // Alias for "regenerate"
  const { patientId, purpose } = await req.json()
  if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 })

  // Reuse GET logic by redirecting to the same flow
  const patient = await db.account.findUnique({ where: { id: patientId } })
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 })

  const summary = {
    v: 1,
    patientId: patient.id,
    name: patient.name,
    bloodGroup: patient.bloodGroup,
    purpose: purpose || "CHECKIN",
    generatedAt: new Date().toISOString(),
  }
  const payload = encrypt(JSON.stringify(summary))
  const payloadHash = crypto.createHash("sha256").update(payload).digest("hex")

  await db.patientQrCode.updateMany({
    where: { patientId, purpose: purpose || "CHECKIN", isActive: true },
    data: { isActive: false },
  })
  const qr = await db.patientQrCode.create({
    data: {
      patientId,
      payload,
      payloadHash,
      purpose: purpose || "CHECKIN",
      isActive: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  })

  return NextResponse.json({ ok: true, qrId: qr.id, payload, hash: payloadHash, qrData: payload })
}
