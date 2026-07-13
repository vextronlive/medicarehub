import { NextRequest, NextResponse } from "next/server"

// Estimate travel time + departure reminder.
// Uses a simplified haversine + average speed model (no external map API in sandbox).
export async function POST(req: NextRequest) {
  try {
    const { fromLat, fromLng, toLat, toLng, appointmentTime } = await req.json()
    if (fromLat == null || fromLng == null || toLat == null || toLng == null) {
      return NextResponse.json({ error: "coordinates required" }, { status: 400 })
    }

    const distanceKm = haversine(
      Number(fromLat),
      Number(fromLng),
      Number(toLat),
      Number(toLng)
    )

    // Assume average city speed 25 km/h, plus 10 min buffer for parking/waiting
    const travelMinutes = Math.max(5, Math.round((distanceKm / 25) * 60) + 10)
    const appt = new Date(appointmentTime)
    const leaveBy = new Date(appt.getTime() - travelMinutes * 60 * 1000)

    return NextResponse.json({
      distanceKm: Number(distanceKm.toFixed(2)),
      travelMinutes,
      leaveBy: leaveBy.toISOString(),
      appointmentTime: appt.toISOString(),
    })
  } catch (e) {
    console.error("eta error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
