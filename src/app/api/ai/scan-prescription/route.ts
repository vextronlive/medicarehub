import { NextRequest, NextResponse } from "next/server"
import { visionComplete } from "@/lib/ai-client"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { imageBase64, mimeType } = body
    if (!imageBase64) {
      return NextResponse.json({ error: "imageBase64 required" }, { status: 400 })
    }

    const dataUrl = `data:${mimeType || "image/jpeg"};base64,${imageBase64}`

    const text = await visionComplete(
      [
        {
          role: "system",
          content:
            "You are an expert medical transcription assistant. Carefully read the prescription image and extract all information in a clean structured format. Identify: patient name (if visible), date, doctor name, diagnosis, and a list of medicines with dosage, frequency and duration. Respond in clear markdown.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Please read and transcribe this prescription." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      { model: "glm-4v-flash" }
    )

    return NextResponse.json({
      result: text || "I could not read the prescription clearly. Please try a clearer image.",
    })
  } catch (e) {
    console.error("scan-prescription error", e)
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { error: "Failed to scan prescription", detail: message },
      { status: 500 }
    )
  }
}
