import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * MoM Point — Insurance Companies Database.
 *
 * GET /api/insurance-providers
 *   ?search=...&category=HEALTH&cashless=true
 * Returns the master list of insurance providers.
 *
 * POST /api/insurance-providers  → seed new provider (admin only — sandbox open)
 * PATCH /api/insurance-providers?id=...  → update
 * DELETE /api/insurance-providers?id=...
 */

// Seed data — top Indian insurers
const SEED_PROVIDERS = [
  { name: "Star Health & Allied Insurance", website: "https://www.starhealth.in", contactPhone: "044-6900-6900", categories: ["HEALTH", "FAMILY_FLOATER"], cashless: true, networkHospitals: 14000, rating: 4.2 },
  { name: "HDFC ERGO General Insurance", website: "https://www.hdfcergo.com", contactPhone: "1800-2700-700", categories: ["HEALTH", "CRITICAL_ILLNESS"], cashless: true, networkHospitals: 13000, rating: 4.3 },
  { name: "ICICI Lombard General Insurance", website: "https://www.icicilombard.com", contactPhone: "1800-2666", categories: ["HEALTH", "FAMILY_FLOATER"], cashless: true, networkHospitals: 9000, rating: 4.2 },
  { name: "Niva Bupa Health Insurance", website: "https://www.nivabupa.com", contactPhone: "1800-3010-3333", categories: ["HEALTH", "SENIOR_CITIZEN"], cashless: true, networkHospitals: 10000, rating: 4.1 },
  { name: "Bajaj Allianz General Insurance", website: "https://www.bajajallianz.com", contactPhone: "1800-209-5858", categories: ["HEALTH", "CRITICAL_ILLNESS"], cashless: true, networkHospitals: 8000, rating: 4.0 },
  { name: "Max Bupa Health Insurance", website: "https://www.maxbupa.com", contactPhone: "1800-3010-3333", categories: ["HEALTH", "FAMILY_FLOATER"], cashless: true, networkHospitals: 5000, rating: 3.9 },
  { name: "Care Health Insurance", website: "https://www.careinsurance.com", contactPhone: "1800-102-4488", categories: ["HEALTH", "SENIOR_CITIZEN"], cashless: true, networkHospitals: 21000, rating: 4.0 },
  { name: "Tata AIG General Insurance", website: "https://www.tataaig.com", contactPhone: "1800-266-7780", categories: ["HEALTH", "CRITICAL_ILLNESS"], cashless: true, networkHospitals: 7000, rating: 4.1 },
  { name: "Aditya Birla Health Insurance", website: "https://health.adityabirlacapital.com", contactPhone: "1800-270-7000", categories: ["HEALTH", "FAMILY_FLOATER"], cashless: true, networkHospitals: 10000, rating: 4.0 },
  { name: "ManipalCigna Health Insurance", website: "https://www.manipalcigna.com", contactPhone: "1800-102-4462", categories: ["HEALTH", "SENIOR_CITIZEN"], cashless: true, networkHospitals: 7500, rating: 3.9 },
  { name: "Reliance General Insurance", website: "https://www.reliancegeneral.co.in", contactPhone: "1800-3009", categories: ["HEALTH"], cashless: true, networkHospitals: 8000, rating: 3.8 },
  { name: "New India Assurance", website: "https://www.newindia.co.in", contactPhone: "1800-209-1415", categories: ["HEALTH", "LIFE"], cashless: true, networkHospitals: 12000, rating: 4.0 },
  { name: "United India Insurance", website: "https://www.uiic.co.in", contactPhone: "1800-425-33333", categories: ["HEALTH"], cashless: true, networkHospitals: 8500, rating: 3.7 },
  { name: "Oriental Insurance", website: "https://orientalinsurance.org.in", contactPhone: "1800-118-485", categories: ["HEALTH"], cashless: true, networkHospitals: 7000, rating: 3.6 },
  { name: "National Insurance", website: "https://nationalinsurance.nic.co.in", contactPhone: "1800-200-7710", categories: ["HEALTH"], cashless: true, networkHospitals: 6000, rating: 3.7 },
]

async function ensureSeed() {
  const count = await db.insuranceProvider.count()
  if (count === 0) {
    await db.insuranceProvider.createMany({
      data: SEED_PROVIDERS.map((p) => ({
        ...p,
        categories: JSON.stringify(p.categories),
      })),
    })
  }
}

export async function GET(req: NextRequest) {
  await ensureSeed()
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search")?.toLowerCase()
  const category = searchParams.get("category")
  const cashless = searchParams.get("cashless")

  const where: Record<string, unknown> = { isActive: true }
  if (category) {
    where.categories = { contains: category }
  }
  if (cashless === "true") where.cashless = true
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { website: { contains: search } },
    ]
  }

  const providers = await db.insuranceProvider.findMany({
    where,
    orderBy: { rating: "desc" },
    take: 100,
  })

  return NextResponse.json({
    providers: providers.map((p) => ({
      ...p,
      categories: JSON.parse(p.categories || "[]"),
    })),
  })
}

export async function POST(req: NextRequest) {
  try {
    const { name, website, contactPhone, contactEmail, categories, cashless, networkHospitals, logoUrl } = await req.json()
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 })

    const provider = await db.insuranceProvider.create({
      data: {
        name,
        website: website || null,
        contactPhone: contactPhone || null,
        contactEmail: contactEmail || null,
        logoUrl: logoUrl || null,
        categories: JSON.stringify(categories || []),
        cashless: cashless ?? true,
        networkHospitals: Number(networkHospitals) || 0,
      },
    })
    return NextResponse.json({ ok: true, provider })
  } catch (e) {
    console.error("provider create error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
