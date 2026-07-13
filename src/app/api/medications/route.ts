import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get("patientId")
  const includeLogs = searchParams.get("logs") === "true"
  const days = parseInt(searchParams.get("days") || "7", 10)

  if (!patientId) {
    return NextResponse.json({ error: "patientId required" }, { status: 400 })
  }

  const since = new Date()
  since.setDate(since.getDate() - days)
  since.setHours(0, 0, 0, 0)

  const meds = await db.medicationSchedule.findMany({
    where: { patientId, isActive: true },
    orderBy: { createdAt: "desc" },
    include: includeLogs
      ? {
          logs: {
            where: { scheduledDate: { gte: since } },
            orderBy: { scheduledDate: "desc" },
          },
        }
      : undefined,
  })

  return NextResponse.json({ medications: meds })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      patientId,
      medicineName,
      dosage,
      frequency,
      times,
      startDate,
      endDate,
      instructions,
      prescribedBy,
    } = body
    if (!patientId || !medicineName || !dosage || !frequency) {
      return NextResponse.json(
        { error: "patientId, medicineName, dosage, frequency required" },
        { status: 400 }
      )
    }
    let timesArr: string[] = []
    if (Array.isArray(times)) {
      timesArr = times.filter((t) => typeof t === "string")
    } else if (typeof times === "string") {
      try {
        const parsed = JSON.parse(times)
        if (Array.isArray(parsed)) timesArr = parsed
      } catch {
        timesArr = times.split(",").map((s) => s.trim())
      }
    }
    if (timesArr.length === 0) {
      if (frequency === "ONCE_DAILY") timesArr = ["09:00"]
      else if (frequency === "TWICE_DAILY") timesArr = ["09:00", "21:00"]
      else if (frequency === "THRICE_DAILY") timesArr = ["08:00", "14:00", "20:00"]
      else if (frequency === "WEEKLY") timesArr = ["09:00"]
      else timesArr = ["09:00"]
    }

    const med = await db.medicationSchedule.create({
      data: {
        patientId,
        medicineName: String(medicineName).trim(),
        dosage: String(dosage).trim(),
        frequency: String(frequency),
        times: JSON.stringify(timesArr),
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        instructions: instructions || null,
        prescribedBy: prescribedBy || null,
        isActive: true,
      },
    })
    return NextResponse.json({ medication: med })
  } catch (e) {
    console.error("medication create error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
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
      "medicineName",
      "dosage",
      "frequency",
      "times",
      "startDate",
      "endDate",
      "instructions",
      "prescribedBy",
      "isActive",
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in rest) {
        if (key === "times" && Array.isArray(rest[key])) {
          data[key] = JSON.stringify(rest[key])
        } else if (key === "times" && typeof rest[key] === "string") {
          data[key] = rest[key]
        } else if (
          (key === "startDate" || key === "endDate") &&
          rest[key]
        ) {
          data[key] = new Date(rest[key])
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
    const med = await db.medicationSchedule.update({ where: { id }, data })
    return NextResponse.json({ medication: med })
  } catch (e) {
    console.error("medication update error", e)
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
    await db.medicationSchedule.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("medication delete error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
