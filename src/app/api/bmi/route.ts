import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * MoM Point — BMI Tracker.
 *
 * GET  /api/bmi?patientId=...           → list all logs (newest first)
 * POST /api/bmi { patientId, heightCm, weightKg, note }  → compute + log
 * DELETE /api/bmi?id=...                → remove a log entry
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get("patientId")
  if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 })

  const logs = await db.bmiLog.findMany({
    where: { patientId },
    orderBy: { loggedAt: "desc" },
    take: 200,
  })
  return NextResponse.json({ logs })
}

export async function POST(req: NextRequest) {
  try {
    const { patientId, heightCm, weightKg, note } = await req.json()
    if (!patientId || !heightCm || !weightKg) {
      return NextResponse.json({ error: "patientId, heightCm, weightKg required" }, { status: 400 })
    }
    const h = Number(heightCm)
    const w = Number(weightKg)
    if (h < 30 || h > 250 || w < 2 || w > 400) {
      return NextResponse.json({ error: "Measurements out of range" }, { status: 422 })
    }
    const bmi = Number((w / Math.pow(h / 100, 2)).toFixed(2))
    const category =
      bmi < 18.5 ? "UNDERWEIGHT" : bmi < 25 ? "NORMAL" : bmi < 30 ? "OVERWEIGHT" : "OBESE"

    const log = await db.bmiLog.create({
      data: {
        patientId,
        heightCm: h,
        weightKg: w,
        bmi,
        category,
        note: note || null,
      },
    })
    return NextResponse.json({ ok: true, log })
  } catch (e) {
    console.error("bmi log error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  await db.bmiLog.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
