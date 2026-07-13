import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateOtp } from "@/lib/crypto"

// ─────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────
const OTP_TTL_MIN = 10 // OTP validity window
const RESEND_COOLDOWN_SEC = 60 // min seconds between two OTP creates for same identifier+purpose
const MAX_ATTEMPTS = 5 // failed verify attempts before lockout
const LOCKOUT_MIN = 30 // how long an OTP stays locked after too many attempts

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const E164_RE = /^\+?\d{10,15}$/

// ─────────────────────────────────────────────────────────
//  SMS / Email delivery
//  When Twilio is configured (TWILIO_ACCOUNT_SID set), real SMS are sent.
//  Otherwise we fall back to demo mode (return the code in the response).
// ─────────────────────────────────────────────────────────

function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  )
}

function isMsg91Configured(): boolean {
  return !!(process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID)
}

function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

/**
 * Send OTP via SMS (Twilio or MSG91).
 * Returns true if sent successfully, false if it failed.
 * Throws only on unexpected errors.
 */
async function sendOtpSms(mobile: string, code: string): Promise<boolean> {
  const to = mobile.startsWith("+") ? mobile : `+${mobile}`
  const body = `MediCare Hub: Your verification code is ${code}. Valid for ${OTP_TTL_MIN} minutes. Do not share this code with anyone.`

  // Try MSG91 first (cheaper for India)
  if (isMsg91Configured()) {
    try {
      const res = await fetch(`https://api.msg91.com/api/v5/otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authkey: process.env.MSG91_AUTH_KEY!,
        },
        body: JSON.stringify({
          template_id: process.env.MSG91_TEMPLATE_ID,
          mobile: to.replace("+", ""),
          otp: code,
          sender: process.env.MSG91_SENDER_ID || "MEDHUB",
        }),
      })
      return res.ok
    } catch (e) {
      console.error("MSG91 send failed, falling back:", e)
    }
  }

  // Fallback to Twilio
  if (isTwilioConfigured()) {
    try {
      const auth = Buffer.from(
        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
      ).toString("base64")
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${auth}`,
          },
          body: new URLSearchParams({
            From: process.env.TWILIO_PHONE_NUMBER!,
            To: to,
            Body: body,
          }),
        }
      )
      return res.ok
    } catch (e) {
      console.error("Twilio send failed:", e)
      return false
    }
  }

  return false
}

/**
 * Send OTP via email (Resend).
 */
async function sendOtpEmail(email: string, code: string): Promise<boolean> {
  if (!isEmailConfigured()) return false
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "MediCare Hub <noreply@medicarehub.com>",
        to: email,
        subject: `Your MediCare Hub verification code: ${code}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
            <h2 style="color:#10b981;">MediCare Hub</h2>
            <p>Your verification code is:</p>
            <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#10b981;background:#f0fdf4;padding:16px;border-radius:8px;text-align:center;margin:16px 0;">
              ${code}
            </div>
            <p style="color:#666;font-size:14px;">This code expires in ${OTP_TTL_MIN} minutes. Do not share it with anyone.</p>
          </div>
        `,
      }),
    })
    return res.ok
  } catch (e) {
    console.error("Email send failed:", e)
    return false
  }
}

/**
 * Deliver OTP via the appropriate channel (SMS for mobile, email for email).
 * Returns { delivered: boolean, demoCode: string | null }.
 * demoCode is only included when delivery failed or no gateway configured (demo mode).
 */
async function deliverOtp(
  identifier: string,
  code: string
): Promise<{ delivered: boolean; demoCode: string | null }> {
  const isEmail = EMAIL_RE.test(identifier)
  const isMobile = E164_RE.test(identifier)

  if (isEmail) {
    const ok = await sendOtpEmail(identifier, code)
    return { delivered: ok, demoCode: ok ? null : code }
  }

  if (isMobile) {
    const ok = await sendOtpSms(identifier, code)
    return { delivered: ok, demoCode: ok ? null : code }
  }

  // Unknown format — demo mode
  return { delivered: false, demoCode: code }
}


/**
 * Mask an identifier (email or mobile) for safe display in the UI.
 *  - email:    j***n@example.com
 *  - mobile:   +91 98XXX XX123   (or last 3 digits if too short)
 */
function maskIdentifier(identifier: string): string {
  const trimmed = identifier.trim()

  if (EMAIL_RE.test(trimmed)) {
    const [local, domain] = trimmed.split("@")
    if (!local || !domain) return trimmed
    const first = local[0] ?? ""
    const last = local.length > 1 ? local[local.length - 1] : ""
    const maskedLocal =
      local.length <= 2
        ? `${first}*`
        : `${first}${"*".repeat(Math.max(1, local.length - 2))}${last}`
    return `${maskedLocal}@${domain}`
  }

  if (E164_RE.test(trimmed)) {
    // Treat the last 10 digits as the national number; anything before is a
    // country code. Format: [+CC ] NN XXX XX NNN  (matches the spec example
    // "+91 98XXX XX123").
    const hasPlus = trimmed.startsWith("+")
    const digits = trimmed.replace(/\D/g, "")

    if (digits.length >= 10) {
      const national = digits.slice(-10)
      const cc = digits.slice(0, digits.length - 10)
      const ccPart = hasPlus && cc ? `+${cc} ` : ""
      return `${ccPart}${national.slice(0, 2)}XXX XX${national.slice(-3)}`
    }

    // Short numbers — fallback mask (first + stars + last)
    if (digits.length <= 2) return trimmed
    return `${digits[0]}${"*".repeat(
      Math.min(6, digits.length - 2)
    )}${digits[digits.length - 1]}`
  }

  // Fallback: mask middle, keep first & last char
  if (trimmed.length <= 2) return "*"
  return `${trimmed[0]}${"*".repeat(Math.min(6, trimmed.length - 2))}${
    trimmed[trimmed.length - 1]
  }`
}

// ─────────────────────────────────────────────────────────
//  POST — create / resend an OTP
//  Body: { identifier: string, purpose: "SIGNUP" | "FORGOT_PASSWORD" }
//  Returns: { ok, demoCode, maskedIdentifier, expiresAt }
//  429 when an OTP was created for this identifier+purpose within RESEND_COOLDOWN_SEC
// ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { identifier, purpose } = await req.json()
    if (!identifier || !purpose) {
      return NextResponse.json(
        { error: "identifier and purpose required" },
        { status: 400 }
      )
    }

    // For forgot password, ensure the account exists
    if (purpose === "FORGOT_PASSWORD") {
      const account = await db.account.findFirst({
        where: {
          OR: [{ email: identifier }, { mobile: identifier }],
        },
      })
      if (!account) {
        return NextResponse.json(
          { error: "No account found with this identifier" },
          { status: 404 }
        )
      }
    }

    // Rate-limit: most-recent *active* OTP for this identifier+purpose within cooldown.
    // (Locked / consumed OTPs don't count — the user has already been penalized.)
    const recent = await db.otpStore.findFirst({
      where: {
        identifier,
        purpose,
        consumed: false,
        createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_SEC * 1000) },
      },
      orderBy: { createdAt: "desc" },
    })
    if (recent) {
      const elapsedSec = Math.floor((Date.now() - recent.createdAt.getTime()) / 1000)
      const retryAfter = Math.max(1, RESEND_COOLDOWN_SEC - elapsedSec)
      return NextResponse.json(
        {
          error: "Please wait before requesting another code",
          retryAfter,
          maskedIdentifier: maskIdentifier(identifier),
          // Re-send the existing code in demo mode so the user can still verify
          demoCode: recent.code,
          expiresAt: recent.expiresAt.toISOString(),
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      )
    }

    const code = generateOtp()
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000)

    await db.otpStore.create({
      data: { identifier, code, purpose, expiresAt },
    })

    // Deliver the OTP via SMS (mobile) or email. Falls back to demo mode
    // (returns the code in the response) when no gateway is configured.
    const { delivered, demoCode } = await deliverOtp(identifier, code)

    return NextResponse.json({
      ok: true,
      delivered,
      demoCode,
      maskedIdentifier: maskIdentifier(identifier),
      expiresAt: expiresAt.toISOString(),
      resendCooldownSec: RESEND_COOLDOWN_SEC,
    })
  } catch (e) {
    console.error("otp error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────
//  PUT — verify an OTP
//  Body: { identifier, code, purpose }
//  Returns: { ok: true } on success
//  400 { error, attemptsRemaining } on wrong code
//  429 { error, attemptsRemaining: 0, locked: true } when locked / too many attempts
//  400 { error } when expired / not found
// ─────────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const { identifier, code, purpose } = await req.json()
    if (!identifier || !code || !purpose) {
      return NextResponse.json(
        { error: "identifier, code and purpose required" },
        { status: 400 }
      )
    }

    // Pick the most recent unconsumed, unexpired OTP for this identifier+purpose.
    // We deliberately do NOT filter by `code` here so we can increment attempts
    // on the latest OTP regardless of what code the user typed.
    const record = await db.otpStore.findFirst({
      where: {
        identifier,
        purpose,
        consumed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    })

    if (!record) {
      return NextResponse.json(
        {
          error: "Invalid or expired code. Please request a new code.",
          attemptsRemaining: 0,
        },
        { status: 400 }
      )
    }

    // If this OTP has been locked and lockout is still active, refuse.
    const now = new Date()
    if (record.lockedUntil && record.lockedUntil > now) {
      return NextResponse.json(
        {
          error: "Too many attempts. Please request a new code.",
          attemptsRemaining: 0,
          locked: true,
          retryAfter: Math.ceil(
            (record.lockedUntil.getTime() - now.getTime()) / 1000
          ),
        },
        { status: 429 }
      )
    }

    // Correct code → consume and succeed.
    if (record.code === code) {
      await db.otpStore.update({
        where: { id: record.id },
        data: { consumed: true },
      })
      return NextResponse.json({ ok: true })
    }

    // Wrong code → increment attempts; lock if threshold reached.
    const newAttempts = record.attempts + 1
    const remaining = Math.max(0, MAX_ATTEMPTS - newAttempts)

    if (newAttempts >= MAX_ATTEMPTS) {
      await db.otpStore.update({
        where: { id: record.id },
        data: {
          attempts: newAttempts,
          lockedUntil: new Date(Date.now() + LOCKOUT_MIN * 60 * 1000),
          consumed: true, // can't be reused; forces a fresh OTP via POST
        },
      })
      return NextResponse.json(
        {
          error: "Too many attempts. Please request a new code.",
          attemptsRemaining: 0,
          locked: true,
        },
        { status: 429 }
      )
    }

    await db.otpStore.update({
      where: { id: record.id },
      data: { attempts: newAttempts },
    })

    return NextResponse.json(
      {
        error: "Incorrect code. Please try again.",
        attemptsRemaining: remaining,
      },
      { status: 400 }
    )
  } catch (e) {
    console.error("otp verify error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
