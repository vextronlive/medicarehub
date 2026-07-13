import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// List doctors/orgs for recommendations, with their avg rating
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const role = searchParams.get("role") || "DOCTOR"
  const city = searchParams.get("city")
  const specialization = searchParams.get("specialization")

  const where: Record<string, unknown> = { role }
  if (city) where.city = city
  if (specialization) where.specialization = specialization

  const accounts = await db.account.findMany({
    where,
    include: {
      ratings: { select: { score: true } },
    },
  })

  const list = accounts.map((a) => {
    const avg =
      a.ratings.length > 0
        ? a.ratings.reduce((s, r) => s + r.score, 0) / a.ratings.length
        : 0
    return {
      id: a.id,
      name: a.name,
      specialization: a.specialization,
      city: a.city,
      state: a.state,
      bedCount: a.bedCount,
      capacityPerHour: a.capacityPerHour,
      avgRating: Number(avg.toFixed(2)),
      ratingCount: a.ratings.length,
    }
  })

  list.sort((a, b) => b.avgRating - a.avgRating)

  return NextResponse.json({ doctors: list })
}
