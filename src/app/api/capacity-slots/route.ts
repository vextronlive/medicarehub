import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * MoM Point 4 — Capacity-per-hour slots for doctors/orgs.
 *
 * GET   /api/capacity-slots?doctorId=...&from=ISO&to=ISO
 *   → list slots for a doctor within a date range (default: next 7 days)
 *
 * POST  /api/capacity-slots
 *   { doctorId, startAt, endAt, capacity, notes }
 *   → create a single slot. If `recurring=weekly` is sent, creates 8 weekly slots.
 *
 * PATCH /api/capacity-slots
 *   { id, status, capacity }
 *   → update slot status (OPEN/FULL/CLOSED) or capacity
 *
 * DELETE /api/capacity-slots?id=...
 *
 * Auto-management: when an appointment is created with slotId, the slot's
 * bookedCount is incremented. When bookedCount >= capacity, status → FULL.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const doctorId = searchParams.get("doctorId")
  if (!doctorId) return NextResponse.json({ error: "doctorId required" }, { status: 400 })

  const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : new Date()
  const to = searchParams.get("to")
    ? new Date(searchParams.get("to")!)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const slots = await db.capacitySlot.findMany({
    where: { doctorId, startAt: { gte: from, lte: to } },
    orderBy: { startAt: "asc" },
    include: {
      appointments: {
        where: { status: { in: ["PENDING", "CONFIRMED"] } },
        select: { id: true, status: true, patient: { select: { name: true, mobile: true } } },
      },
    },
  })

  return NextResponse.json({ slots })
}

export async function POST(req: NextRequest) {
  try {
    const { doctorId, startAt, endAt, capacity, notes, recurring } = await req.json()
    if (!doctorId || !startAt || !endAt) {
      return NextResponse.json({ error: "doctorId, startAt, endAt required" }, { status: 400 })
    }

    const start = new Date(startAt)
    const end = new Date(endAt)
    if (end <= start) {
      return NextResponse.json({ error: "endAt must be after startAt" }, { status: 422 })
    }

    const cap = Math.max(1, Number(capacity) || 1)

    // Single slot
    if (!recurring) {
      const slot = await db.capacitySlot.create({
        data: { doctorId, startAt: start, endAt: end, capacity: cap, notes: notes || null },
      })
      return NextResponse.json({ ok: true, slot })
    }

    // Recurring weekly — create 8 weeks of slots
    const slots = []
    for (let i = 0; i < 8; i++) {
      const s = new Date(start.getTime() + i * 7 * 24 * 60 * 60 * 1000)
      const e = new Date(end.getTime() + i * 7 * 24 * 60 * 60 * 1000)
      slots.push(
        await db.capacitySlot.create({
          data: { doctorId, startAt: s, endAt: e, capacity: cap, notes: notes || null },
        })
      )
    }
    return NextResponse.json({ ok: true, slots, count: slots.length })
  } catch (e) {
    console.error("capacity slot create error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status, capacity, notes } = await req.json()
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const existing = await db.capacitySlot.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const updated = await db.capacitySlot.update({
      where: { id },
      data: {
        status: status || existing.status,
        capacity: capacity != null ? Number(capacity) : existing.capacity,
        notes: notes ?? existing.notes,
      },
    })
    return NextResponse.json({ ok: true, slot: updated })
  } catch (e) {
    console.error("capacity slot patch error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  // Don't delete if there are confirmed appointments against this slot
  const slot = await db.capacitySlot.findUnique({
    where: { id },
    include: { appointments: { where: { status: { in: ["CONFIRMED", "COMPLETED"] } } } },
  })
  if (slot && slot.appointments.length > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${slot.appointments.length} confirmed appointments are linked to this slot` },
      { status: 409 }
    )
  }

  await db.capacitySlot.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
