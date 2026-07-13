import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const labId = searchParams.get("labId")
  const category = searchParams.get("category")
  const activeOnly = searchParams.get("activeOnly") !== "false"

  if (!labId) {
    return NextResponse.json({ error: "labId required" }, { status: 400 })
  }

  const where: Record<string, unknown> = { labId }
  if (activeOnly) where.isActive = true
  if (category) where.category = category

  const items = await db.labTestCatalog.findMany({
    where,
    orderBy: [{ category: "asc" }, { testName: "asc" }],
  })

  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      labId,
      testName,
      category,
      description,
      price,
      durationMins,
      sampleType,
      fastingRequired,
    } = body

    if (!labId || !testName || !category || price == null) {
      return NextResponse.json(
        { error: "labId, testName, category and price required" },
        { status: 400 }
      )
    }

    const item = await db.labTestCatalog.create({
      data: {
        labId,
        testName: String(testName).trim(),
        category: String(category).trim(),
        description: description || null,
        price: Number(price),
        durationMins: Number(durationMins) || 60,
        sampleType: sampleType || null,
        fastingRequired: Boolean(fastingRequired),
        isActive: true,
      },
    })

    return NextResponse.json({ item })
  } catch (e) {
    console.error("lab-catalog create error", e)
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
      "testName",
      "category",
      "description",
      "price",
      "durationMins",
      "sampleType",
      "fastingRequired",
      "isActive",
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in rest) data[key] = rest[key]
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      )
    }
    const item = await db.labTestCatalog.update({ where: { id }, data })
    return NextResponse.json({ item })
  } catch (e) {
    console.error("lab-catalog update error", e)
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
    await db.labTestCatalog.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("lab-catalog delete error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
