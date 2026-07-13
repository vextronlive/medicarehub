import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { decrypt } from "@/lib/crypto"

/**
 * MoM Point 9 — QR scan endpoint (doctor-only access).
 *
 * Doctors / orgs scan a patient's QR → POST { payload, scannerId }
 * → server decrypts the AES-256-CBC payload, verifies the scanner is
 * a DOCTOR or ORGANIZATION, and returns the patient summary.
 *
 * Patients scanning their own QR see a redacted version.
 */
export async function POST(req: NextRequest) {
  try {
    const { payload, scannerId } = await req.json()
    if (!payload || !scannerId) {
      return NextResponse.json({ error: "payload and scannerId required" }, { status: 400 })
    }

    const scanner = await db.account.findUnique({ where: { id: scannerId } })
    if (!scanner) return NextResponse.json({ error: "Scanner not found" }, { status: 404 })

    // Decrypt the payload — only encrypted payloads from /api/qr/patient can be decrypted
    let plain: string
    try {
      plain = decrypt(payload)
    } catch {
      return NextResponse.json({ error: "Invalid or tampered QR payload" }, { status: 422 })
    }

    let summary: Record<string, unknown>
    try {
      summary = JSON.parse(plain)
    } catch {
      return NextResponse.json({ error: "Malformed QR payload" }, { status: 422 })
    }

    // Look up the patient to enrich with full info for doctors
    const patientId = String(summary.patientId || "")
    const patient = patientId
      ? await db.account.findUnique({
          where: { id: patientId },
          include: {
            patientRecords: {
              take: 10,
              orderBy: { visitDate: "desc" },
              include: { doctor: { select: { name: true } } },
            },
            insurance: true,
          },
        })
      : null

    // Access control — patients scanning get redacted view
    if (scanner.role === "PATIENT") {
      if (!patient || patient.id !== scanner.id) {
        return NextResponse.json(
          { error: "Access denied — only doctors can scan patient QRs." },
          { status: 403 }
        )
      }
      return NextResponse.json({
        ok: true,
        summary: {
          name: summary.name,
          bloodGroup: summary.bloodGroup,
          purpose: summary.purpose,
          generatedAt: summary.generatedAt,
          message: "This is your own QR. Show it to a doctor for check-in.",
        },
      })
    }

    // Doctor / Org — full access
    if (!patient) {
      return NextResponse.json({ error: "Patient not found for this QR" }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      scanner: { id: scanner.id, role: scanner.role, name: scanner.name },
      patient: {
        id: patient.id,
        name: patient.name,
        mobile: patient.mobile,
        email: patient.email,
        bloodGroup: patient.bloodGroup,
        gender: patient.gender,
        dateOfBirth: patient.dateOfBirth,
        addressLine: patient.addressLine,
        city: patient.city,
        state: patient.state,
        pincode: patient.pincode,
        emergencyName: patient.emergencyName,
        emergencyMobile: patient.emergencyMobile,
        insurance: patient.insurance
          ? {
              provider: patient.insurance.providerName,
              policy: patient.insurance.policyNumber,
              type: patient.insurance.insuranceType,
              covered: patient.insurance.amountCovered,
            }
          : null,
      },
      recentRecords: patient.patientRecords.map((r) => ({
        id: r.id,
        visitType: r.visitType,
        visitDate: r.visitDate,
        doctorName: r.doctor.name,
      })),
      qrSummary: summary,
    })
  } catch (e) {
    console.error("qr scan error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
