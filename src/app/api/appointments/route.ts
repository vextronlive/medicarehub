import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateTokenNumber } from "@/lib/crypto"
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
  else if (role === "ORGANIZATION") where.orgId = userId
  if (status) where.status = status

  const appointments = await db.appointment.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    include: {
      patient: { select: { id: true, name: true, mobile: true, bloodGroup: true } },
      doctor: { select: { id: true, name: true, specialization: true, city: true } },
      org: { select: { id: true, name: true, city: true } },
      slot: { select: { id: true, startAt: true, endAt: true, capacity: true, bookedCount: true, status: true } },
    },
  })

  return NextResponse.json({ appointments })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { patientId, doctorId, orgId, scheduledAt, reason, notes, slotId, aadhaarVerified, aadhaarRef } = body

    if (!patientId || !doctorId || !scheduledAt) {
      return NextResponse.json(
        { error: "patientId, doctorId and scheduledAt required" },
        { status: 400 }
      )
    }

    // ─── MoM Point 4 — capacity slot validation ───
    if (slotId) {
      const slot = await db.capacitySlot.findUnique({ where: { id: slotId } })
      if (!slot) {
        return NextResponse.json({ error: "Selected slot not found" }, { status: 404 })
      }
      if (slot.doctorId !== doctorId) {
        return NextResponse.json({ error: "Slot does not belong to this doctor" }, { status: 422 })
      }
      if (slot.status === "CLOSED") {
        return NextResponse.json({ error: "This slot is closed. Please pick another time." }, { status: 422 })
      }
      if (slot.bookedCount >= slot.capacity) {
        return NextResponse.json(
          { error: "This slot is fully booked. Please pick another time." },
          { status: 409 }
        )
      }
    }

    // count existing confirmed appointments for the doctor on that day to derive sequence
    const dayStart = new Date(scheduledAt)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(scheduledAt)
    dayEnd.setHours(23, 59, 59, 999)

    const countToday = await db.appointment.count({
      where: {
        doctorId,
        scheduledAt: { gte: dayStart, lte: dayEnd },
        status: { in: ["CONFIRMED", "COMPLETED"] },
      },
    })

    const tokenNumber = generateTokenNumber(countToday + 1)

    // Create the appointment inside a slot-aware transaction (MoM Point 4)
    const appt = await db.$transaction(async (tx) => {
      const created = await tx.appointment.create({
        data: {
          patientId,
          doctorId,
          orgId: orgId || null,
          scheduledAt: new Date(scheduledAt),
          status: "PENDING",
          reason: reason || "",
          notes: notes || null,
          tokenNumber,
          slotId: slotId || null,
          aadhaarVerified: !!aadhaarVerified,
          aadhaarRef: aadhaarRef || null,
        },
        include: {
          patient: { select: { id: true, name: true, mobile: true, bloodGroup: true } },
          doctor: { select: { id: true, name: true, specialization: true, city: true } },
        },
      })

      if (slotId) {
        const slot = await tx.capacitySlot.findUnique({ where: { id: slotId } })
        if (slot) {
          const newCount = slot.bookedCount + 1
          await tx.capacitySlot.update({
            where: { id: slotId },
            data: {
              bookedCount: newCount,
              status: newCount >= slot.capacity ? "FULL" : "OPEN",
            },
          })
        }
      }
      return created
    })

    // Real-time notification: tell the doctor/org about the new appointment
    void notifyUser(doctorId, "appointment:created", {
      appointmentId: appt.id,
      patient: appt.patient,
      scheduledAt: appt.scheduledAt,
      tokenNumber: appt.tokenNumber,
    })
    if (orgId) {
      void notifyUser(orgId, "appointment:created", {
        appointmentId: appt.id,
        patient: appt.patient,
        scheduledAt: appt.scheduledAt,
        tokenNumber: appt.tokenNumber,
      })
    }

    return NextResponse.json({ appointment: appt })
  } catch (e) {
    console.error("appointment create error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, status, scheduledAt, byUserId } = body
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }

    // Fetch the existing appointment to know the previous status (for the WS event)
    const existing = await db.appointment.findUnique({
      where: { id },
      select: { status: true, patientId: true, doctorId: true, orgId: true },
    })
    if (!existing) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }
    const oldStatus = existing.status

    const data: Record<string, unknown> = {}
    if (status) data.status = status
    if (scheduledAt) data.scheduledAt = new Date(scheduledAt)
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "status or scheduledAt required" }, { status: 400 })
    }
    const appt = await db.appointment.update({
      where: { id },
      data,
      include: {
        patient: { select: { id: true, name: true, mobile: true, bloodGroup: true } },
        doctor: { select: { id: true, name: true, specialization: true, city: true } },
      },
    })

    // Real-time notification: status change
    if (status && status !== oldStatus) {
      const targets = [existing.patientId, existing.doctorId]
      if (existing.orgId) targets.push(existing.orgId)
      for (const t of targets) {
        if (t !== byUserId) {
          void notifyUser(t, "appointment:status_changed", {
            appointmentId: id,
            oldStatus,
            newStatus: status,
            byUser: byUserId || null,
            appointment: appt,
          })
        }
      }
    }

    return NextResponse.json({ appointment: appt })
  } catch (e) {
    console.error("appointment update error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
