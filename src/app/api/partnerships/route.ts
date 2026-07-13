import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get("orgId")
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 })

  const partnerships = await db.partnership.findMany({
    where: { orgId },
    include: {
      clinic: { select: { id: true, name: true, city: true, addressLine: true } },
    },
    orderBy: { rating: "desc" },
  })
  return NextResponse.json({ partnerships })
}

export async function POST(req: NextRequest) {
  try {
    const { orgId, clinicId, clinicType, commissionRate } = await req.json()
    if (!orgId || !clinicId) {
      return NextResponse.json({ error: "orgId and clinicId required" }, { status: 400 })
    }
    const partnership = await db.partnership.create({
      data: {
        orgId,
        clinicId,
        clinicType: clinicType || "BLOOD_TEST",
        commissionRate: Number(commissionRate) || 0,
      },
    })
    return NextResponse.json({ partnership })
  } catch (e) {
    console.error("partnership error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
