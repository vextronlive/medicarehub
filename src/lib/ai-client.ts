/**
 * Hybrid AI client — Gemini (primary) with z-ai-web-dev-sdk fallback.
 *
 * Strategy:
 *   1. Try Google Gemini API first (GEMINI_API_KEY env var).
 *      → Works on Vercel (US/EU servers) and anywhere Gemini is available.
 *   2. If Gemini fails (e.g. geo-blocked region, key missing, quota),
 *      fall back to z-ai-web-dev-sdk — which works in the Z.ai sandbox.
 *
 * This means:
 *   - On Vercel (production): Gemini is used for ALL AI features. ✅
 *   - In sandbox: Gemini is geo-blocked, so z-ai SDK is used. ✅
 *   - Both paths produce the same function signatures so route handlers
 *     don't need to change.
 *
 * Gemini API format:
 *   POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 *   Header: X-goog-api-key: {GEMINI_API_KEY}
 *   Body:  { system_instruction, contents: [{role, parts}], generationConfig }
 */

// ────────────────────────────────────────────────────────
// Public types (kept compatible with existing route code)
// ────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >
}

export interface ChatCompletionResponse {
  choices: Array<{
    message: { content: string }
    finish_reason: string
  }>
}

export interface AsrResponse {
  text: string
}

// ────────────────────────────────────────────────────────
// Gemini API helpers
// ────────────────────────────────────────────────────────

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"

/** Default Gemini model. Can be overridden per-call via options.model. */
const DEFAULT_MODEL = "gemini-flash-latest"

/**
 * Map legacy model names (glm-4-flash, glm-4v-flash) to Gemini equivalents.
 * Callers in route handlers still pass the old names; we silently upgrade.
 */
function resolveModel(requested?: string): string {
  if (!requested) return DEFAULT_MODEL
  const m = requested.toLowerCase()
  if (m.startsWith("glm-4v")) return "gemini-flash-latest" // vision-capable
  if (m.startsWith("glm-4")) return "gemini-flash-latest"
  if (m.startsWith("gemini-")) return requested
  return DEFAULT_MODEL
}

/** Gemini part types — text or inline_data (image/audio). */
type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } }

interface GeminiContent {
  role: "user" | "model"
  parts: GeminiPart[]
}

/**
 * Convert an OpenAI-style ChatMessage[] into Gemini's contents[] + system_instruction.
 * - system role → system_instruction
 * - user role   → { role: "user", parts: [...] }
 * - assistant   → { role: "model", parts: [...] }
 * - string content → single text part
 * - array content  → text parts + inline_data parts (for image_url data URLs)
 */
function toGeminiContents(messages: ChatMessage[]): {
  systemInstruction: string | undefined
  contents: GeminiContent[]
} {
  let systemInstruction: string | undefined
  const contents: GeminiContent[] = []

  for (const msg of messages) {
    if (msg.role === "system") {
      const text =
        typeof msg.content === "string"
          ? msg.content
          : msg.content
              .filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map((p) => p.text)
              .join("\n")
      systemInstruction = systemInstruction
        ? `${systemInstruction}\n\n${text}`
        : text
      continue
    }

    const role: "user" | "model" = msg.role === "assistant" ? "model" : "user"
    const parts: GeminiPart[] = []

    if (typeof msg.content === "string") {
      parts.push({ text: msg.content })
    } else {
      for (const p of msg.content) {
        if (p.type === "text") {
          parts.push({ text: p.text })
        } else if (p.type === "image_url") {
          // Parse data URL: "data:image/jpeg;base64,...."
          const match = p.image_url.url.match(/^data:([^;]+);base64,(.*)$/)
          if (match) {
            parts.push({
              inline_data: { mime_type: match[1], data: match[2] },
            })
          } else {
            parts.push({ text: `[image url: ${p.image_url.url}]` })
          }
        }
      }
    }

    contents.push({ role, parts })
  }

  return { systemInstruction, contents }
}

/** Extract text from Gemini's response shape. */
function extractGeminiText(data: unknown): string {
  const d = data as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
      finishReason?: string
    }>
    promptFeedback?: { blockReason?: string }
  }
  const candidate = d?.candidates?.[0]
  const text = candidate?.content?.parts
    ?.map((p) => p.text || "")
    .join("")
    .trim()
  if (text) return text
  if (d?.promptFeedback?.blockReason) {
    return `[Response blocked: ${d.promptFeedback.blockReason}]`
  }
  return ""
}

/** Core call to Gemini generateContent endpoint. */
async function geminiGenerate(
  model: string,
  systemInstruction: string | undefined,
  contents: GeminiContent[],
  generationConfig?: { temperature?: number; maxOutputTokens?: number }
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY env var is required")
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: generationConfig?.temperature ?? 0.7,
      maxOutputTokens: generationConfig?.maxOutputTokens ?? 2048,
    },
  }
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] }
  }

  const url = `${GEMINI_BASE}/models/${model}:generateContent`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    const err = new Error(
      `Gemini API failed (${res.status} ${res.statusText}): ${errText.slice(0, 400)}`
    ) as Error & { geminiBlocked?: boolean }
    // Geo-block (412/400 FAILED_PRECONDITION) → mark for fallback
    if (
      res.status === 400 &&
      (errText.includes("location is not supported") ||
        errText.includes("FAILED_PRECONDITION"))
    ) {
      err.geminiBlocked = true
    }
    throw err
  }

  const data = await res.json()
  return extractGeminiText(data)
}

// ────────────────────────────────────────────────────────
// Sandbox fallback (z-ai-web-dev-sdk)
// ────────────────────────────────────────────────────────

function isSandbox(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs")
    return (
      fs.existsSync("/etc/.z-ai-config") ||
      fs.existsSync("/home/z/.z-ai-config") ||
      fs.existsSync(`${process.cwd()}/.z-ai-config`)
    )
  } catch {
    return false
  }
}

/** Fallback chat via z-ai-web-dev-sdk (sandbox only). */
async function sandboxChat(
  messages: ChatMessage[],
  temperature: number
): Promise<string> {
  const { getZAI } = await import("./zai-sandbox")
  const zai = await getZAI()
  const res = await zai.chat.completions.create({
    messages: messages as never,
    temperature,
  })
  return res?.choices?.[0]?.message?.content || ""
}

/** Fallback vision via z-ai-web-dev-sdk (sandbox only). */
async function sandboxVision(messages: ChatMessage[]): Promise<string> {
  const { getZAI } = await import("./zai-sandbox")
  const zai = await getZAI()
  const res = await zai.chat.completions.createVision({
    messages: messages as never,
    thinking: { type: "disabled" },
  })
  return res?.choices?.[0]?.message?.content || ""
}

// ────────────────────────────────────────────────────────
// Public API (used by all route handlers)
// ────────────────────────────────────────────────────────

/**
 * Send a chat completion request (text-only).
 * Tries Gemini first; falls back to z-ai SDK in sandbox if Gemini is blocked.
 */
export async function chatComplete(
  messages: ChatMessage[],
  options?: { model?: string; temperature?: number }
): Promise<string> {
  const temperature = options?.temperature ?? 0.7

  // Try Gemini first
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = resolveModel(options?.model)
      const { systemInstruction, contents } = toGeminiContents(messages)
      const text = await geminiGenerate(model, systemInstruction, contents, {
        temperature,
      })
      if (text) return text
    } catch (e) {
      const err = e as Error & { geminiBlocked?: boolean }
      // If geo-blocked AND in sandbox, fall back to z-ai SDK.
      if (err.geminiBlocked && isSandbox()) {
        console.warn("[ai-client] Gemini geo-blocked in sandbox, falling back to z-ai SDK")
        return sandboxChat(messages, temperature)
      }
      // Otherwise rethrow (real error: bad key, quota, etc.)
      throw e
    }
  }

  // No Gemini key — use sandbox SDK if available
  if (isSandbox()) {
    return sandboxChat(messages, temperature)
  }

  throw new Error(
    "No AI provider configured. Set GEMINI_API_KEY (recommended) for Gemini, or run in the Z.ai sandbox."
  )
}

/**
 * Send a vision chat completion (image + text).
 * Tries Gemini first; falls back to z-ai SDK in sandbox if Gemini is blocked.
 */
export async function visionComplete(
  messages: ChatMessage[],
  options?: { model?: string }
): Promise<string> {
  // Try Gemini first
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = resolveModel(options?.model)
      const { systemInstruction, contents } = toGeminiContents(messages)
      const text = await geminiGenerate(model, systemInstruction, contents, {
        temperature: 0.4,
      })
      if (text) return text
    } catch (e) {
      const err = e as Error & { geminiBlocked?: boolean }
      if (err.geminiBlocked && isSandbox()) {
        console.warn("[ai-client] Gemini geo-blocked in sandbox, falling back to z-ai SDK")
        return sandboxVision(messages)
      }
      throw e
    }
  }

  // No Gemini key — use sandbox SDK if available
  if (isSandbox()) {
    return sandboxVision(messages)
  }

  throw new Error(
    "No AI provider configured. Set GEMINI_API_KEY (recommended) for Gemini, or run in the Z.ai sandbox."
  )
}

/**
 * Transcribe audio.
 *   1. Try Gemini multimodal (audio inline_data) — works on Vercel.
 *   2. Fall back to z-ai-web-dev-sdk ASR in sandbox.
 *   3. Frontend should also use Web Speech API as a client-side fallback.
 */
export async function transcribeAudio(
  audioBase64: string,
  mimeType?: string,
  _language?: string
): Promise<string> {
  // Primary path — Gemini multimodal transcription
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = "gemini-flash-latest"
      const mime = mimeType || "audio/webm"

      const contents: GeminiContent[] = [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: mime, data: audioBase64 } },
            {
              text: "Transcribe this audio clip accurately. Return ONLY the spoken text, nothing else. If the audio is empty or unintelligible, return an empty string.",
            },
          ],
        },
      ]

      const text = await geminiGenerate(model, undefined, contents, {
        temperature: 0.1,
      })
      if (text) return text.trim()
    } catch (e) {
      const err = e as Error & { geminiBlocked?: boolean }
      if (!err.geminiBlocked || !isSandbox()) throw e
      console.warn("[ai-client] Gemini ASR geo-blocked in sandbox, falling back to z-ai SDK")
    }
  }

  // Fallback — sandbox z-ai-web-dev-sdk ASR
  if (isSandbox()) {
    const { getZAI } = await import("./zai-sandbox")
    const zai = await getZAI()
    const res = await zai.audio.asr.create({ file_base64: audioBase64 })
    return ((res as { text?: string })?.text || "").trim()
  }

  throw new Error(
    "Audio transcription unavailable. Set GEMINI_API_KEY for Gemini-based transcription."
  )
}
