import { NextRequest, NextResponse } from "next/server"
import { chatComplete } from "@/lib/ai-client"

export async function POST(req: NextRequest) {
  try {
    const { records, patientName } = await req.json()
    if (!records || !Array.isArray(records)) {
      return NextResponse.json({ error: "records array required" }, { status: 400 })
    }

    const recordsText = records
      .slice(0, 12)
      .map((r: Record<string, unknown>, i: number) => {
        return `${i + 1}. Date: ${r.visitDate || "N/A"} | Visit: ${r.visitType || "N/A"} | Clinic: ${r.clinicName || "N/A"} | Specialization: ${r.specialization || "N/A"} | Diagnosis: ${r.diagnosis || "N/A"} | Notes: ${r.doctorsNotes || "N/A"} | Prescription: ${r.prescription || "N/A"}`
      })
      .join("\n")

    const text = await chatComplete(
      [
        {
          role: "system",
          content:
            "You are a compassionate AI health assistant. Given a patient's medical records, produce a concise health summary with: (1) Key health trends, (2) Recurring conditions, (3) Practical, safe lifestyle & precaution suggestions. Keep it friendly, non-alarmist, and clearly state this is not a substitute for professional medical advice. Use markdown with headers and bullet points. Note: this summary is generated with the patient's consent and stored securely.",
        },
        {
          role: "user",
          content: `Patient: ${patientName || "Patient"}\n\nMedical records:\n${recordsText}\n\nGenerate the health summary.`,
        },
      ],
      { model: "glm-4-flash" }
    )

    return NextResponse.json({ result: text || "Unable to generate a summary at this time." })
  } catch (e) {
    console.error("health-summary error", e)
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { error: "Failed to generate health summary", detail: message },
      { status: 500 }
    )
  }
}
