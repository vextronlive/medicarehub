import ZAI from "z-ai-web-dev-sdk"
import fs from "fs"
import os from "os"
import path from "path"

/**
 * Vercel-safe ZAI SDK loader.
 *
 * The z-ai-web-dev-sdk reads from a `.z-ai-config` JSON file located in:
 *   1. process.cwd()/.z-ai-config
 *   2. os.homedir()/.z-ai-config
 *   3. /etc/.z-ai-config
 *
 * On Vercel serverless, none of these locations are writable at runtime
 * (the filesystem is read-only except /tmp). So we:
 *   1. Check if a config file already exists (local dev / sandbox).
 *   2. If not, create one in /tmp from ZAI_API_KEY + ZAI_BASE_URL env vars.
 *   3. Set HOME=/tmp so the SDK finds it via os.homedir().
 *
 * Usage (replace `await ZAI.create()` with `await getZAI()`):
 *   import { getZAI } from "@/lib/zai"
 *   const zai = await getZAI()
 */

let cached: Awaited<ReturnType<typeof ZAI.create>> | null = null

export async function getZAI() {
  if (cached) return cached

  const configPaths = [
    path.join(process.cwd(), ".z-ai-config"),
    path.join(os.homedir(), ".z-ai-config"),
    "/etc/.z-ai-config",
  ]

  const configExists = configPaths.some((p) => {
    try {
      return fs.existsSync(p)
    } catch {
      return false
    }
  })

  // On Vercel (no config file) — create one in /tmp from env vars
  if (!configExists) {
    const apiKey = process.env.ZAI_API_KEY
    const baseUrl = process.env.ZAI_BASE_URL || "https://internal-api.z.ai/v1"

    if (!apiKey) {
      throw new Error(
        "ZAI_API_KEY environment variable is required. Set it on Vercel dashboard."
      )
    }

    const tmpDir = "/tmp"
    try {
      fs.mkdirSync(tmpDir, { recursive: true })
    } catch {
      /* exists */
    }
    const tmpConfig = path.join(tmpDir, ".z-ai-config")
    fs.writeFileSync(
      tmpConfig,
      JSON.stringify({ apiKey, baseUrl })
    )

    // Point HOME at /tmp so the SDK's config loader finds our file
    process.env.HOME = tmpDir
    process.env.USERPROFILE = tmpDir
  }

  cached = await ZAI.create()
  return cached
}
