import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import crypto from "crypto"

function generateMeetingId(): string {
  // ABC-1234 format
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  const part1 = Array.from({ length: 3 }, () =>
    letters[Math.floor(Math.random() * letters.length)]
  ).join("")
  const part2 = Math.floor(1000 + Math.random() * 9000)
  return `${part1}-${part2}`
}

function generatePin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const appointmentId = searchParams.get("appointmentId")

  if (!appointmentId) {
    return NextResponse.json(
      { error: "appointmentId required" },
      { status: 400 }
    )
  }

  const session = await db.telemedicineSession.findUnique({
    where: { appointmentId },
    include: {
      appointment: {
        include: {
          patient: { select: { id: true, name: true, mobile: true } },
          doctor: { select: { id: true, name: true, specialization: true } },
        },
      },
    },
  })

  return NextResponse.json({ session })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { appointmentId, action } = body

    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId required" }, { status: 400 })
    }

    // Verify the appointment exists and is confirmed
    const appt = await db.appointment.findUnique({ where: { id: appointmentId } })
    if (!appt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }
    if (appt.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Telemedicine requires a confirmed appointment" },
        { status: 400 }
      )
    }

    // Action: create (default), start, end
    if (action === "start") {
      const updated = await db.telemedicineSession.update({
        where: { appointmentId },
        data: { status: "LIVE", startedAt: new Date() },
        include: {
          appointment: {
            include: {
              patient: { select: { id: true, name: true, mobile: true } },
              doctor: { select: { id: true, name: true, specialization: true } },
            },
          },
        },
      })
      return NextResponse.json({ session: updated })
    }

    if (action === "end") {
      const updated = await db.telemedicineSession.update({
        where: { appointmentId },
        data: { status: "ENDED", endedAt: new Date() },
        include: {
          appointment: {
            include: {
              patient: { select: { id: true, name: true, mobile: true } },
              doctor: { select: { id: true, name: true, specialization: true } },
            },
          },
        },
      })
      return NextResponse.json({ session: updated })
    }

    // Default: create new session if not exists
    const existing = await db.telemedicineSession.findUnique({
      where: { appointmentId },
    })
    if (existing) {
      return NextResponse.json({
        session: {
          ...existing,
          appointment: {
            ...appt,
            patient: await db.account.findUnique({
              where: { id: appt.patientId },
              select: { id: true, name: true, mobile: true },
            }),
            doctor: await db.account.findUnique({
              where: { id: appt.doctorId },
              select: { id: true, name: true, specialization: true },
            }),
          },
        },
      })
    }

    const meetingId = generateMeetingId()
    // Use a stable, internal-only meeting URL (no real external service)
    const meetingUrl = `https://meet.medicare-hub.internal/${meetingId}`
    const hostPin = generatePin()
    const participantPin = generatePin()

    const session = await db.telemedicineSession.create({
      data: {
        appointmentId,
        meetingId,
        meetingUrl,
        hostPin,
        participantPin,
        status: "SCHEDULED",
      },
      include: {
        appointment: {
          include: {
            patient: { select: { id: true, name: true, mobile: true } },
            doctor: { select: { id: true, name: true, specialization: true } },
          },
        },
      },
    })

    return NextResponse.json({ session })
  } catch (e) {
    console.error("telemedicine error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
