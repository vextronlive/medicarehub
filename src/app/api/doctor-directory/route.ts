import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * MoM Point 10 — Doctor Directory (category + pincode-wise recommendations).
 *
 * GET /api/doctor-directory
 *   ?category=CARDIOLOGY
 *   &specialization=Cardiology
 *   &city=Mumbai
 *   &pincode=400001
 *   &search=...         (free-text — name / specialization / city / pincode)
 *   &limit=20&offset=0
 *   &sort=rating|experience|fee
 *
 * The endpoint also powers the patient Home tab's "Recommended Doctors"
 * section — when called without filters it returns the top-rated doctors
 * near the patient's pincode.
 *
 * POST /api/doctor-directory  → create / update a doctor's directory entry
 *   { doctorId, qualifications, experienceYears, consultationFee, languages }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get("category")
  const specialization = searchParams.get("specialization")
  const city = searchParams.get("city")
  const pincode = searchParams.get("pincode")
  const area = searchParams.get("area")
  const search = searchParams.get("search")?.toLowerCase()
  const limit = Math.min(Number(searchParams.get("limit") || 20), 100)
  const offset = Number(searchParams.get("offset") || 0)
  const sort = searchParams.get("sort") || "rating"

  const where: Record<string, unknown> = { isAvailable: true }
  if (category) where.category = category.toUpperCase()
  if (specialization) where.specialization = { contains: specialization }
  if (city) where.city = { contains: city }
  if (pincode) where.pincode = { startsWith: pincode.slice(0, 3) } // match first 3 digits (postcode area)
  if (area) where.area = { contains: area }
  if (search) {
    where.OR = [
      { searchVector: { contains: search } },
      { specialization: { contains: search } },
      { city: { contains: search } },
    ]
  }

  const orderBy: Record<string, "asc" | "desc"> =
    sort === "experience" ? { experienceYears: "desc" } :
    sort === "fee" ? { consultationFee: "asc" } :
    { rating: "desc" }

  const [entries, total] = await Promise.all([
    db.doctorDirectoryEntry.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            mobile: true,
            email: true,
            addressLine: true,
            landmark: true,
            city: true,
            state: true,
            pincode: true,
            capacityPerHour: true,
            membershipNumber: true,
            membershipVerified: true,
          },
        },
      },
    }),
    db.doctorDirectoryEntry.count({ where }),
  ])

  // If pincode was specified, compute a synthetic distance (ascending sort by pincode match)
  let result = entries
  if (pincode) {
    result = entries.map((e) => ({
      ...e,
      distanceKm: pincodeDistance(pincode, e.pincode),
    })).sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0))
  }

  return NextResponse.json({ doctors: result, total, offset, limit })
}

export async function POST(req: NextRequest) {
  try {
    const {
      doctorId,
      qualifications,
      experienceYears,
      consultationFee,
      languages,
      area,
      category,
    } = await req.json()
    if (!doctorId) return NextResponse.json({ error: "doctorId required" }, { status: 400 })

    const doctor = await db.account.findUnique({ where: { id: doctorId } })
    if (!doctor) return NextResponse.json({ error: "Doctor not found" }, { status: 404 })

    const spec = doctor.specialization || "General Medicine"
    const cat = category || classifySpecialization(spec)

    const entry = await db.doctorDirectoryEntry.upsert({
      where: { doctorId },
      create: {
        doctorId,
        specialization: spec,
        category: cat,
        city: doctor.city,
        state: doctor.state || "",
        pincode: doctor.pincode,
        area: area || doctor.landmark || null,
        qualifications: qualifications || null,
        experienceYears: Number(experienceYears) || 0,
        consultationFee: Number(consultationFee) || 0,
        languages: languages ? JSON.stringify(languages) : null,
        searchVector: `${doctor.name} ${spec} ${doctor.city} ${doctor.pincode}`.toLowerCase(),
      },
      update: {
        qualifications: qualifications || undefined,
        experienceYears: experienceYears != null ? Number(experienceYears) : undefined,
        consultationFee: consultationFee != null ? Number(consultationFee) : undefined,
        languages: languages ? JSON.stringify(languages) : undefined,
        area: area || undefined,
        category: cat,
        searchVector: `${doctor.name} ${spec} ${doctor.city} ${doctor.pincode}`.toLowerCase(),
      },
    })

    return NextResponse.json({ ok: true, entry })
  } catch (e) {
    console.error("doctor directory create error", e)
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

// Crude pincode-distance heuristic (Indian postcodes don't follow a perfect
// geographic pattern, but the first digit groups states, and the first 3
// digits roughly cluster districts). For a real product you'd use Google
// Maps Distance Matrix with the doctor's lat/lng.
function pincodeDistance(p1: string, p2: string): number {
  if (!p1 || !p2) return 0
  if (p1 === p2) return 0
  if (p1.slice(0, 3) === p2.slice(0, 3)) return 2 + Math.abs(Number(p1.slice(3)) - Number(p2.slice(3))) / 50
  if (p1.slice(0, 2) === p2.slice(0, 2)) return 5 + Math.abs(Number(p1.slice(2)) - Number(p2.slice(2))) / 30
  if (p1[0] === p2[0]) return 25 + Math.abs(Number(p1.slice(1)) - Number(p2.slice(1))) / 10
  return 100 + Math.abs(Number(p1) - Number(p2)) / 100
}
