import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// Mark a scheduled dose as taken or skipped.
// Body: { medicationId, patientId, scheduledTime, scheduledDate, taken?, skipped?, notes? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      medicationId,
      patientId,
      scheduledTime,
      scheduledDate,
      taken = true,
      skipped = false,
      notes,
    } = body
    if (!medicationId || !patientId || !scheduledTime || !scheduledDate) {
      return NextResponse.json(
        { error: "medicationId, patientId, scheduledTime, scheduledDate required" },
        { status: 400 }
      )
    }
    const date = new Date(scheduledDate)
    date.setHours(0, 0, 0, 0)

    const log = await db.medicationLog.upsert({
      where: {
        medicationId_scheduledDate_scheduledTime: {
          medicationId,
          scheduledDate: date,
          scheduledTime,
        },
      },
      create: {
        medicationId,
        patientId,
        scheduledTime,
        scheduledDate: date,
        takenAt: taken && !skipped ? new Date() : null,
        skipped: !!skipped,
        notes: notes || null,
      },
      update: {
        takenAt: taken && !skipped ? new Date() : null,
        skipped: !!skipped,
        notes: notes || null,
      },
    })
    return NextResponse.json({ log })
  } catch (e) {
    console.error("med-log create error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// Get logs for a patient within a date range
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get("patientId")
  const days = parseInt(searchParams.get("days") || "30", 10)
  if (!patientId) {
    return NextResponse.json({ error: "patientId required" }, { status: 400 })
  }
  const since = new Date()
  since.setDate(since.getDate() - days)
  since.setHours(0, 0, 0, 0)
  const logs = await db.medicationLog.findMany({
    where: { patientId, scheduledDate: { gte: since } },
    orderBy: { scheduledDate: "desc" },
  })
  return NextResponse.json({ logs })
}
