import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get("patientId")
  const includeLogs = searchParams.get("logs") === "true"
  if (!patientId) {
    return NextResponse.json({ error: "patientId required" }, { status: 400 })
  }
  const goals = await db.healthGoal.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    include: includeLogs
      ? { logs: { orderBy: { loggedAt: "desc" }, take: 30 } }
      : undefined,
  })
  return NextResponse.json({ goals })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      patientId,
      title,
      metric,
      targetValue,
      currentValue,
      unit,
      period,
      endDate,
    } = body
    if (!patientId || !title || !metric || targetValue == null) {
      const missing = []
      if (!patientId) missing.push("patientId")
      if (!title) missing.push("title")
      if (!metric) missing.push("metric")
      if (targetValue == null) missing.push("targetValue")
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}. Please fill in all goal details.` },
        { status: 400 }
      )
    }
    const goal = await db.healthGoal.create({
      data: {
        patientId,
        title: String(title).trim(),
        metric: String(metric),
        targetValue: Number(targetValue),
        currentValue: currentValue != null ? Number(currentValue) : 0,
        unit: unit || "",
        period: period || "DAILY",
        endDate: endDate ? new Date(endDate) : null,
        status: "ACTIVE",
      },
    })
    return NextResponse.json({ goal })
  } catch (e) {
    console.error("goal create error", e)
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { error: "Failed to create goal", detail: message },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...rest } = body
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }
    const allowed = [
      "title",
      "metric",
      "targetValue",
      "currentValue",
      "unit",
      "period",
      "status",
      "endDate",
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in rest) {
        if (key === "endDate" && rest[key]) {
          data[key] = new Date(rest[key])
        } else if (
          key === "targetValue" ||
          key === "currentValue"
        ) {
          data[key] = Number(rest[key])
        } else {
          data[key] = rest[key]
        }
      }
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      )
    }
    const goal = await db.healthGoal.update({ where: { id }, data })
    return NextResponse.json({ goal })
  } catch (e) {
    console.error("goal update error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }
    await db.healthGoal.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("goal delete error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
