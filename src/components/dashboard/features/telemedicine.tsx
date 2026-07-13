"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { format, parseISO } from "date-fns"
import { toast } from "sonner"
import {
  Video,
  Copy,
  Phone,
  PhoneOff,
  Calendar,
  Clock,
  ExternalLink,
  Signal,
  Radio,
  Loader2,
  Ticket,
  User,
  Stethoscope,
} from "lucide-react"

import { useAuthStore, type UserRole } from "@/lib/auth-store"
import { apiFetch } from "@/lib/api"
import { cn, doctorName, initials } from "@/lib/utils"
import {
  HeroBanner,
  StatCard,
  SectionHeader,
  EmptyState,
} from "@/components/dashboard/shared/primitives"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

// --- Types -----------------------------------------------------------------
type SessionStatus = "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED"

interface Person {
  id: string
  name: string
  mobile?: string
  specialization?: string
  city?: string
  bloodGroup?: string
}

interface AppointmentRow {
  id: string
  scheduledAt: string
  status: string
  reason: string
  tokenNumber: string
  patient: Person
  doctor: Person
  org?: { id: string; name: string; city?: string } | null
  notes?: string | null
}

interface TelemedicineSession {
  id: string
  appointmentId: string
  meetingId: string
  meetingUrl: string
  hostPin: string
  participantPin: string
  status: SessionStatus
  startedAt: string | null
  endedAt: string | null
  createdAt: string
  updatedAt: string
  appointment: AppointmentRow
}

// --- Status meta -----------------------------------------------------------
const STATUS_META: Record<
  SessionStatus,
  { label: string; dot: string; badge: string }
> = {
  SCHEDULED: {
    label: "Scheduled",
    dot: "bg-sky-500",
    badge:
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30",
  },
  LIVE: {
    label: "Live Now",
    dot: "bg-rose-500 animate-pulse",
    badge:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30",
  },
  ENDED: {
    label: "Ended",
    dot: "bg-muted-foreground",
    badge: "bg-muted text-muted-foreground border-border",
  },
  CANCELLED: {
    label: "Cancelled",
    dot: "bg-muted-foreground",
    badge:
      "bg-muted text-muted-foreground border-border line-through",
  },
}

// --- Clipboard helper ------------------------------------------------------
async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied`, {
      description: text,
    })
  } catch {
    toast.error("Failed to copy", {
      description: "Please copy the value manually.",
    })
  }
}

// --- Implementation --------------------------------------------------------
function TelemedicineImpl({ role }: { role: UserRole }) {
  const user = useAuthStore((s) => s.user)

  const [loading, setLoading] = useState(true)
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [sessions, setSessions] = useState<
    Record<string, TelemedicineSession | null>
  >({})
  const [sessionsLoading, setSessionsLoading] = useState<
    Record<string, boolean>
  >({})
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>(
    {}
  )

  const loadAppointments = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await apiFetch<{ appointments: AppointmentRow[] }>(
        `/api/appointments?userId=${user.id}&role=${role}&status=CONFIRMED`
      )
      const appts = data.appointments || []
      setAppointments(appts)
      setSessions({})
      setSessionsLoading({})

      // Lazily fetch sessions for each appointment in parallel.
      await Promise.all(
        appts.map(async (a) => {
          setSessionsLoading((s) => ({ ...s, [a.id]: true }))
          try {
            const sd = await apiFetch<{ session: TelemedicineSession | null }>(
              `/api/telemedicine?appointmentId=${a.id}`
            )
            setSessions((s) => ({ ...s, [a.id]: sd.session ?? null }))
          } catch {
            setSessions((s) => ({ ...s, [a.id]: null }))
          } finally {
            setSessionsLoading((s) => ({ ...s, [a.id]: false }))
          }
        })
      )
    } catch (e) {
      toast.error("Failed to load appointments", {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [user, role])

  useEffect(() => {
    loadAppointments()
  }, [loadAppointments])

  // --- Mutations ----------------------------------------------------------
  const handleGenerate = async (appointmentId: string) => {
    setActionLoading((s) => ({ ...s, [appointmentId]: true }))
    try {
      const data = await apiFetch<{ session: TelemedicineSession }>(
        "/api/telemedicine",
        {
          method: "POST",
          body: JSON.stringify({ appointmentId }),
        }
      )
      setSessions((s) => ({ ...s, [appointmentId]: data.session }))
      toast.success("Meeting link generated", {
        description: `Meeting ID: ${data.session.meetingId}`,
      })
    } catch (e) {
      toast.error("Failed to generate meeting link", {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setActionLoading((s) => ({ ...s, [appointmentId]: false }))
    }
  }

  const handleStart = async (appointmentId: string) => {
    setActionLoading((s) => ({ ...s, [appointmentId]: true }))
    try {
      const data = await apiFetch<{ session: TelemedicineSession }>(
        "/api/telemedicine",
        {
          method: "POST",
          body: JSON.stringify({ appointmentId, action: "start" }),
        }
      )
      setSessions((s) => ({ ...s, [appointmentId]: data.session }))
      toast.success("Consultation started", {
        description: "Opening the meeting room in a new tab…",
      })
      if (data.session.meetingUrl) {
        window.open(data.session.meetingUrl, "_blank")
      }
    } catch (e) {
      toast.error("Failed to start consultation", {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setActionLoading((s) => ({ ...s, [appointmentId]: false }))
    }
  }

  const handleEnd = async (appointmentId: string) => {
    setActionLoading((s) => ({ ...s, [appointmentId]: true }))
    try {
      const data = await apiFetch<{ session: TelemedicineSession }>(
        "/api/telemedicine",
        {
          method: "POST",
          body: JSON.stringify({ appointmentId, action: "end" }),
        }
      )
      setSessions((s) => ({ ...s, [appointmentId]: data.session }))
      toast.success("Consultation ended", {
        description: "The session has been marked as ended.",
      })
    } catch (e) {
      toast.error("Failed to end consultation", {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setActionLoading((s) => ({ ...s, [appointmentId]: false }))
    }
  }

  const handleJoin = (url: string) => {
    if (!url) {
      toast.error("Meeting URL not available")
      return
    }
    window.open(url, "_blank")
    toast.info("Opening meeting room in a new tab…")
  }

  // --- Guard --------------------------------------------------------------
  if (!user) return null

  const isPatient = role === "PATIENT"
  const isHost = role === "DOCTOR" || role === "ORGANIZATION"

  const scheduledCount = appointments.filter(
    (a) => !sessions[a.id] || sessions[a.id]?.status === "SCHEDULED"
  ).length
  const liveCount = appointments.filter(
    (a) => sessions[a.id]?.status === "LIVE"
  ).length
  const endedCount = appointments.filter(
    (a) => sessions[a.id]?.status === "ENDED"
  ).length

  return (
    <div className="space-y-6">
      <HeroBanner
        icon={Video}
        title={isPatient ? "Video Consultations" : "Patient Consultations"}
        subtitle={
          isPatient
            ? "Join secure telemedicine sessions with your doctors for confirmed appointments."
            : "Start or join telemedicine sessions with your patients."
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Scheduled"
          value={scheduledCount}
          icon={Calendar}
          color="bg-sky-50 text-sky-600 dark:bg-sky-500/10"
          accent="from-sky-500 to-cyan-500"
        />
        <StatCard
          title="Live Now"
          value={liveCount}
          icon={Radio}
          color="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
          accent="from-emerald-500 to-teal-500"
        />
        <StatCard
          title="Ended"
          value={endedCount}
          icon={PhoneOff}
          color="bg-muted text-muted-foreground"
          accent="from-slate-400 to-slate-500"
        />
      </div>

      <SectionHeader
        title={isPatient ? "Your Appointments" : "Patient Appointments"}
        description="Confirmed appointments eligible for telemedicine."
        icon={Video}
      />

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="gap-4 p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-36" />
                <Skeleton className="h-9 w-24" />
              </div>
            </Card>
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={Video}
          title="No confirmed appointments yet"
          description="Book an appointment first to enable video consultations."
        />
      ) : (
        <div className="space-y-4">
          {appointments.map((appt, idx) => {
            const session = sessions[appt.id]
            const sessionFetching = sessionsLoading[appt.id]
            const isActioning = actionLoading[appt.id] || false

            const otherPartyName = isPatient
              ? doctorName(appt.doctor?.name || "")
              : appt.patient?.name || "Patient"
            const otherPartySub = isPatient
              ? appt.doctor?.specialization || "Doctor"
              : appt.patient?.mobile || "—"
            const pin = isHost ? session?.hostPin : session?.participantPin
            const pinLabel = isHost ? "Host PIN" : "Participant PIN"
            const scheduled = parseISO(appt.scheduledAt)

            return (
              <motion.div
                key={appt.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
              >
                <Card className="gap-4 p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                          {initials(otherPartyName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">
                          {otherPartyName}
                        </CardTitle>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
                          {isPatient ? (
                            <Stethoscope className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <User className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span className="truncate">{otherPartySub}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <Badge variant="outline" className="gap-1 font-mono">
                        <Ticket className="h-3 w-3" />
                        {appt.tokenNumber}
                      </Badge>
                      {sessionFetching && !session ? (
                        <Skeleton className="h-6 w-24 rounded-md" />
                      ) : session ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1.5",
                            STATUS_META[session.status].badge
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              STATUS_META[session.status].dot
                            )}
                          />
                          {STATUS_META[session.status].label}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  {/* Body */}
                  <CardContent className="space-y-2 px-0 text-sm">
                    <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{format(scheduled, "EEE, MMM d, yyyy")}</span>
                      <Separator orientation="vertical" className="h-4" />
                      <Clock className="h-4 w-4" />
                      <span>{format(scheduled, "p")}</span>
                    </div>
                    {appt.reason && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Reason: </span>
                        <span className="font-medium">{appt.reason}</span>
                      </div>
                    )}
                  </CardContent>

                  {/* Session details */}
                  {session && (
                    <>
                      <Separator />
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">
                              Meeting ID
                            </p>
                            <p className="truncate font-mono text-sm font-medium">
                              {session.meetingId}
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={() =>
                              copyToClipboard(session.meetingId, "Meeting ID")
                            }
                            title="Copy Meeting ID"
                            aria-label="Copy Meeting ID"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">
                              {pinLabel}
                            </p>
                            <p className="truncate font-mono text-sm font-medium">
                              {pin || "—"}
                            </p>
                          </div>
                          {pin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0"
                              onClick={() => copyToClipboard(pin, pinLabel)}
                              title={`Copy ${pinLabel}`}
                              aria-label={`Copy ${pinLabel}`}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {session.status === "ENDED" && session.startedAt && (
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Signal className="h-3 w-3" />
                            Started:{" "}
                            {format(parseISO(session.startedAt), "MMM d, p")}
                          </span>
                          {session.endedAt && (
                            <span className="flex items-center gap-1">
                              <PhoneOff className="h-3 w-3" />
                              Ended:{" "}
                              {format(parseISO(session.endedAt), "MMM d, p")}
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    {!session && (
                      <Button
                        onClick={() => handleGenerate(appt.id)}
                        disabled={sessionFetching || isActioning}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        {isActioning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Video className="h-4 w-4" />
                        )}
                        Generate Meeting Link
                      </Button>
                    )}

                    {session?.status === "SCHEDULED" && (
                      <>
                        <Button
                          onClick={() => handleStart(appt.id)}
                          disabled={isActioning}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          {isActioning ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Phone className="h-4 w-4" />
                          )}
                          Start Consultation
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            copyToClipboard(
                              session.meetingUrl,
                              "Meeting link"
                            )
                          }
                        >
                          <Copy className="h-4 w-4" />
                          Copy Link
                        </Button>
                      </>
                    )}

                    {session?.status === "LIVE" && (
                      <>
                        <Button
                          onClick={() => handleJoin(session.meetingUrl)}
                          className="relative bg-rose-600 hover:bg-rose-700"
                        >
                          <span className="absolute -left-1.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 animate-ping rounded-full bg-rose-200" />
                          <ExternalLink className="h-4 w-4" />
                          {isHost ? "Join as Host" : "Join Now"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            copyToClipboard(
                              session.meetingUrl,
                              "Meeting link"
                            )
                          }
                        >
                          <Copy className="h-4 w-4" />
                          Copy Link
                        </Button>
                        {isHost && (
                          <Button
                            variant="destructive"
                            onClick={() => handleEnd(appt.id)}
                            disabled={isActioning}
                          >
                            {isActioning ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <PhoneOff className="h-4 w-4" />
                            )}
                            End Consultation
                          </Button>
                        )}
                      </>
                    )}

                    {session?.status === "ENDED" && (
                      <Badge variant="secondary" className="gap-1.5">
                        <PhoneOff className="h-3.5 w-3.5" />
                        Session Ended
                      </Badge>
                    )}

                    {session?.status === "CANCELLED" && (
                      <Badge variant="secondary" className="gap-1.5">
                        <PhoneOff className="h-3.5 w-3.5" />
                        Session Cancelled
                      </Badge>
                    )}
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Telemedicine({ role }: { role: UserRole }) {
  return <TelemedicineImpl role={role} />
}

export { Telemedicine }
