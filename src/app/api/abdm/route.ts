import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateOtp } from "@/lib/crypto"

/**
 * MoM Point 11 — ABDM (Ayushman Bharat Digital Mission) integration.
 *
 * Two flows:
 *   1. POST { mode: "send_otp", patientId, abhaInput }
 *        abhaInput = Aadhaar number OR mobile number OR existing 14-digit ABHA.
 *        → sends OTP via ABDM gateway, returns txnId (sandbox: demoOtp).
 *
 *   2. POST { mode: "verify_otp", patientId, txnId, otp }
 *        → verifies OTP, creates AbdmLink + sets Account.abdmId.
 *
 *   3. GET  ?patientId=...  → returns the patient's AbdmLink(s).
 *
 *   4. DELETE ?id=...  → unlink ABHA.
 *
 * Production: ABDM Health ID Gateway API
 *   - https://healthids.abdm.gov.in/api/v1/registration/aadhaar/getOtp
 *   - https://healthids.abdm.gov.in/api/v1/registration/aadhaar/verifyOtp
 *   - https://healthids.abdm.gov.in/api/v1/search/healthId
 * Sandbox: format validation + demo OTP.
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get("patientId")
  if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 })

  const links = await db.abdmLink.findMany({
    where: { patientId },
    orderBy: { linkedAt: "desc" },
  })
  return NextResponse.json({ links })
}

export async function POST(req: NextRequest) {
  try {
    const { mode, patientId, abhaInput, txnId, otp } = await req.json()
    if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 })

    // ─── Step 1: Send OTP ───
    if (mode === "send_otp") {
      if (!abhaInput) return NextResponse.json({ error: "abhaInput required" }, { status: 400 })

      // Accept Aadhaar (12 digits), mobile (10 digits), or ABHA (14 digits)
      const cleaned = String(abhaInput).replace(/\s+/g, "")
      let inputType: "AADHAAR" | "MOBILE" | "ABHA"
      if (/^\d{12}$/.test(cleaned)) inputType = "AADHAAR"
      else if (/^\d{10}$/.test(cleaned)) inputType = "MOBILE"
      else if (/^\d{14}$/.test(cleaned)) inputType = "ABHA"
      else return NextResponse.json({ error: "Invalid input — expected 10-digit mobile, 12-digit Aadhaar, or 14-digit ABHA" }, { status: 422 })

      const code = generateOtp()
      const txn = `ABDM-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`

      await db.otpStore.create({
        data: {
          identifier: `${patientId}|ABDM|${cleaned.slice(-4)}`,
          code,
          purpose: "ABDM_LINK",
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      })

      // ─── production hook (ABDM Gateway) ───
      // const gateway = await fetch("https://healthids.abdm.gov.in/api/v1/registration/aadhaar/getOtp", {
      //   method: "POST",
      //   headers: { Authorization: `Bearer ${process.env.ABDM_ACCESS_TOKEN}` },
      //   body: JSON.stringify({ aadhaar: cleaned }),
      // })

      return NextResponse.json({
        ok: true,
        txnId: txn,
        inputType,
        masked:
          inputType === "AADHAAR" ? `xxxx-xxxx-${cleaned.slice(-4)}` :
          inputType === "MOBILE" ? `xxxxxx${cleaned.slice(-4)}` :
          `xxxxxxxx${cleaned.slice(-4)}`,
        demoOtp: code, // sandbox only
        message: `OTP sent to the mobile linked with your ${inputType}.`,
      })
    }

    // ─── Step 2: Verify OTP + create ABHA link ───
    if (mode === "verify_otp") {
      if (!otp) return NextResponse.json({ error: "otp required" }, { status: 400 })

      const record = await db.otpStore.findFirst({
        where: {
          identifier: { startsWith: patientId + "|ABDM|" },
          purpose: "ABDM_LINK",
          consumed: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      })

      if (!record) {
        return NextResponse.json({ error: "OTP expired — request a new one" }, { status: 422 })
      }
      if (record.code !== otp) {
        const attempts = record.attempts + 1
        await db.otpStore.update({
          where: { id: record.id },
          data: {
            attempts,
            lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
          },
        })
        return NextResponse.json({ error: `Incorrect OTP. ${5 - attempts} attempts remaining.` }, { status: 422 })
      }

      await db.otpStore.update({ where: { id: record.id }, data: { consumed: true } })

      // Generate a synthetic 14-digit ABHA number (production: returned by ABDM gateway)
      const abhaNumber = String(
        Math.floor(91000000000000 + Math.random() * 9999999999)
      ).padStart(14, "0").slice(0, 14)

      const patient = await db.account.findUnique({ where: { id: patientId } })

      const link = await db.abdmLink.create({
        data: {
          patientId,
          abhaNumber,
          healthId: `${patient?.name?.toLowerCase().replace(/[^a-z]/g, "")?.slice(0, 8) || "user"}@abdm`,
          nameOnAbha: patient?.name || null,
          genderOnAbha: patient?.gender || null,
          yearOfBirth: patient?.dateOfBirth ? new Date(patient.dateOfBirth).getFullYear() : null,
          mobileOnAbha: patient?.mobile || null,
          authMethod: "MOBILE_OTP",
          status: "LINKED",
        },
      })

      await db.account.update({
        where: { id: patientId },
        data: { abdmId: abhaNumber },
      })

      return NextResponse.json({ ok: true, link })
    }

    return NextResponse.json({ error: "Unknown mode" }, { status: 400 })
  } catch (e) {
    console.error("abdm error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const link = await db.abdmLink.findUnique({ where: { id } })
  if (link) {
    await db.account.update({
      where: { id: link.patientId },
      data: { abdmId: null },
    })
  }
  await db.abdmLink.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
