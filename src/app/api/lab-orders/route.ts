import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { notifyUser } from "@/lib/ws-emit"

function generateOrderNumber(seq: number): string {
  const year = new Date().getFullYear()
  return `LAB-${year}-${String(seq).padStart(4, "0")}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId")
  const role = searchParams.get("role")
  const status = searchParams.get("status")

  if (!userId || !role) {
    return NextResponse.json({ error: "userId and role required" }, { status: 400 })
  }

  const where: Record<string, unknown> = {}
  if (role === "PATIENT") where.patientId = userId
  else if (role === "DOCTOR" || role === "ORGANIZATION") where.labId = userId
  if (status) where.status = status

  const orders = await db.labOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      patient: { select: { id: true, name: true, mobile: true, bloodGroup: true, city: true } },
      lab: { select: { id: true, name: true, city: true, state: true } },
    },
  })

  return NextResponse.json({ orders })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { patientId, labId, tests, notes, totalAmount } = body

    if (!patientId || !labId || !Array.isArray(tests) || tests.length === 0) {
      return NextResponse.json(
        { error: "patientId, labId and non-empty tests[] required" },
        { status: 400 }
      )
    }

    // Generate order number based on count this year
    const yearStart = new Date(new Date().getFullYear(), 0, 1)
    const yearEnd = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59, 999)
    const countYear = await db.labOrder.count({
      where: { createdAt: { gte: yearStart, lte: yearEnd } },
    })
    const orderNumber = generateOrderNumber(countYear + 1)

    const order = await db.labOrder.create({
      data: {
        orderNumber,
        patientId,
        labId,
        tests: JSON.stringify(tests),
        notes: notes || null,
        totalAmount: Number(totalAmount) || 0,
        status: "REQUESTED",
        paymentStatus: "PENDING",
      },
      include: {
        patient: { select: { id: true, name: true, mobile: true, bloodGroup: true, city: true } },
        lab: { select: { id: true, name: true, city: true, state: true } },
      },
    })

    // Real-time: notify the lab about the new order
    void notifyUser(labId, "lab_order:new", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      patient: order.patient,
    })

    return NextResponse.json({ order })
  } catch (e) {
    console.error("lab order create error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, status, paymentStatus, reportUrl, totalAmount, byUserId } = body
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }
    const existing = await db.labOrder.findUnique({
      where: { id },
      select: { status: true, patientId: true, labId: true },
    })
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }
    const oldStatus = existing.status

    const data: Record<string, unknown> = {}
    if (status) data.status = status
    if (paymentStatus) data.paymentStatus = paymentStatus
    if (reportUrl !== undefined) data.reportUrl = reportUrl
    if (totalAmount !== undefined) data.totalAmount = Number(totalAmount)

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }
    const order = await db.labOrder.update({
      where: { id },
      data,
      include: {
        patient: { select: { id: true, name: true, mobile: true, bloodGroup: true, city: true } },
        lab: { select: { id: true, name: true, city: true, state: true } },
      },
    })

    // Real-time: notify patient when status changes
    if (status && status !== oldStatus && existing.patientId !== byUserId) {
      void notifyUser(existing.patientId, "lab_order:status_changed", {
        orderId: id,
        orderNumber: order.orderNumber,
        oldStatus,
        newStatus: status,
      })
    }

    return NextResponse.json({ order })
  } catch (e) {
    console.error("lab order update error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
