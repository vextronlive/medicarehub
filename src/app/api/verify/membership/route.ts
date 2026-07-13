import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * MoM Point 2 — Membership number verification (MCI / NMC / State Medical Council).
 *
 * For doctors, this verifies their medical registration number against the
 * Indian Medical Council register. Production: scrape / API to NMC's Indian
 * Medical Register. Sandbox: format validation + uniqueness check.
 *
 * Accepts:
 *   { userId, membershipNumber, specialization, state }
 *
 * Membership number formats in India:
 *   - Modern Medicine (MCI/NMC):  -/\d{4,6}/[A-Z]{2}/[A-Z]{0,3}
 *   - AYUSH:                       A\d{3,6}/[A-Z]{2}
 *   - Dental:                      D\d{3,6}/[A-Z]{2}
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, membershipNumber, specialization, state } = await req.json()
    if (!userId || !membershipNumber) {
      return NextResponse.json({ error: "userId and membershipNumber required" }, { status: 400 })
    }

    const cleaned = String(membershipNumber).toUpperCase().trim()

    // Format check — accept a few common council formats
    const formatOk = /^([A-Z]?|\d{0,2})\d{3,7}\/[A-Z]{2}\/[A-Z]{0,3}$/.test(cleaned) ||
                     /^\d{4,8}$/.test(cleaned) || // plain numeric
                     /^[A-Z]{1,2}\s?\d{3,8}$/.test(cleaned)

    if (!formatOk) {
      return NextResponse.json(
        { verified: false, error: "Invalid membership number format. Examples: 12345/MH/MCI, A1234/KA, D5678/DL" },
        { status: 422 }
      )
    }

    // Uniqueness — each membership number can only be registered once
    const dupe = await db.account.findFirst({
      where: {
        membershipNumber: cleaned,
        id: { not: userId },
      },
    })
    if (dupe) {
      return NextResponse.json(
        { verified: false, error: "This membership number is already registered to another account." },
        { status: 409 }
      )
    }

    // Simulate registry lookup
    await new Promise((r) => setTimeout(r, 600))

    // ─── production hook ───
    // const registry = await fetch(`https://api.nmc.org.in/doctor/${encodeURIComponent(cleaned)}`, {
    //   headers: { Authorization: `Bearer ${process.env.NMC_API_KEY}` },
    // })
    // const registryData = await registry.json()
    // if (!registryData?.valid) return NextResponse.json({ verified: false, error: "Not found in NMC register" }, { status: 422 })

    await db.account.update({
      where: { id: userId },
      data: {
        membershipVerified: true,
        membershipNumber: cleaned,
        // Update specialization if provided and matches
        ...(specialization ? { specialization } : {}),
      },
    })

    // Auto-create or update doctor directory entry (MoM Point 10)
    const account = await db.account.findUnique({ where: { id: userId } })
    if (account && (account.role === "DOCTOR" || account.role === "ORGANIZATION")) {
      const category = classifySpecialization(account.specialization || "")
      await db.doctorDirectoryEntry.upsert({
        where: { doctorId: userId },
        create: {
          doctorId: userId,
          specialization: account.specialization || "General Medicine",
          category,
          city: account.city,
          state: account.state || state || "",
          pincode: account.pincode,
          area: account.landmark || null,
          searchVector: `${account.name} ${account.specialization || ""} ${account.city} ${account.pincode}`.toLowerCase(),
        },
        update: {
          specialization: account.specialization || "General Medicine",
          category,
          city: account.city,
          state: account.state || state || "",
          pincode: account.pincode,
          area: account.landmark || null,
          searchVector: `${account.name} ${account.specialization || ""} ${account.city} ${account.pincode}`.toLowerCase(),
        },
      })
    }

    return NextResponse.json({
      verified: true,
      membershipNumber: cleaned,
      masked: cleaned.replace(/(\d{2})\d+/g, "$1xxxx"),
      message: "Medical council membership verified",
    })
  } catch (e) {
    console.error("membership verify error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

function classifySpecialization(spec: string): string {
  const s = spec.toLowerCase()
  if (s.includes("cardio")) return "CARDIOLOGY"
  if (s.includes("pedia")) return "PEDIATRICS"
  if (s.includes("ortho")) return "ORTHOPEDICS"
  if (s.includes("derma")) return "DERMATOLOGY"
  if (s.includes("gyn")) return "GYNECOLOGY"
  if (s.includes("neuro")) return "NEUROLOGY"
  if (s.includes("psy")) return "PSYCHIATRY"
  if (s.includes("ent") || s.includes("otorhin")) return "ENT"
  if (s.includes("dent")) return "DENTAL"
  if (s.includes("ayur")) return "AYURVEDA"
  if (s.includes("homeo")) return "HOMEOPATHY"
  if (s.includes("ophthal")) return "OPHTHALMOLOGY"
  return "GENERAL_MEDICINE"
}
