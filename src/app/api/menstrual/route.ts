import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * MoM Point — Menstrual Cycle Tracker.
 *
 * GET  /api/menstrual?patientId=...
 * POST /api/menstrual { patientId, startDate, endDate?, flowLevel, symptoms[], mood, notes }
 * PATCH /api/menstrual { id, endDate, flowLevel, ... }
 * DELETE /api/menstrual?id=...
 *
 * The server computes:
 *   - cycleLength (days since previous period start)
 *   - periodLength (endDate - startDate)
 *   - nextPredictedStart (based on average cycle length over last 6 cycles)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get("patientId")
  if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 })

  const logs = await db.menstrualCycleLog.findMany({
    where: { patientId },
    orderBy: { startDate: "desc" },
    take: 60,
  })

  // Predictions — average cycle length over last 6 completed cycles
  const completed = logs.filter((l) => l.cycleLength != null).slice(0, 6)
  const avgCycle = completed.length
    ? Math.round(completed.reduce((s, l) => s + (l.cycleLength || 0), 0) / completed.length)
    : 28
  const avgPeriod = logs.filter((l) => l.periodLength != null).slice(0, 6)
  const avgPeriodLen = avgPeriod.length
    ? Math.round(avgPeriod.reduce((s, l) => s + (l.periodLength || 0), 0) / avgPeriod.length)
    : 5

  const lastStart = logs[0]?.startDate
  const nextPredictedStart = lastStart
    ? new Date(lastStart.getTime() + avgCycle * 24 * 60 * 60 * 1000)
    : null
  const nextPredictedEnd = nextPredictedStart
    ? new Date(nextPredictedStart.getTime() + avgPeriodLen * 24 * 60 * 60 * 1000)
    : null

  // Fertility window — typically days 10-17 of cycle
  const fertileStart = lastStart
    ? new Date(lastStart.getTime() + 10 * 24 * 60 * 60 * 1000)
    : null
  const fertileEnd = lastStart
    ? new Date(lastStart.getTime() + 17 * 24 * 60 * 60 * 1000)
    : null
  const ovulationDay = lastStart
    ? new Date(lastStart.getTime() + 14 * 24 * 60 * 60 * 1000)
    : null

  return NextResponse.json({
    logs,
    stats: {
      avgCycleLength: avgCycle,
      avgPeriodLength: avgPeriodLen,
      nextPredictedStart,
      nextPredictedEnd,
      fertileStart,
      fertileEnd,
      ovulationDay,
      totalCyclesTracked: logs.length,
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    const { patientId, startDate, endDate, flowLevel, symptoms, mood, notes } = await req.json()
    if (!patientId || !startDate) {
      return NextResponse.json({ error: "patientId and startDate required" }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = endDate ? new Date(endDate) : null

    // Compute cycleLength — days since previous period start
    const prev = await db.menstrualCycleLog.findFirst({
      where: { patientId, startDate: { lt: start } },
      orderBy: { startDate: "desc" },
    })
    const cycleLength = prev
      ? Math.round((start.getTime() - prev.startDate.getTime()) / (24 * 60 * 60 * 1000))
      : null
    const periodLength = end
      ? Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
      : null

    const log = await db.menstrualCycleLog.create({
      data: {
        patientId,
        startDate: start,
        endDate: end,
        flowLevel: flowLevel || "MODERATE",
        symptoms: symptoms ? JSON.stringify(symptoms) : null,
        mood: mood || null,
        notes: notes || null,
        cycleLength,
        periodLength,
      },
    })
    return NextResponse.json({ ok: true, log })
  } catch (e) {
    console.error("menstrual log error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, endDate, flowLevel, mood, notes } = await req.json()
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const existing = await db.menstrualCycleLog.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const periodLength = endDate
      ? Math.round((new Date(endDate).getTime() - existing.startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1
      : existing.periodLength

    const updated = await db.menstrualCycleLog.update({
      where: { id },
      data: {
        endDate: endDate ? new Date(endDate) : existing.endDate,
        flowLevel: flowLevel || existing.flowLevel,
        mood: mood ?? existing.mood,
        notes: notes ?? existing.notes,
        periodLength,
      },
    })
    return NextResponse.json({ ok: true, log: updated })
  } catch (e) {
    console.error("menstrual patch error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  await db.menstrualCycleLog.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
