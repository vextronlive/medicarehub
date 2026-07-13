import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// Update account profile (UPI, biometric, etc.)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...patch } = body
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    // Only allow safe fields
    const allowed: Record<string, unknown> = {}
    for (const k of [
      "upiId",
      "biometricEnrolled",
      "addressLine",
      "landmark",
      "city",
      "state",
      "pincode",
      "mobile",
      "specialization",
      // MoM point 5 — blood group now editable from profile (not signup)
      "bloodGroup",
      "emergencyName",
      "emergencyMobile",
      // MoM — additional profile fields
      "gender",
      "dateOfBirth",
      // MoM — Aadhaar & Driving License editable from profile
      "aadhaarNumber",
      "drivingLicenseNumber",
      "govtIdType",
      "govtIdNumber",
    ]) {
      if (k in patch) allowed[k] = patch[k]
    }

    // Convert dateOfBirth string → Date if provided
    if (allowed.dateOfBirth && typeof allowed.dateOfBirth === "string") {
      allowed.dateOfBirth = new Date(allowed.dateOfBirth)
    }

    const account = await db.account.update({
      where: { id },
      data: allowed,
    })

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
        upiId: account.upiId,
        addressLine: account.addressLine,
        landmark: account.landmark,
        pincode: account.pincode,
        // MoM additions
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
        govtIdType: account.govtIdType,
        govtIdNumber: account.govtIdNumber,
      },
    })
  } catch (e) {
    console.error("account update error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// Fetch full account details
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const account = await db.account.findUnique({
    where: { id },
    include: { insurance: true },
  })
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ account })
}
