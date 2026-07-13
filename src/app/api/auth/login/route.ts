import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyPassword } from "@/lib/crypto"

export async function POST(req: NextRequest) {
  try {
    const { email, password, biometric } = await req.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const account = await db.account.findUnique({
      where: { email },
      include: { insurance: true },
    })

    if (!account) {
      return NextResponse.json(
        { error: "No account found with this email" },
        { status: 404 }
      )
    }

    // Biometric login shortcut (simulated — trust the client flag in sandbox)
    if (biometric) {
      if (!account.biometricEnrolled) {
        return NextResponse.json(
          { error: "Biometric not enrolled for this account" },
          { status: 400 }
        )
      }
    } else {
      if (!password) {
        return NextResponse.json(
          { error: "Password is required" },
          { status: 400 }
        )
      }
      const ok = verifyPassword(password, account.passwordHash)
      if (!ok) {
        return NextResponse.json(
          { error: "Incorrect password" },
          { status: 401 }
        )
      }
    }

    const token = Buffer.from(`${account.id}:${Date.now()}`).toString("base64")

    return NextResponse.json({
      ok: true,
      user: {
        id: account.id,
        email: account.email,
        mobile: account.mobile,
        role: account.role,
        name: account.name,
        city: account.city,
        state: account.state,
        specialization: account.specialization,
        bloodGroup: account.bloodGroup,
        biometricEnrolled: account.biometricEnrolled,
        // MoM additions
        pincode: account.pincode,
        addressLine: account.addressLine,
        landmark: account.landmark,
        upiId: account.upiId,
        gender: account.gender,
        dateOfBirth: account.dateOfBirth,
        panVerified: account.panVerified,
        aadhaarVerified: account.aadhaarVerified,
        membershipVerified: account.membershipVerified,
        abdmId: account.abdmId,
        emergencyName: account.emergencyName,
        emergencyMobile: account.emergencyMobile,
        membershipNumber: account.membershipNumber,
        bedCount: account.bedCount,
        capacityPerHour: account.capacityPerHour,
        // MoM — new ID fields
        aadhaarNumber: account.aadhaarNumber,
        drivingLicenseNumber: account.drivingLicenseNumber,
      },
      token,
    })
  } catch (e) {
    console.error("login error", e)
    const message = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json(
      { error: "Server error during login", detail: message },
      { status: 500 }
    )
  }
}
