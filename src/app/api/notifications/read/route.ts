import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// POST /api/notifications/read  { userId, keys: string[] }
// Marks one or more notification keys as read for a user.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, keys } = body
    if (!userId || !Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json(
        { error: "userId and keys[] required" },
        { status: 400 }
      )
    }
    // Upsert each (userId, key) pair — skip if already exists
    const ops = keys.map((k: string) =>
      db.notificationRead.upsert({
        where: {
          userId_notificationKey: {
            userId,
            notificationKey: String(k),
          },
        },
        update: { readAt: new Date() },
        create: { userId, notificationKey: String(k) },
      })
    )
    await Promise.all(ops)
    return NextResponse.json({ ok: true, marked: ops.length })
  } catch (e) {
    console.error("notifications read error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// GET /api/notifications/read?userId=...  -> { keys: string[] }
// Returns the set of notification keys the user has already dismissed.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId")
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }
  const rows = await db.notificationRead.findMany({
    where: { userId },
    select: { notificationKey: true },
  })
  return NextResponse.json({ keys: rows.map((r) => r.notificationKey) })
}
