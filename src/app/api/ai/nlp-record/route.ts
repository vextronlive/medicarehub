import { NextRequest, NextResponse } from "next/server"
import { chatComplete } from "@/lib/ai-client"

/**
 * MoM Point 7 — NLP for doctor record creation.
 *
 * Doctors (or patients describing a visit) paste a free-text summary like:
 *   "Patient came in with fever 102F and body ache for 3 days. Diagnosed
 *    viral fever. Prescribed paracetamol 500mg TID x5 days, rest, fluids."
 *
 * The endpoint uses the LLM to extract a structured medical record draft:
 *   {
 *     visitType: "CONSULTATION" | "EMERGENCY" | "FOLLOW_UP" | "CHECKUP" | "PROCEDURE",
 *     diagnosis: string,
 *     doctorsNotes: string,
 *     prescription: [{ medicine, dosage, frequency, duration }],
 *     followUpInDays?: number,
 *     redFlags: string[]
 *   }
 *
 * The doctor reviews & confirms before POST /api/records persists it.
 */
export async function POST(req: NextRequest) {
  try {
    const { freeText, context } = await req.json()
    if (!freeText || freeText.length < 5) {
      return NextResponse.json(
        { error: "freeText required (at least a few words)" },
        { status: 400 }
      )
    }

    const raw = await chatComplete(
      [
        {
          role: "system",
          content:
            "You are an expert medical scribe. Convert the doctor's free-text note into a structured JSON medical record. " +
            "Respond as STRICT JSON (no markdown, no code fences) with this exact shape:\n" +
            "{\n" +
            '  "visitType": "CONSULTATION" | "EMERGENCY" | "FOLLOW_UP" | "CHECKUP" | "PROCEDURE",\n' +
            '  "diagnosis": "concise primary diagnosis",\n' +
            '  "doctorsNotes": "clinical observations, vitals if mentioned, differential if any",\n' +
            '  "prescription": [{"medicine":"name","dosage":"e.g. 500mg","frequency":"e.g. TID / twice daily","duration":"e.g. 5 days"}],\n' +
            '  "followUpInDays": null or number,\n' +
            '  "redFlags": ["warning signs the patient should watch for"]\n' +
            "}\n" +
            "If a field is unknown, use empty string or empty array. visitType must be one of the 5 listed values. " +
            "Prescription medications should use Indian generic names where possible (paracetamol, amoxicillin, azithromycin, etc.).",
        },
        {
          role: "user",
          content: `Free-text note:\n"""${freeText}"""\n\nAdditional context: ${context || "none"}`,
        },
      ],
      { model: "glm-4-flash" }
    )

    let parsed: Record<string, unknown> = {}
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json({
        ok: false,
        raw,
        error: "Could not parse structured record — please refine your note.",
      })
    }

    const validTypes = ["CONSULTATION", "EMERGENCY", "FOLLOW_UP", "CHECKUP", "PROCEDURE"]
    if (!validTypes.includes(parsed.visitType as string)) {
      parsed.visitType = "CONSULTATION"
    }
    if (!Array.isArray(parsed.prescription)) parsed.prescription = []
    if (!Array.isArray(parsed.redFlags)) parsed.redFlags = []
    if (parsed.followUpInDays != null) {
      parsed.followUpInDays = Number(parsed.followUpInDays) || null
    }

    return NextResponse.json({
      ok: true,
      draft: parsed,
      raw,
    })
  } catch (e) {
    console.error("ai/nlp-record error", e)
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { error: "Failed to parse medical note", detail: message },
      { status: 500 }
    )
  }
}
