import { NextRequest, NextResponse } from "next/server"
import { transcribeAudio } from "@/lib/ai-client"
import { db } from "@/lib/db"

/**
 * MoM Point 12 — Voice recording → AI transcription + categorization.
 *
 * Accepts:
 *   { audioBase64, mimeType, patientId, language? }
 *
 * Pipeline:
 *   1. ASR (z-ai-web-dev-sdk in sandbox / Web Speech API on Vercel) → transcript
 *   2. LLM → categorize (SYMPTOM | MEDICATION | APPOINTMENT_NOTE | EMERGENCY | GENERAL)
 *   3. LLM → summary + suggestedActions
 *   4. Persist as VoiceMemo
 *
 * Returns: { transcript, category, summary, suggestedActions, memoId }
 */
export async function POST(req: NextRequest) {
  try {
    const { audioBase64, mimeType, patientId, language, clientTranscript } = await req.json()
    if (!patientId) {
      return NextResponse.json(
        { error: "patientId required" },
        { status: 400 }
      )
    }

    // ─── Step 1: Get transcript ───
    // On Vercel, the frontend uses Web Speech API (browser-based) and sends
    // the transcript as `clientTranscript`. On sandbox, we use server-side ASR.
    let transcript = ""

    if (clientTranscript && clientTranscript.length > 3) {
      // Frontend already transcribed via Web Speech API (Vercel mode)
      transcript = clientTranscript.trim()
    } else if (audioBase64) {
      // Sandbox mode — use server-side ASR
      try {
        transcript = await transcribeAudio(audioBase64, mimeType, language)
      } catch (asrErr) {
        const msg = asrErr instanceof Error ? asrErr.message : String(asrErr)
        return NextResponse.json(
          {
            error:
              "Server-side transcription not available on this deployment. Please use browser-based voice input (Web Speech API). The frontend already supports this — just click the mic button and speak.",
            detail: msg,
            useWebSpeech: true,
          },
          { status: 501 }
        )
      }
    } else {
      return NextResponse.json(
        { error: "Either audioBase64 (sandbox) or clientTranscript (Vercel) is required" },
        { status: 400 }
      )
    }

    if (!transcript || transcript.length < 3) {
      return NextResponse.json({ error: "Transcription was empty" }, { status: 422 })
    }

    // ─── Step 2 + 3: Categorize + summarize + suggest actions ───
    // Lazy import to avoid loading SDK in Vercel
    const { chatComplete } = await import("@/lib/ai-client")
    const raw = await chatComplete(
      [
        {
          role: "system",
          content:
            "You are a clinical assistant. Analyze the patient's voice memo transcript and respond as strict JSON with this shape: " +
            '{"category":"SYMPTOM|MEDICATION|APPOINTMENT_NOTE|EMERGENCY|GENERAL","summary":"<2-3 sentence summary>","suggestedActions":["<action 1>","<action 2>"]}. ' +
            "Set category to EMERGENCY if the transcript mentions chest pain, severe bleeding, breathing difficulty, unconsciousness, stroke symptoms, or suicidal thoughts. " +
            "Keep suggestedActions practical and specific to the Indian healthcare context.",
        },
        {
          role: "user",
          content: `Transcript: "${transcript}"`,
        },
      ],
      { model: "glm-4-flash" }
    )

    let category = "GENERAL"
    let summary = ""
    let suggestedActions: string[] = []
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        category = parsed.category || "GENERAL"
        summary = parsed.summary || ""
        suggestedActions = Array.isArray(parsed.suggestedActions)
          ? parsed.suggestedActions
          : []
      }
    } catch {
      summary = raw.slice(0, 500)
    }

    // ─── Step 4: Persist ───
    const memo = await db.voiceMemo.create({
      data: {
        patientId,
        transcript,
        durationSec: 0,
        language: language || "en-IN",
        category,
        summary,
        suggestedActions: JSON.stringify(suggestedActions),
      },
    })

    return NextResponse.json({
      ok: true,
      memoId: memo.id,
      transcript,
      category,
      summary,
      suggestedActions,
      isEmergency: category === "EMERGENCY",
    })
  } catch (e) {
    console.error("ai/transcribe error", e)
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { error: "Failed to transcribe audio", detail: message },
      { status: 500 }
    )
  }
}
