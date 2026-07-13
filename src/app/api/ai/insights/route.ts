import { NextRequest, NextResponse } from "next/server"
import { chatComplete } from "@/lib/ai-client"

export async function POST(req: NextRequest) {
  try {
    const { records, period, role } = await req.json()
    if (!records || !Array.isArray(records)) {
      return NextResponse.json({ error: "records array required" }, { status: 400 })
    }

    const recordsText = records
      .slice(0, 25)
      .map((r: Record<string, unknown>, i: number) => {
        return `${i + 1}. ${r.visitDate} | ${r.visitType} | Patient: ${r.patientName || "N/A"} | Spec: ${r.specialization || "N/A"} | Diagnosis: ${r.diagnosis || "N/A"}`
      })
      .join("\n")

    const text = await chatComplete(
      [
        {
          role: "system",
          content:
            "You are a healthcare analytics assistant for " +
            (role === "ORGANIZATION" ? "a healthcare organization" : "a medical practitioner") +
            ". Analyze the patient visit records and provide actionable insights: (1) Patient volume trends, (2) Most common diagnoses / visit types, (3) Peak visit times if inferable, (4) Recommendations to optimize capacity & patient care, (5) Potential referral opportunities. Use clear markdown with headers and bullet points. Be concise but thorough.",
        },
        {
          role: "user",
          content: `Period: ${period || "recent"}\n\nVisit records:\n${recordsText}\n\nGenerate insights and recommendations.`,
        },
      ],
      { model: "glm-4-flash" }
    )

    return NextResponse.json({ result: text || "Unable to generate insights at this time." })
  } catch (e) {
    console.error("insights error", e)
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { error: "Failed to generate insights", detail: message },
      { status: 500 }
    )
  }
}
