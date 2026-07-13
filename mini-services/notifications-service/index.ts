import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server } from 'socket.io'

/**
 * Real-time notifications WebSocket service for MediCare Hub.
 *
 * Path strategy:
 *   - The Caddy gateway forwards all traffic on this port to path "/".
 *   - Socket.io uses its default path "/socket.io/" (no override).
 *   - Our HTTP control endpoints (/health, /stats, /emit) are handled in the
 *     httpServer 'request' listener BEFORE socket.io's engine intercepts them.
 *   - Socket.io engine only attaches to URLs starting with "/socket.io/" so
 *     there's no conflict with /health, /stats, /emit.
 *
 * Channels (rooms):
 *   - user:{userId}   -> targeted notifications for a specific user
 *   - role:{ROLE}     -> broadcast to all users of a role (PATIENT / DOCTOR / ORGANIZATION)
 *   - global          -> all connected clients
 *
 * Event types emitted by the server:
 *   - notification:new           { id, type, title, body, severity, createdAt }
 *   - appointment:status_changed { appointmentId, oldStatus, newStatus, byUser }
 *   - appointment:created        { appointmentId, patient, doctor, scheduledAt }
 *   - refill:status_changed      { refillId, oldStatus, newStatus, byUser }
 *   - lab_order:status_changed   { orderId, oldStatus, newStatus, byUser }
 *   - telemedicine:started       { sessionId, appointmentId, meetingUrl }
 *   - telemedicine:ended         { sessionId, appointmentId }
 *   - record:created             { recordId, patient, doctor }
 *   - rating:new                 { toId, score, comment }
 *   - referral:new               { referralId, fromName, toName, patientName }
 */

interface OnlineUser {
  socketId: string
  userId: string
  role: 'PATIENT' | 'DOCTOR' | 'ORGANIZATION'
  connectedAt: number
}

const onlineUsers = new Map<string, OnlineUser>() // socketId -> OnlineUser
const userSocketIndex = new Map<string, Set<string>>() // userId -> Set<socketId>

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = req.url || '/'

  // Skip socket.io requests — engine.io handles those itself
  if (url.startsWith('/socket.io')) {
    // Let socket.io's attached engine handle it
    return
  }

  if (url === '/health' && req.method === 'GET') {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        ok: true,
        service: 'medicare-hub-notifications',
        online: onlineUsers.size,
        uptime: process.uptime(),
      })
    )
    return
  }

  if (url === '/stats' && req.method === 'GET') {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    const byRole: Record<string, number> = {}
    for (const u of onlineUsers.values()) {
      byRole[u.role] = (byRole[u.role] || 0) + 1
    }
    res.end(
      JSON.stringify({
        online: onlineUsers.size,
        byRole,
        uniqueUsers: userSocketIndex.size,
      })
    )
    return
  }

  if (url === '/emit' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
      if (body.length > 1_000_000) req.destroy()
    })
    req.on('end', () => {
      if (res.headersSent || res.writableEnded) return
      try {
        const data = JSON.parse(body || '{}')
        const { event, payload, target } = data
        if (!event) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'event required' }))
          return
        }
        if (!target || target.type === 'global') {
          io.to('global').emit(event, payload || {})
        } else if (target.type === 'user' && target.id) {
          io.to(`user:${target.id}`).emit(event, payload || {})
        } else if (target.type === 'role' && target.id) {
          io.to(`role:${target.id}`).emit(event, payload || {})
        } else {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'invalid target' }))
          return
        }
        res.statusCode = 200
        res.end(JSON.stringify({ ok: true, delivered: true }))
      } catch {
        if (!res.headersSent && !res.writableEnded) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'invalid JSON' }))
        }
      }
    })
    return
  }

  // 404 for unknown
  res.statusCode = 404
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error: 'Not Found', path: url }))
})

const io = new Server(httpServer, {
  // Default path is /socket.io/ — must NOT be changed so that Caddy routing works.
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

io.on('connection', (socket) => {
  console.log(`[ws] connected: ${socket.id}`)

  socket.on('identify', (data: { userId: string; role: string }) => {
    if (!data?.userId || !data?.role) return
    const user: OnlineUser = {
      socketId: socket.id,
      userId: data.userId,
      role: data.role as OnlineUser['role'],
      connectedAt: Date.now(),
    }
    onlineUsers.set(socket.id, user)
    if (!userSocketIndex.has(user.userId))
      userSocketIndex.set(user.userId, new Set())
    userSocketIndex.get(user.userId)!.add(socket.id)

    socket.join(`user:${user.userId}`)
    socket.join(`role:${user.role}`)
    socket.join('global')

    socket.emit('identified', { ok: true, socketId: socket.id })
    io.to('global').emit('presence:update', { online: onlineUsers.size })
    console.log(
      `[ws] identified ${socket.id} -> user:${user.userId} role:${user.role} (online: ${onlineUsers.size})`
    )
  })

  socket.on('ping', () => socket.emit('pong', { t: Date.now() }))

  socket.on('disconnect', () => {
    const user = onlineUsers.get(socket.id)
    if (user) {
      const set = userSocketIndex.get(user.userId)
      if (set) {
        set.delete(socket.id)
        if (set.size === 0) userSocketIndex.delete(user.userId)
      }
      onlineUsers.delete(socket.id)
      io.to('global').emit('presence:update', { online: onlineUsers.size })
      console.log(
        `[ws] disconnected ${socket.id} (user:${user.userId}) — online: ${onlineUsers.size}`
      )
    } else {
      console.log(`[ws] disconnected ${socket.id} (unidentified)`)
    }
  })

  socket.on('error', (err: unknown) => {
    console.error(`[ws] socket error ${socket.id}:`, err)
  })
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[ws] MediCare Hub notifications service running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('[ws] SIGTERM received, shutting down...')
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  console.log('[ws] SIGINT received, shutting down...')
  httpServer.close(() => process.exit(0))
})
