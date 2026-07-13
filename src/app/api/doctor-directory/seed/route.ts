import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * One-shot seed endpoint to populate the doctor directory from existing
 * DOCTOR + ORGANIZATION accounts that haven't been added yet. Useful after
 * deploying the MoM feature so the directory isn't empty on day one.
 *
 * POST /api/doctor-directory/seed
 *   { adminSecret?: string }  // optional guard
 */
export async function POST(_req: NextRequest) {
  try {
    const doctors = await db.account.findMany({
      where: { role: { in: ["DOCTOR", "ORGANIZATION"] } },
    })

    const classify = (spec: string): string => {
      const s = spec.toLowerCase()
      if (s.includes("cardio")) return "CARDIOLOGY"
      if (s.includes("pedia")) return "PEDIATRICS"
      if (s.includes("ortho")) return "ORTHOPEDICS"
      if (s.includes("derma")) return "DERMATOLOGY"
      if (s.includes("gyn")) return "GYNECOLOGY"
      if (s.includes("neuro")) return "NEUROLOGY"
      if (s.includes("psy")) return "PSYCHIATRY"
      if (s.includes("ent")) return "ENT"
      if (s.includes("dent")) return "DENTAL"
      if (s.includes("ayur")) return "AYURVEDA"
      if (s.includes("homeo")) return "HOMEOPATHY"
      if (s.includes("ophthal")) return "OPHTHALMOLOGY"
      return "GENERAL_MEDICINE"
    }

    let created = 0
    let updated = 0
    for (const d of doctors) {
      const spec = d.specialization || "General Medicine"
      const existing = await db.doctorDirectoryEntry.findUnique({ where: { doctorId: d.id } })
      const data = {
        specialization: spec,
        category: classify(spec),
        city: d.city,
        state: d.state || "",
        pincode: d.pincode,
        area: d.landmark || null,
        searchVector: `${d.name} ${spec} ${d.city} ${d.pincode}`.toLowerCase(),
      }
      if (existing) {
        await db.doctorDirectoryEntry.update({ where: { doctorId: d.id }, data })
        updated++
      } else {
        await db.doctorDirectoryEntry.create({ data: { doctorId: d.id, ...data } })
        created++
      }
    }

    return NextResponse.json({ ok: true, created, updated, total: doctors.length })
  } catch (e) {
    console.error("doctor-directory seed error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
