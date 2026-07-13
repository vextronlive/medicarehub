import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// GET /api/notifications?userId=...&role=...
// Computes notifications dynamically from appointments, records, insurance.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId")
  const role = searchParams.get("role")

  if (!userId || !role) {
    return NextResponse.json({ error: "userId and role required" }, { status: 400 })
  }

  const notifications: Array<{
    id: string
    type: string
    title: string
    message: string
    timestamp: string
    severity: "info" | "warning" | "success" | "urgent"
    read: boolean
  }> = []

  const now = new Date()

  if (role === "PATIENT") {
    // Upcoming appointments (within 48h)
    const appointments = await db.appointment.findMany({
      where: { patientId: userId, status: { in: ["PENDING", "CONFIRMED"] } },
      include: { doctor: { select: { name: true, specialization: true } } },
      orderBy: { scheduledAt: "asc" },
    })

    for (const a of appointments) {
      const hoursUntil = (a.scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60)
      if (hoursUntil > 0 && hoursUntil <= 48) {
        notifications.push({
          id: `appt-${a.id}`,
          type: "appointment",
          title: a.status === "PENDING" ? "Appointment awaiting confirmation" : "Upcoming appointment",
          message: `${a.doctor?.name ? a.doctor.name : "Your doctor"} · ${a.tokenNumber ? `Token #${a.tokenNumber} · ` : ""}${a.scheduledAt.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`,
          timestamp: a.createdAt.toISOString(),
          severity: a.status === "PENDING" ? "warning" : hoursUntil <= 3 ? "urgent" : "info",
          read: false,
        })
      }
    }

    // Insurance premium alerts
    const insurance = await db.insurance.findUnique({ where: { patientId: userId } })
    if (insurance?.premiumDueDate) {
      const daysUntil = Math.ceil(
        (insurance.premiumDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysUntil >= -7 && daysUntil <= 30) {
        notifications.push({
          id: `ins-${insurance.id}`,
          type: "insurance",
          title: daysUntil < 0 ? "Insurance premium overdue" : "Insurance premium due soon",
          message: `${insurance.providerName} premium of ₹${insurance.medicalPremium.toLocaleString("en-IN")} ${daysUntil < 0 ? `was due ${Math.abs(daysUntil)} day(s) ago` : `due in ${daysUntil} day(s)`}. Pay now to keep coverage active.`,
          timestamp: new Date(now.getTime() - 3600000).toISOString(),
          severity: daysUntil < 0 ? "urgent" : daysUntil <= 7 ? "warning" : "info",
          read: false,
        })
      }
    }

    // New medical records
    const records = await db.medicalRecord.findMany({
      where: { patientId: userId },
      include: { doctor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 3,
    })
    for (const r of records) {
      const hoursAgo = (now.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60)
      if (hoursAgo <= 72) {
        notifications.push({
          id: `rec-${r.id}`,
          type: "record",
          title: "New medical record added",
          message: `${r.doctor?.name ? r.doctor.name + " · " : ""}${r.visitType.replace("_", " ")} at ${r.clinicName}`,
          timestamp: r.createdAt.toISOString(),
          severity: "success",
          read: false,
        })
      }
    }
  } else {
    // Doctor / Organization notifications
    const where: Record<string, unknown> =
      role === "DOCTOR" ? { doctorId: userId } : { orgId: userId }

    const pending = await db.appointment.count({
      where: { ...where, status: "PENDING" },
    })
    if (pending > 0) {
      notifications.push({
        id: "pending-appts",
        type: "appointment",
        title: `${pending} appointment${pending > 1 ? "s" : ""} pending confirmation`,
        message: `Review and confirm pending patient appointments in the Appointments tab.`,
        timestamp: new Date(now.getTime() - 1800000).toISOString(),
        severity: "warning",
        read: false,
      })
    }

    const today = await db.appointment.count({
      where: {
        ...where,
        status: "CONFIRMED",
        scheduledAt: {
          gte: new Date(now.setHours(0, 0, 0, 0)),
          lte: new Date(now.setHours(23, 59, 59, 999)),
        },
      },
    })
    if (today > 0) {
      notifications.push({
        id: "today-appts",
        type: "appointment",
        title: `${today} confirmed appointment${today > 1 ? "s" : ""} today`,
        message: `You have ${today} patient visit${today > 1 ? "s" : ""} scheduled for today.`,
        timestamp: new Date().toISOString(),
        severity: "info",
        read: false,
      })
    }

    // Recent referrals received
    const referrals = await db.referral.findMany({
      where: { toId: userId },
      orderBy: { createdAt: "desc" },
      take: 2,
    })
    for (const r of referrals) {
      const hoursAgo = (now.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60)
      if (hoursAgo <= 72) {
        notifications.push({
          id: `ref-${r.id}`,
          type: "referral",
          title: "New patient referral received",
          message: `${r.from?.name || "A peer"} referred ${r.patientName} for ${r.purpose || "consultation"}.`,
          timestamp: r.createdAt.toISOString(),
          severity: "info",
          read: false,
        })
      }
    }
  }

  // Sort by timestamp desc
  notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return NextResponse.json({ notifications, unreadCount: notifications.length })
}
