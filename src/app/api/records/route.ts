import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { encrypt, decrypt } from "@/lib/crypto"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId")
  const role = searchParams.get("role")

  if (!userId || !role) {
    return NextResponse.json({ error: "userId and role required" }, { status: 400 })
  }

  const where: Record<string, unknown> = {}
  if (role === "PATIENT") where.patientId = userId
  else if (role === "DOCTOR") where.doctorId = userId
  else if (role === "ORGANIZATION") where.orgId = userId

  const records = await db.medicalRecord.findMany({
    where,
    orderBy: { visitDate: "desc" },
    include: {
      patient: { select: { id: true, name: true, mobile: true, bloodGroup: true } },
      doctor: { select: { id: true, name: true, specialization: true } },
      org: { select: { id: true, name: true, city: true } },
    },
  })

  // Decrypt for display
  const decrypted = records.map((r) => ({
    ...r,
    diagnosis: r.diagnosis ? safeDecrypt(r.diagnosis) : "",
    doctorsNotes: r.doctorsNotes ? safeDecrypt(r.doctorsNotes) : "",
    prescription: r.prescription ? safeDecrypt(r.prescription) : "",
  }))

  return NextResponse.json({ records: decrypted })
}

function safeDecrypt(payload: string): string {
  try {
    return decrypt(payload)
  } catch {
    return payload
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      patientId,
      doctorId,
      orgId,
      visitType,
      clinicName,
      practitionerName,
      specialization,
      diagnosis,
      doctorsNotes,
      prescription,
      attachments,
      visitDate,
    } = body

    if (!patientId || !doctorId || !visitType || !clinicName) {
      return NextResponse.json(
        { error: "patientId, doctorId, visitType, clinicName required" },
        { status: 400 }
      )
    }

    const record = await db.medicalRecord.create({
      data: {
        patientId,
        doctorId,
        orgId: orgId || null,
        visitType,
        clinicName,
        practitionerName,
        specialization: specialization || "",
        diagnosis: encrypt(diagnosis || ""),
        doctorsNotes: encrypt(doctorsNotes || ""),
        prescription: encrypt(prescription || ""),
        attachments: attachments || "[]",
        visitDate: visitDate ? new Date(visitDate) : new Date(),
      },
    })

    return NextResponse.json({ record })
  } catch (e) {
    console.error("record create error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
