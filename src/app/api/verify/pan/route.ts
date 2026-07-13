import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * MoM Point 1 — PAN verification (Income Tax DB / NSDL).
 *
 * In production this would call NSDL's e-filing API or a Surepass/Signzy
 * wrapper. For the sandbox we validate format + mark the Account as
 * `panVerified = true`. A real gateway hook is stubbed below.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, pan } = await req.json()
    if (!userId || !pan) {
      return NextResponse.json({ error: "userId and pan required" }, { status: 400 })
    }

    const cleaned = String(pan).toUpperCase().trim()

    // PAN format: 5 letters, 4 digits, 1 letter — e.g. ABCDE1234F
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
    if (!panRegex.test(cleaned)) {
      return NextResponse.json(
        { verified: false, error: "Invalid PAN format. Should be 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)" },
        { status: 422 }
      )
    }

    // ─── production hook (commented out, requires NSDL/Surepass creds) ───
    // const gatewayRes = await fetch("https://api.surepass.io/api/v1/corporate/pan", {
    //   method: "POST",
    //   headers: { Authorization: `Bearer ${process.env.SUREPASS_TOKEN}` },
    //   body: JSON.stringify({ id_number: cleaned }),
    // })
    // const data = await gatewayRes.json()
    // if (!data?.data?.valid) return NextResponse.json({ verified: false, ...data }, { status: 422 })
    //
    // const nameOnPan = data.data.full_name
    // const account = await db.account.findUnique({ where: { id: userId } })
    // if (account && !account.name.toUpperCase().includes(nameOnPan.toUpperCase().split(" ")[0])) {
    //   return NextResponse.json({ verified: false, error: "Name on PAN does not match account name" }, { status: 422 })
    // }

    // Sandbox: simulate lookup latency + deterministic validity
    await new Promise((r) => setTimeout(r, 700))

    await db.account.update({
      where: { id: userId },
      data: { panVerified: true },
    })

    return NextResponse.json({
      verified: true,
      pan: cleaned,
      masked: `xxxxxxx${cleaned.slice(-4)}`,
      message: "PAN verified successfully",
    })
  } catch (e) {
    console.error("pan verify error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
