import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get("patientId")
  const status = searchParams.get("status") // optional filter
  if (!patientId) {
    return NextResponse.json({ error: "patientId required" }, { status: 400 })
  }
  const alerts = await db.emergencyAlert.findMany({
    where: { patientId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  return NextResponse.json({ alerts })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      patientId,
      type,
      severity,
      lat,
      lng,
      addressSnapshot,
      description,
      notifiedContacts,
    } = body
    if (!patientId || !type) {
      return NextResponse.json(
        { error: "patientId, type required" },
        { status: 400 }
      )
    }
    const alert = await db.emergencyAlert.create({
      data: {
        patientId,
        type: String(type),
        severity: severity || "HIGH",
        lat: lat != null ? String(lat) : null,
        lng: lng != null ? String(lng) : null,
        addressSnapshot: addressSnapshot || null,
        description: description || null,
        notifiedContacts: notifiedContacts
          ? JSON.stringify(notifiedContacts)
          : null,
        status: "ACTIVE",
      },
    })
    return NextResponse.json({ alert })
  } catch (e) {
    console.error("emergency-alert create error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, status, description, resolvedAt } = body
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }
    const data: Record<string, unknown> = {}
    if (status) data.status = status
    if (description !== undefined) data.description = description
    if (resolvedAt) data.resolvedAt = new Date(resolvedAt)
    else if (status === "RESOLVED" || status === "CANCELLED") {
      data.resolvedAt = new Date()
    }
    const alert = await db.emergencyAlert.update({ where: { id }, data })
    return NextResponse.json({ alert })
  } catch (e) {
    console.error("emergency-alert update error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
