import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateOtp } from "@/lib/crypto"

/**
 * MoM Point 3 — Aadhaar verification for appointments / signup.
 *
 * Two-step flow:
 *   1. POST { userId, aadhaar } → sends OTP, returns txnId (sandbox: returns demoOtp)
 *   2. POST { userId, txnId, otp } → verifies OTP, marks aadhaarVerified=true
 *
 * Production: UIDAI's Auth API via NSDL/NeGD. Sandbox: format validation + demo OTP.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, aadhaar, txnId, otp, mode } = body

    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 })

    // ─── Step 1: Send OTP ───
    if (mode === "send" || (!txnId && !otp)) {
      if (!aadhaar) return NextResponse.json({ error: "aadhaar required" }, { status: 400 })

      const cleaned = String(aadhaar).replace(/\s+/g, "")
      if (!/^\d{12}$/.test(cleaned)) {
        return NextResponse.json({ error: "Aadhaar must be 12 digits" }, { status: 422 })
      }

      const code = generateOtp()
      const txn = `AADHAAR-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`

      // Persist OTP against the user (reuse OtpStore with purpose = AADHAAR)
      await db.otpStore.create({
        data: {
          identifier: `${userId}|${cleaned.slice(-4)}`,
          code,
          purpose: "AADHAAR",
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      })

      // ─── production hook ───
      // await fetch("https://api.surepass.io/api/v1/aadhaar/aadhaar-send-otp", {
      //   method: "POST",
      //   headers: { Authorization: `Bearer ${process.env.SUREPASS_TOKEN}` },
      //   body: JSON.stringify({ id_number: cleaned }),
      // })

      return NextResponse.json({
        ok: true,
        txnId: txn,
        demoOtp: code, // sandbox only — production must remove this
        masked: `xxxx-xxxx-${cleaned.slice(-4)}`,
        message: "OTP sent to the mobile number linked with this Aadhaar",
      })
    }

    // ─── Step 2: Verify OTP ───
    if (!txnId || !otp) {
      return NextResponse.json({ error: "txnId and otp required for verify step" }, { status: 400 })
    }

    const record = await db.otpStore.findFirst({
      where: {
        identifier: { startsWith: userId + "|" },
        purpose: "AADHAAR",
        consumed: false,
        lockedUntil: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    })

    if (!record) {
      return NextResponse.json({ verified: false, error: "OTP expired or not found. Please request a new one." }, { status: 422 })
    }

    if (record.code !== otp) {
      const attempts = record.attempts + 1
      const locked = attempts >= 5
      await db.otpStore.update({
        where: { id: record.id },
        data: {
          attempts,
          lockedUntil: locked ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      })
      return NextResponse.json(
        { verified: false, error: `Incorrect OTP. ${5 - attempts} attempts remaining.` },
        { status: 422 }
      )
    }

    await db.otpStore.update({ where: { id: record.id }, data: { consumed: true } })
    await db.account.update({
      where: { id: userId },
      data: { aadhaarVerified: true },
    })

    return NextResponse.json({
      verified: true,
      message: "Aadhaar verified successfully",
    })
  } catch (e) {
    console.error("aadhaar verify error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
