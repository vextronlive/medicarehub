"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { motion, AnimatePresence } from "framer-motion"
import { format, formatDistanceToNow, parseISO } from "date-fns"
import { toast } from "sonner"
import {
  MessageSquare,
  Send,
  Search,
  Plus,
  ArrowLeft,
  Check,
  CheckCheck,
  User,
  Stethoscope,
  Hospital,
  Phone,
  MoreVertical,
  Loader2,
} from "lucide-react"

import { useAuthStore, type UserRole } from "@/lib/auth-store"
import { apiFetch } from "@/lib/api"
import { useRealtime } from "@/lib/use-realtime"
import { cn, doctorName, initials } from "@/lib/utils"
import {
  HeroBanner,
  EmptyState,
} from "@/components/dashboard/shared/primitives"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// --- Types -----------------------------------------------------------------

type Role = "PATIENT" | "DOCTOR" | "ORGANIZATION"

interface Peer {
  id: string
  name: string
  role: string
  specialization?: string | null
  bloodGroup?: string | null
}

interface ChatMessage {
  id: string
  fromId: string
  toId: string
  body: string
  attachmentName?: string | null
  readAt?: string | null
  createdAt: string
}

interface Conversation {
  peerId: string
  peer: Peer | null
  lastMessage: ChatMessage
  unread: number
}

// --- Helpers ---------------------------------------------------------------

function roleMeta(role?: string) {
  switch (role) {
    case "DOCTOR":
      return {
        label: "Doctor",
        icon: Stethoscope,
        badge:
          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
      }
    case "ORGANIZATION":
      return {
        label: "Hospital",
        icon: Hospital,
        badge:
          "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/30",
      }
    case "PATIENT":
    default:
      return {
        label: "Patient",
        icon: User,
        badge:
          "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
      }
  }
}

function peerDisplay(peer: Peer | null, selfRole: Role) {
  if (!peer) return { name: "Unknown", sub: "" }
  const isDoctorPeer = peer.role === "DOCTOR"
  const name =
    selfRole === "PATIENT" && isDoctorPeer
      ? doctorName(peer.name || "")
      : peer.name || "Unknown"
  const sub =
    peer.role === "DOCTOR"
      ? peer.specialization || "Doctor"
      : peer.role === "ORGANIZATION"
        ? "Healthcare Organization"
        : peer.bloodGroup
          ? `Patient • ${peer.bloodGroup}`
          : "Patient"
  return { name, sub }
}

function previewBody(body?: string) {
  if (!body) return "(empty)"
  return body.length > 60 ? body.slice(0, 60) + "…" : body
}

// --- Typing indicator ------------------------------------------------------

function TypingDots() {
  return (
    <div
      className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5"
      aria-label="typing"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
          animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  )
}

// --- Conversation list item ------------------------------------------------

function ConversationListItem({
  conv,
  selfRole,
  active,
  onSelect,
}: {
  conv: Conversation
  selfRole: Role
  active: boolean
  onSelect: () => void
}) {
  const peer = conv.peer
  const meta = roleMeta(peer?.role)
  const { name, sub } = peerDisplay(peer, selfRole)
  const lastFromMe = conv.lastMessage.fromId !== conv.peerId
  const ts = conv.lastMessage?.createdAt
    ? formatDistanceToNow(new Date(conv.lastMessage.createdAt), {
        addSuffix: false,
      })
    : ""

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all duration-200",
        active
          ? "border-emerald-300 bg-emerald-50 shadow-sm dark:border-emerald-500/40 dark:bg-emerald-500/10"
          : "border-border bg-card hover:border-emerald-200 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5"
      )}
    >
      <Avatar className="h-11 w-11 shrink-0">
        <AvatarFallback
          className={cn(
            "text-xs font-semibold",
            peer?.role === "DOCTOR"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
              : peer?.role === "ORGANIZATION"
                ? "bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
          )}
        >
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold">{name}</p>
          {ts && (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {ts}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <meta.icon className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs text-muted-foreground">{sub}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground">
            {lastFromMe ? "You: " : ""}
            {previewBody(conv.lastMessage?.body)}
          </p>
          {conv.unread > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-background">
              {conv.unread > 9 ? "9+" : conv.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// --- New conversation dialog ----------------------------------------------

interface PeerOption {
  id: string
  name: string
  role?: string
  specialization?: string | null
  bloodGroup?: string | null
  sub?: string
}

function NewConversationDialog({
  open,
  onOpenChange,
  selfRole,
  selfId,
  existingPeerIds,
  onPick,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  selfRole: Role
  selfId: string
  existingPeerIds: Set<string>
  onPick: (peer: PeerOption) => void
}) {
  const [options, setOptions] = useState<PeerOption[]>([])
  const [loading, setLoading] = useState(false)
  const [pickedId, setPickedId] = useState<string>("")
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setOptions([])
    setPickedId("")
    setSearch("")

    async function load() {
      try {
        if (selfRole === "PATIENT") {
          const data = await apiFetch<{ doctors: PeerOption[] }>(
            `/api/doctors?role=DOCTOR`
          )
          const list = (data.doctors || [])
            .filter((d) => d.id !== selfId)
            .map((d) => ({
              id: d.id,
              name: d.name,
              role: "DOCTOR",
              specialization: d.specialization,
              bloodGroup: null,
              sub: d.specialization || "Doctor",
            }))
          if (!cancelled) setOptions(list)
        } else {
          // DOCTOR / ORGANIZATION -> patients via records
          const data = await apiFetch<{
            records: {
              patient: { id: string; name: string; mobile?: string; bloodGroup?: string | null }
            }[]
          }>(`/api/records?userId=${selfId}&role=${selfRole}`)
          const map = new Map<string, PeerOption>()
          for (const r of data.records || []) {
            if (!r.patient || !r.patient.id) continue
            if (r.patient.id === selfId) continue
            if (!map.has(r.patient.id)) {
              map.set(r.patient.id, {
                id: r.patient.id,
                name: r.patient.name,
                role: "PATIENT",
                specialization: null,
                bloodGroup: r.patient.bloodGroup,
                sub: r.patient.bloodGroup
                  ? `Patient • ${r.patient.bloodGroup}`
                  : "Patient",
              })
            }
          }
          if (!cancelled) setOptions(Array.from(map.values()))
        }
      } catch (e) {
        if (!cancelled) {
          toast.error("Failed to load contacts", {
            description: e instanceof Error ? e.message : undefined,
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open, selfRole, selfId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        (o.sub || "").toLowerCase().includes(q)
    )
  }, [options, search])

  // Hide peers we already have a conversation with — they appear in the list
  const available = filtered.filter((o) => !existingPeerIds.has(o.id))
  const picked = available.find((o) => o.id === pickedId) || null

  function handleConfirm() {
    if (!picked) return
    onPick(picked)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-600" />
            New Conversation
          </DialogTitle>
          <DialogDescription>
            {selfRole === "PATIENT"
              ? "Pick a doctor to start a secure chat."
              : "Pick a patient you have treated to start a secure chat."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or specialty…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={pickedId} onValueChange={setPickedId}>
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  loading
                    ? "Loading contacts…"
                    : available.length === 0
                      ? "No new contacts available"
                      : "Select a contact…"
                }
              />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {available.map((o) => {
                const meta = roleMeta(o.role)
                return (
                  <SelectItem key={o.id} value={o.id}>
                    <div className="flex items-center gap-2">
                      <meta.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">
                        {selfRole === "PATIENT" && o.role === "DOCTOR"
                          ? doctorName(o.name)
                          : o.name}
                      </span>
                      {o.sub && (
                        <span className="text-xs text-muted-foreground">
                          • {o.sub}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>

          {picked && (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  {initials(
                    selfRole === "PATIENT" && picked.role === "DOCTOR"
                      ? doctorName(picked.name)
                      : picked.name
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {selfRole === "PATIENT" && picked.role === "DOCTOR"
                    ? doctorName(picked.name)
                    : picked.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {picked.sub}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!picked}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <MessageSquare className="h-4 w-4" />
              Start Chat
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// --- Main implementation ---------------------------------------------------

function MessagingImpl({ role }: { role: Role }) {
  const user = useAuthStore((s) => s.user)

  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState("")
  const [mobileView, setMobileView] = useState<"list" | "thread">("list")
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [textareaFocused, setTextareaFocused] = useState(false)

  const bottomRef = useRef<HTMLDivElement | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  const selectedPeerIdRef = useRef<string | null>(null)
  const userIdRef = useRef<string | null>(null)

  // Keep refs in sync with state so the WebSocket handler always sees latest
  useEffect(() => {
    selectedPeerIdRef.current = selectedPeerId
  }, [selectedPeerId])
  useEffect(() => {
    userIdRef.current = user?.id || null
  }, [user?.id])

  // --- Load conversation list -------------------------------------------
  const loadConversations = useCallback(async () => {
    if (!user) return
    try {
      const data = await apiFetch<{ conversations: Conversation[] }>(
        `/api/chat?userId=${user.id}`
      )
      setConversations(data.conversations || [])
    } catch (e) {
      // Don't spam toasts on background polling
      if (loading) {
        toast.error("Failed to load conversations", {
          description: e instanceof Error ? e.message : undefined,
        })
      }
    } finally {
      setLoading(false)
    }
  }, [user, loading])

  useEffect(() => {
    loadConversations()
  }, [user?.id])

  // Polling: refresh conversations list every 60s
  useEffect(() => {
    if (!user) return
    const t = setInterval(() => {
      loadConversations()
    }, 60_000)
    return () => clearInterval(t)
  }, [user, loadConversations])

  // --- Load messages for a peer -----------------------------------------
  const loadMessages = useCallback(
    async (peerId: string) => {
      if (!user) return
      setMessagesLoading(true)
      try {
        const data = await apiFetch<{ messages: ChatMessage[] }>(
          `/api/chat?userId=${user.id}&withId=${peerId}`
        )
        setMessages(data.messages || [])
        // After opening, clear unread count for this peer locally
        setConversations((prev) =>
          prev.map((c) =>
            c.peerId === peerId ? { ...c, unread: 0 } : c
          )
        )
      } catch (e) {
        toast.error("Failed to load messages", {
          description: e instanceof Error ? e.message : undefined,
        })
      } finally {
        setMessagesLoading(false)
      }
    },
    [user]
  )

  useEffect(() => {
    if (selectedPeerId) {
      loadMessages(selectedPeerId)
      setMobileView("thread")
    } else {
      setMessages([])
      setMobileView("list")
    }
  }, [selectedPeerId, loadMessages])

  // Auto-scroll to bottom on new messages / open conversation
  useEffect(() => {
    if (messages.length === 0) return
    const t = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, 50)
    return () => clearTimeout(t)
  }, [messages, selectedPeerId])

  // Polling: refresh active conversation every 30s
  useEffect(() => {
    if (!selectedPeerId) return
    const t = setInterval(() => {
      loadMessages(selectedPeerId)
    }, 30_000)
    return () => clearInterval(t)
  }, [selectedPeerId, loadMessages])

  // --- Real-time updates ------------------------------------------------
  const handleChatMessage = useCallback(
    (payload: any) => {
      const msg: ChatMessage = {
        id: payload?.id || crypto.randomUUID(),
        fromId: String(payload?.fromId || ""),
        toId: String(payload?.toId || ""),
        body: String(payload?.body || ""),
        attachmentName: payload?.attachmentName || null,
        readAt: payload?.readAt || null,
        createdAt: payload?.createdAt || new Date().toISOString(),
      }
      const me = userIdRef.current
      if (!me) return
      // Only handle messages meant for me
      if (msg.toId !== me) return

      const activePeer = selectedPeerIdRef.current
      const peer = conversations.find((c) => c.peerId === msg.fromId)
      const peerName = peer?.peer
        ? peer.peer.role === "DOCTOR"
          ? doctorName(peer.peer.name || "")
          : peer.peer.name || "Someone"
        : "Someone"

      if (activePeer === msg.fromId) {
        // Append to active thread
        setMessages((prev) => {
          // De-dupe by id (server may also send via polling)
          if (prev.some((m) => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        // Mark locally unread = 0 because we're viewing it
        setConversations((prev) =>
          prev.map((c) =>
            c.peerId === msg.fromId
              ? { ...c, unread: 0, lastMessage: msg }
              : c
          )
        )
      } else {
        // Increment unread + bump lastMessage
        setConversations((prev) => {
          const exists = prev.find((c) => c.peerId === msg.fromId)
          if (exists) {
            return prev.map((c) =>
              c.peerId === msg.fromId
                ? { ...c, unread: c.unread + 1, lastMessage: msg }
                : c
            )
          }
          // Unknown peer — surface as a stub; will be enriched by next refresh
          return [
            {
              peerId: msg.fromId,
              peer: null,
              lastMessage: msg,
              unread: 1,
            },
            ...prev,
          ]
        })
        toast.success(`New message from ${peerName}`, {
          description: previewBody(msg.body),
        })
      }
      // Always refresh the conversations list to ensure peer info is fresh
      loadConversations()
    },
    [conversations, loadConversations]
  )

  useRealtime({
    handlers: {
      "chat:message": handleChatMessage,
    },
  })

  // --- Send message -----------------------------------------------------
  const handleSend = async () => {
    const body = input.trim()
    if (!body || !user || !selectedPeerId || sending) return
    const tempId = `temp-${Date.now()}`
    const optimistic: ChatMessage = {
      id: tempId,
      fromId: user.id,
      toId: selectedPeerId,
      body,
      attachmentName: null,
      readAt: null,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setInput("")
    setSending(true)
    try {
      const data = await apiFetch<{ message: ChatMessage }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          fromId: user.id,
          toId: selectedPeerId,
          body,
        }),
      })
      // Replace optimistic with server-confirmed
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? data.message : m))
      )
      // Update lastMessage in conversations list
      setConversations((prev) => {
        const exists = prev.find((c) => c.peerId === selectedPeerId)
        if (exists) {
          return prev
            .map((c) =>
              c.peerId === selectedPeerId
                ? { ...c, lastMessage: data.message }
                : c
            )
            .sort(
              (a, b) =>
                new Date(b.lastMessage.createdAt).getTime() -
                new Date(a.lastMessage.createdAt).getTime()
            )
        }
        return prev
      })
    } catch (e) {
      toast.error("Failed to send message", {
        description: e instanceof Error ? e.message : undefined,
      })
      // Roll back optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // --- Derived ----------------------------------------------------------
  const selectedPeer: Peer | null = useMemo(() => {
    if (!selectedPeerId) return null
    return (
      conversations.find((c) => c.peerId === selectedPeerId)?.peer || null
    )
  }, [selectedPeerId, conversations])

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => {
      const { name } = peerDisplay(c.peer, role)
      return name.toLowerCase().includes(q)
    })
  }, [conversations, search, role])

  const existingPeerIds = useMemo(
    () => new Set(conversations.map((c) => c.peerId)),
    [conversations]
  )

  // --- Guard ------------------------------------------------------------
  if (!user) return null

  const showListOnMobile = mobileView === "list"
  const selectedPeerDisplay = peerDisplay(selectedPeer, role)
  const selectedPeerMeta = roleMeta(selectedPeer?.role)

  return (
    <div className="space-y-6">
      <HeroBanner
        icon={MessageSquare}
        title="Secure Messages"
        subtitle="Chat securely with your healthcare providers. All messages are private and encrypted in transit."
      />

      <NewConversationDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        selfRole={role}
        selfId={user.id}
        existingPeerIds={existingPeerIds}
        onPick={(peer) => {
          // Insert a stub conversation if it doesn't exist, then select it
          setConversations((prev) => {
            if (prev.some((c) => c.peerId === peer.id)) return prev
            const stub: Conversation = {
              peerId: peer.id,
              peer: {
                id: peer.id,
                name: peer.name,
                role: peer.role || "PATIENT",
                specialization: peer.specialization ?? null,
                bloodGroup: peer.bloodGroup ?? null,
              },
              lastMessage: {
                id: "stub",
                fromId: peer.id,
                toId: user.id,
                body: "",
                attachmentName: null,
                readAt: null,
                createdAt: new Date().toISOString(),
              },
              unread: 0,
            }
            return [stub, ...prev]
          })
          setSelectedPeerId(peer.id)
        }}
      />

      <Card className="overflow-hidden p-0">
        <CardContent className="grid grid-cols-1 gap-0 p-0 lg:grid-cols-3">
          {/* === Left pane: conversation list === */}
          <div
            className={cn(
              "flex flex-col border-b border-border lg:border-b-0 lg:border-r",
              showListOnMobile ? "flex" : "hidden lg:flex"
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border p-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold tracking-tight">
                  Conversations
                </h2>
                <p className="text-xs text-muted-foreground">
                  {conversations.length} total
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setNewDialogOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New</span>
              </Button>
            </div>
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search conversations…"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="max-h-[60vh] flex-1 overflow-y-auto p-3 lg:max-h-[520px]">
              {loading ? (
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl border p-3"
                    >
                      <Skeleton className="h-11 w-11 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredConversations.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title={
                    conversations.length === 0
                      ? "No conversations yet"
                      : "No matches found"
                  }
                  description={
                    conversations.length === 0
                      ? "Start a new one to chat with your healthcare team."
                      : "Try a different search term."
                  }
                  action={
                    conversations.length === 0 ? (
                      <Button
                        size="sm"
                        onClick={() => setNewDialogOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Plus className="h-4 w-4" />
                        Start a chat
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {filteredConversations.map((conv, idx) => (
                      <motion.div
                        key={conv.peerId}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2, delay: idx * 0.02 }}
                      >
                        <ConversationListItem
                          conv={conv}
                          selfRole={role}
                          active={conv.peerId === selectedPeerId}
                          onSelect={() => setSelectedPeerId(conv.peerId)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          {/* === Right pane: active thread === */}
          <div
            className={cn(
              "col-span-2 flex flex-col",
              showListOnMobile ? "hidden lg:flex" : "flex"
            )}
          >
            {!selectedPeerId ? (
              <div className="flex h-full min-h-[400px] items-center justify-center p-6">
                <EmptyState
                  icon={MessageSquare}
                  title="No conversation selected"
                  description="Select a conversation or start a new one."
                  action={
                    <Button
                      size="sm"
                      onClick={() => setNewDialogOpen(true)}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Plus className="h-4 w-4" />
                      New conversation
                    </Button>
                  }
                />
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="flex items-center justify-between gap-3 border-b border-border p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 lg:hidden"
                      onClick={() => setMobileView("list")}
                      aria-label="Back to conversations"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback
                        className={cn(
                          "text-xs font-semibold",
                          selectedPeer?.role === "DOCTOR"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : selectedPeer?.role === "ORGANIZATION"
                              ? "bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                        )}
                      >
                        {initials(selectedPeerDisplay.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {selectedPeerDisplay.name}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <selectedPeerMeta.icon className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate text-xs text-muted-foreground">
                          {selectedPeerDisplay.sub}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn("gap-1", selectedPeerMeta.badge)}
                    >
                      <selectedPeerMeta.icon className="h-3 w-3" />
                      {selectedPeerMeta.label}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label="More options"
                      title="More options"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Messages list */}
                <div
                  ref={messagesContainerRef}
                  className="max-h-[500px] min-h-[320px] flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4"
                >
                  {messagesLoading ? (
                    <div className="space-y-3">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            "flex",
                            i % 2 === 0 ? "justify-start" : "justify-end"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[70%] space-y-2 rounded-2xl p-3",
                              i % 2 === 0
                                ? "bg-card"
                                : "bg-emerald-100 dark:bg-emerald-500/10"
                            )}
                          >
                            <Skeleton className="h-3 w-32" />
                            <Skeleton className="h-2.5 w-16" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 text-center">
                      <div className="relative">
                        <div className="absolute inset-0 animate-ping rounded-2xl bg-emerald-500/10" />
                        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-600 shadow-sm ring-1 ring-emerald-100 dark:from-emerald-500/10 dark:to-teal-500/10 dark:ring-emerald-500/20">
                          <MessageSquare className="h-7 w-7" />
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold">No messages yet</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Say hello to{" "}
                          <span className="font-medium">
                            {selectedPeerDisplay.name}
                          </span>
                          !
                        </p>
                      </div>
                    </div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {messages.map((m) => {
                        const fromMe = m.fromId === user.id
                        const ts = (() => {
                          try {
                            return format(
                              typeof m.createdAt === "string"
                                ? parseISO(m.createdAt)
                                : new Date(m.createdAt),
                              "MMM d, h:mm a"
                            )
                          } catch {
                            return ""
                          }
                        })()
                        return (
                          <motion.div
                            key={m.id}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.18 }}
                            className={cn(
                              "flex",
                              fromMe ? "justify-end" : "justify-start"
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-[80%] rounded-2xl p-3 shadow-sm sm:max-w-[70%]",
                                fromMe
                                  ? "rounded-br-sm bg-emerald-600 text-white"
                                  : "rounded-bl-sm bg-card text-card-foreground ring-1 ring-border"
                              )}
                            >
                              {m.attachmentName && (
                                <div
                                  className={cn(
                                    "mb-1.5 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
                                    fromMe
                                      ? "bg-emerald-700/40 text-emerald-50"
                                      : "bg-muted text-muted-foreground"
                                  )}
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  <span className="truncate">
                                    {m.attachmentName}
                                  </span>
                                </div>
                              )}
                              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                                {m.body}
                              </p>
                              <div
                                className={cn(
                                  "mt-1 flex items-center justify-end gap-1 text-[10px]",
                                  fromMe
                                    ? "text-emerald-100/80"
                                    : "text-muted-foreground"
                                )}
                              >
                                <span>{ts}</span>
                                {fromMe &&
                                  (m.readAt ? (
                                    <CheckCheck className="h-3 w-3" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  ))}
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  )}

                  {/* Typing indicator (simulated — shown when input focused) */}
                  <AnimatePresence>
                    {textareaFocused && selectedPeer && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="flex justify-start"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-card text-[9px] text-muted-foreground ring-1 ring-border">
                              {initials(selectedPeerDisplay.name)}
                            </AvatarFallback>
                          </Avatar>
                          <TypingDots />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div ref={bottomRef} />
                </div>

                {/* Input area */}
                <Separator />
                <div className="bg-card p-3">
                  <div className="flex items-end gap-2">
                    <div className="relative flex-1">
                      <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setTextareaFocused(true)}
                        onBlur={() => setTextareaFocused(false)}
                        placeholder={`Message ${selectedPeerDisplay.name}…`}
                        rows={1}
                        disabled={sending}
                        className="max-h-32 min-h-[44px] resize-none pr-2"
                        style={{
                          height: "auto",
                        }}
                        onInput={(e) => {
                          const el = e.currentTarget
                          el.style.height = "auto"
                          el.style.height = `${Math.min(
                            el.scrollHeight,
                            4 * 24 + 24
                          )}px`
                        }}
                      />
                    </div>
                    <Button
                      size="icon"
                      onClick={handleSend}
                      disabled={!input.trim() || sending}
                      className="h-11 w-11 shrink-0 bg-emerald-600 hover:bg-emerald-700"
                      aria-label="Send message"
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">
                    Press <kbd className="rounded bg-muted px-1 py-0.5 font-sans text-[9px]">Enter</kbd> to send,{" "}
                    <kbd className="rounded bg-muted px-1 py-0.5 font-sans text-[9px]">Shift+Enter</kbd> for new line
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick contact card for the selected peer (visible on desktop) */}
      {selectedPeer && (
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback
                className={cn(
                  "text-xs font-semibold",
                  selectedPeer.role === "DOCTOR"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : selectedPeer.role === "ORGANIZATION"
                      ? "bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                )}
              >
                {initials(selectedPeerDisplay.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {selectedPeerDisplay.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {selectedPeerDisplay.sub}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn("gap-1", selectedPeerMeta.badge)}
            >
              <Phone className="h-3 w-3" />
              Secure channel
            </Badge>
          </div>
        </Card>
      )}
    </div>
  )
}

export default function Messaging({
  role,
}: {
  role: UserRole
}) {
  return <MessagingImpl role={role as Role} />
}

export { Messaging }
