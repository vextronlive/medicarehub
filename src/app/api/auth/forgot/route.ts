import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashPassword } from "@/lib/crypto"
import { validatePassword } from "@/lib/password"

// Reset password after OTP verification
export async function POST(req: NextRequest) {
  try {
    const { identifier, newPassword } = await req.json()
    if (!identifier || !newPassword) {
      return NextResponse.json(
        { error: "identifier and newPassword required" },
        { status: 400 }
      )
    }

    const pwCheck = validatePassword(newPassword)
    if (!pwCheck.valid) {
      return NextResponse.json(
        { error: "Password requirements not met", details: pwCheck.errors },
        { status: 400 }
      )
    }

    const account = await db.account.findFirst({
      where: { OR: [{ email: identifier }, { mobile: identifier }] },
    })
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    const passwordHash = hashPassword(newPassword)
    await db.account.update({
      where: { id: account.id },
      data: { passwordHash },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("forgot reset error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
