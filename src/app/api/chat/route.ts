import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { notifyUser } from "@/lib/ws-emit"

// GET /api/chat?userId=...&withId=...  -> conversation between two users
// OR  /api/chat?userId=...  -> list of conversations (latest message per peer)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId")
  const withId = searchParams.get("withId")

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  if (withId) {
    // Get full conversation thread
    const messages = await db.chatMessage.findMany({
      where: {
        OR: [
          { fromId: userId, toId: withId },
          { fromId: withId, toId: userId },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 500,
    })
    // Mark messages sent by `withId` to `userId` as read
    await db.chatMessage.updateMany({
      where: { fromId: withId, toId: userId, readAt: null },
      data: { readAt: new Date() },
    })
    return NextResponse.json({ messages })
  }

  // Get conversation list — latest message per peer
  const all = await db.chatMessage.findMany({
    where: { OR: [{ fromId: userId }, { toId: userId }] },
    orderBy: { createdAt: "desc" },
    take: 500,
  })
  const peers = new Map<string, { message: typeof all[number]; unread: number }>()
  const unreadCounts = new Map<string, number>()
  for (const m of all) {
    const peer = m.fromId === userId ? m.toId : m.fromId
    if (!peers.has(peer)) peers.set(peer, { message: m, unread: 0 })
    if (m.toId === userId && m.readAt === null) {
      unreadCounts.set(peer, (unreadCounts.get(peer) || 0) + 1)
    }
  }
  // Attach unread counts
  for (const [peer, info] of peers) {
    info.unread = unreadCounts.get(peer) || 0
  }

  // Fetch peer account info
  const peerIds = Array.from(peers.keys())
  const accounts = await db.account.findMany({
    where: { id: { in: peerIds } },
    select: {
      id: true,
      name: true,
      role: true,
      specialization: true,
      bloodGroup: true,
    },
  })
  const accountMap = new Map(accounts.map((a) => [a.id, a]))

  const conversations = Array.from(peers.entries())
    .map(([peerId, info]) => ({
      peerId,
      peer: accountMap.get(peerId) || null,
      lastMessage: info.message,
      unread: info.unread,
    }))
    .sort(
      (a, b) =>
        new Date(b.lastMessage.createdAt).getTime() -
        new Date(a.lastMessage.createdAt).getTime()
    )

  return NextResponse.json({ conversations })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fromId, toId, body: messageBody, attachmentName } = body
    if (!fromId || !toId || !messageBody) {
      return NextResponse.json(
        { error: "fromId, toId and body required" },
        { status: 400 }
      )
    }
    const message = await db.chatMessage.create({
      data: {
        fromId,
        toId,
        body: String(messageBody).trim(),
        attachmentName: attachmentName || null,
      },
    })
    // Real-time: notify the recipient of the new message
    void notifyUser(toId, "chat:message", {
      id: message.id,
      fromId,
      toId,
      body: message.body,
      createdAt: message.createdAt,
    })
    return NextResponse.json({ message })
  } catch (e) {
    console.error("chat create error", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
