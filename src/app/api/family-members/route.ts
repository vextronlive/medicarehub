import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ownerId = searchParams.get("ownerId")
  if (!ownerId) {
    return NextResponse.json({ error: "ownerId required" }, { status: 400 })
  }
  const members = await db.familyMember.findMany({
    where: { ownerId },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json({ members })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      ownerId,
      name,
      relation,
      gender,
      dateOfBirth,
      bloodGroup,
      phone,
      email,
      allergies,
      chronicConditions,
      currentMedications,
      emergencyContact,
      notes,
    } = body
    if (!ownerId || !name || !relation) {
      const missing = []
      if (!ownerId) missing.push("ownerId")
      if (!name) missing.push("name")
      if (!relation) missing.push("relation")
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}. Please fill in name and relation.` },
        { status: 400 }
      )
    }
    const member = await db.familyMember.create({
      data: {
        ownerId,
        name: String(name).trim(),
        relation: String(relation),
        gender: gender || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        bloodGroup: bloodGroup || null,
        phone: phone || null,
        email: email || null,
        allergies: allergies || null,
        chronicConditions: chronicConditions || null,
        currentMedications: currentMedications || null,
        emergencyContact: emergencyContact || null,
        notes: notes || null,
      },
    })
    return NextResponse.json({ member })
  } catch (e) {
    console.error("family-member create error", e)
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { error: "Failed to add family member", detail: message },
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
      "name",
      "relation",
      "gender",
      "dateOfBirth",
      "bloodGroup",
      "phone",
      "email",
      "allergies",
      "chronicConditions",
      "currentMedications",
      "emergencyContact",
      "notes",
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in rest) {
        if (key === "dateOfBirth" && rest[key]) {
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
    const member = await db.familyMember.update({ where: { id }, data })
    return NextResponse.json({ member })
  } catch (e) {
    console.error("family-member update error", e)
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
    await db.familyMember.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("family-member delete error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
