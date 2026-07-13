import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { notifyUser } from "@/lib/ws-emit"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId")
  const role = searchParams.get("role")
  const status = searchParams.get("status")

  if (!userId || !role) {
    return NextResponse.json({ error: "userId and role required" }, { status: 400 })
  }

  const where: Record<string, unknown> = {}
  if (role === "PATIENT") where.patientId = userId
  else if (role === "DOCTOR") where.doctorId = userId
  else if (role === "ORGANIZATION") where.doctorId = userId
  if (status) where.status = status

  const refills = await db.refillRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      patient: { select: { id: true, name: true, mobile: true, bloodGroup: true } },
      doctor: { select: { id: true, name: true, specialization: true } },
    },
  })

  return NextResponse.json({ refills })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { patientId, doctorId, recordId, medicineName, dosage, quantity, note } = body

    if (!patientId || !doctorId || !medicineName) {
      return NextResponse.json(
        { error: "patientId, doctorId and medicineName required" },
        { status: 400 }
      )
    }

    const refill = await db.refillRequest.create({
      data: {
        patientId,
        doctorId,
        recordId: recordId || null,
        medicineName: String(medicineName).trim(),
        dosage: dosage || "",
        quantity: Number(quantity) || 1,
        note: note || null,
        status: "PENDING",
      },
      include: {
        patient: { select: { id: true, name: true, mobile: true, bloodGroup: true } },
        doctor: { select: { id: true, name: true, specialization: true } },
      },
    })

    // Real-time: notify the doctor about the new refill request
    void notifyUser(doctorId, "refill:new", {
      refillId: refill.id,
      patient: refill.patient,
      medicineName: refill.medicineName,
    })

    return NextResponse.json({ refill })
  } catch (e) {
    console.error("refill create error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, status, doctorNote, byUserId } = body
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }
    if (!status && doctorNote === undefined) {
      return NextResponse.json(
        { error: "status or doctorNote required" },
        { status: 400 }
      )
    }
    const existing = await db.refillRequest.findUnique({
      where: { id },
      select: { status: true, patientId: true, doctorId: true },
    })
    if (!existing) {
      return NextResponse.json({ error: "Refill not found" }, { status: 404 })
    }
    const oldStatus = existing.status

    const data: Record<string, unknown> = {}
    if (status) data.status = status
    if (doctorNote !== undefined) data.doctorNote = doctorNote
    const refill = await db.refillRequest.update({
      where: { id },
      data,
      include: {
        patient: { select: { id: true, name: true, mobile: true, bloodGroup: true } },
        doctor: { select: { id: true, name: true, specialization: true } },
      },
    })

    // Real-time: notify patient when status changes
    if (status && status !== oldStatus && existing.patientId !== byUserId) {
      void notifyUser(existing.patientId, "refill:status_changed", {
        refillId: id,
        oldStatus,
        newStatus: status,
        medicineName: refill.medicineName,
      })
    }

    return NextResponse.json({ refill })
  } catch (e) {
    console.error("refill update error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
