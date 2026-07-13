import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const toId = searchParams.get("toId")
  const fromId = searchParams.get("fromId")

  // Fetch ratings given BY a user (for marking already-rated appointments)
  if (fromId && !toId) {
    const ratings = await db.rating.findMany({
      where: { fromId },
      orderBy: { createdAt: "desc" },
      include: { to: { select: { id: true, name: true } } },
    })
    return NextResponse.json({ ratings })
  }

  // Fetch ratings received BY a user/doctor (for avg score)
  if (toId) {
    const ratings = await db.rating.findMany({
      where: { toId },
      orderBy: { createdAt: "desc" },
      include: { from: { select: { id: true, name: true } } },
    })
    const avg =
      ratings.length > 0
        ? ratings.reduce((s, r) => s + r.score, 0) / ratings.length
        : 0
    return NextResponse.json({ ratings, avg })
  }
  return NextResponse.json({ error: "toId or fromId required" }, { status: 400 })
}

export async function POST(req: NextRequest) {
  try {
    const { fromId, toId, score, comment } = await req.json()
    if (!fromId || !toId || !score) {
      return NextResponse.json({ error: "fromId, toId, score required" }, { status: 400 })
    }
    const rating = await db.rating.create({
      data: { fromId, toId, score: Number(score), comment: comment || null },
    })
    return NextResponse.json({ rating })
  } catch (e) {
    console.error("rating error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
