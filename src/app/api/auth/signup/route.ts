import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashPassword, generateOtp } from "@/lib/crypto"
import { validatePassword } from "@/lib/password"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      role,
      email,
      mobile,
      password,
      name,
      govtIdType,
      govtIdNumber,
      // MoM — Aadhaar & Driving License for doctors/hospitals
      aadhaarNumber,
      drivingLicenseNumber,
      addressLine,
      landmark,
      city,
      state,
      pincode,
      lat,
      lng,
      // patient
      bloodGroup,
      emergencyName,
      emergencyMobile,
      // doctor / org
      membershipNumber,
      bedCount,
      capacityPerHour,
      specialization,
      serverLoginUser,
      serverLoginPass,
      // insurance (patient, optional)
      insurance,
      biometricEnrolled,
    } = body

    // Basic validation
    if (!email || !mobile || !password || !name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const pwCheck = validatePassword(password)
    if (!pwCheck.valid) {
      return NextResponse.json(
        { error: "Password requirements not met", details: pwCheck.errors },
        { status: 400 }
      )
    }

    const existing = await db.account.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      )
    }

    const passwordHash = hashPassword(password)

    const account = await db.account.create({
      data: {
        role,
        email,
        mobile,
        passwordHash,
        name,
        govtIdType: govtIdType || null,
        govtIdNumber: govtIdNumber || null,
        aadhaarNumber: aadhaarNumber || null,
        drivingLicenseNumber: drivingLicenseNumber || null,
        addressLine,
        landmark: landmark || null,
        city,
        state,
        pincode,
        lat: lat != null ? String(lat) : null,
        lng: lng != null ? String(lng) : null,
        bloodGroup: bloodGroup || null,
        emergencyName: emergencyName || null,
        emergencyMobile: emergencyMobile || null,
        membershipNumber: membershipNumber || null,
        bedCount: bedCount ? Number(bedCount) : null,
        capacityPerHour: capacityPerHour ? Number(capacityPerHour) : null,
        specialization: specialization || null,
        serverLoginUser: serverLoginUser || null,
        serverLoginPass: serverLoginPass || null,
        biometricEnrolled: !!biometricEnrolled,
        insurance:
          insurance && role === "PATIENT"
            ? {
                create: {
                  providerName: insurance.providerName,
                  policyNumber: insurance.policyNumber,
                  insuranceType: insurance.insuranceType,
                  amountCovered: Number(insurance.amountCovered) || 0,
                  medicalPremium: Number(insurance.medicalPremium) || 0,
                  coverageDetails: insurance.coverageDetails || "",
                  termsUrl: insurance.termsUrl || null,
                  premiumDueDate: insurance.premiumDueDate
                    ? new Date(insurance.premiumDueDate)
                    : null,
                },
              }
            : undefined,
      },
      include: { insurance: true },
    })

    // Generate a simple session token
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
    console.error("signup error", e)
    return NextResponse.json(
      { error: "Server error during signup", detail: String(e) },
      { status: 500 }
    )
  }
}
