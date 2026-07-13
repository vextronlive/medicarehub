import { NextRequest, NextResponse } from "next/server"
import { chatComplete } from "@/lib/ai-client"
import { db } from "@/lib/db"

// AI-powered recommendation of nearby top-rated doctors/clinics for a patient
export async function POST(req: NextRequest) {
  try {
    const { city, specialization, symptom } = await req.json()

    const where: Record<string, unknown> = { role: "DOCTOR" }
    if (city) where.city = city
    if (specialization) where.specialization = specialization

    const doctors = await db.account.findMany({
      where,
      include: { ratings: { select: { score: true } } },
      take: 20,
    })

    const ranked = doctors
      .map((d) => {
        const avg =
          d.ratings.length > 0
            ? d.ratings.reduce((s, r) => s + r.score, 0) / d.ratings.length
            : 0
        return {
          id: d.id,
          name: d.name,
          specialization: d.specialization,
          city: d.city,
          state: d.state,
          capacityPerHour: d.capacityPerHour,
          bedCount: d.bedCount,
          avgRating: Number(avg.toFixed(2)),
          ratingCount: d.ratings.length,
        }
      })
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 6)

    // Ask the LLM to add a short advisory note
    let advisory = ""
    try {
      advisory = await chatComplete(
        [
          {
            role: "system",
            content:
              "You are a friendly AI care navigator. Given a patient symptom and a list of top-rated doctors, produce a 2-3 sentence advisory suggesting which specialist to consult and why. Keep it concise and non-alarmist.",
          },
          {
            role: "user",
            content: `Symptom/need: ${symptom || "general checkup"}\nCity: ${city || "any"}\nSpecialization requested: ${specialization || "any"}\nTop doctors:\n${ranked.map((d, i) => `${i + 1}. ${d.name} (${d.specialization}, ${d.city}) - rating ${d.avgRating}`).join("\n")}`,
          },
        ],
        { model: "glm-4-flash" }
      )
      advisory = advisory || "Please consult a specialist matching your symptoms."
    } catch {
      advisory = "Please consult a specialist matching your symptoms."
    }

    return NextResponse.json({ recommendations: ranked, advisory })
  } catch (e) {
    console.error("recommendations error", e)
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { error: "Failed to generate recommendations", detail: message },
      { status: 500 }
    )
  }
}
