import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// Add a goal log entry; updates the goal's currentValue automatically.
// Body: { goalId, patientId, value, note? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { goalId, patientId, value, note } = body
    if (!goalId || !patientId || value == null) {
      return NextResponse.json(
        { error: "goalId, patientId, value required" },
        { status: 400 }
      )
    }
    const numVal = Number(value)
    if (Number.isNaN(numVal)) {
      return NextResponse.json({ error: "value must be numeric" }, { status: 400 })
    }
    const log = await db.goalLog.create({
      data: {
        goalId,
        patientId,
        value: numVal,
        note: note || null,
      },
    })
    // Fetch the goal to determine target, then update currentValue + status
    const existing = await db.healthGoal.findUnique({ where: { id: goalId } })
    let goal = existing
    if (existing) {
      goal = await db.healthGoal.update({
        where: { id: goalId },
        data: {
          currentValue: numVal,
          status: numVal >= existing.targetValue ? "COMPLETED" : "ACTIVE",
        },
      })
    }
    return NextResponse.json({ log, goal })
  } catch (e) {
    console.error("goal-log create error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const goalId = searchParams.get("goalId")
  const patientId = searchParams.get("patientId")
  const limit = parseInt(searchParams.get("limit") || "30", 10)
  if (!goalId && !patientId) {
    return NextResponse.json(
      { error: "goalId or patientId required" },
      { status: 400 }
    )
  }
  const logs = await db.goalLog.findMany({
    where: goalId ? { goalId } : { patientId },
    orderBy: { loggedAt: "desc" },
    take: limit,
  })
  return NextResponse.json({ logs })
}
