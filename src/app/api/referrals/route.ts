import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId")
  const direction = searchParams.get("direction") || "given" // given | received

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 })

  const where = direction === "received" ? { toId: userId } : { fromId: userId }
  const referrals = await db.referral.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      from: { select: { id: true, name: true, city: true } },
      to: { select: { id: true, name: true, city: true, specialization: true } },
    },
  })
  return NextResponse.json({ referrals })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fromId, toId, patientName, purpose, commission } = body
    if (!fromId || !toId || !patientName) {
      return NextResponse.json({ error: "fromId, toId, patientName required" }, { status: 400 })
    }
    const referral = await db.referral.create({
      data: {
        fromId,
        toId,
        patientName,
        purpose: purpose || "",
        commission: Number(commission) || 0,
      },
    })
    return NextResponse.json({ referral })
  } catch (e) {
    console.error("referral create error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
