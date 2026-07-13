import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get("patientId")
  const limit = parseInt(searchParams.get("limit") || "100", 10)

  if (!patientId) {
    return NextResponse.json({ error: "patientId required" }, { status: 400 })
  }

  const vitals = await db.vitals.findMany({
    where: { patientId },
    orderBy: { recordedAt: "desc" },
    take: limit,
  })

  return NextResponse.json({ vitals })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      patientId,
      systolic,
      diastolic,
      heartRate,
      glucose,
      weight,
      temperature,
      oxygenSat,
      steps,
      note,
      recordedAt,
    } = body

    if (!patientId) {
      return NextResponse.json({ error: "patientId required (are you logged in?)" }, { status: 400 })
    }

    // Require at least one measurement (use != null so 0 counts as valid)
    const hasMeasurement =
      systolic != null || diastolic != null || heartRate != null ||
      glucose != null || weight != null || temperature != null ||
      oxygenSat != null || steps != null
    if (!hasMeasurement) {
      return NextResponse.json(
        { error: "Please enter at least one vital measurement before saving." },
        { status: 400 }
      )
    }

    // Basic range validation
    if (systolic != null && (systolic < 50 || systolic > 300)) {
      return NextResponse.json({ error: "Invalid systolic value" }, { status: 400 })
    }
    if (diastolic != null && (diastolic < 30 || diastolic > 200)) {
      return NextResponse.json({ error: "Invalid diastolic value" }, { status: 400 })
    }

    const vital = await db.vitals.create({
      data: {
        patientId,
        systolic: systolic ?? null,
        diastolic: diastolic ?? null,
        heartRate: heartRate ?? null,
        glucose: glucose ?? null,
        weight: weight ?? null,
        temperature: temperature ?? null,
        oxygenSat: oxygenSat ?? null,
        steps: steps ?? null,
        note: note || null,
        recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
      },
    })

    return NextResponse.json({ vital })
  } catch (e) {
    console.error("vitals create error", e)
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { error: "Failed to save vitals", detail: message },
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
      "systolic",
      "diastolic",
      "heartRate",
      "glucose",
      "weight",
      "temperature",
      "oxygenSat",
      "steps",
      "note",
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in rest) data[key] = rest[key]
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }
    const vital = await db.vitals.update({ where: { id }, data })
    return NextResponse.json({ vital })
  } catch (e) {
    console.error("vitals update error", e)
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
    await db.vitals.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("vitals delete error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
