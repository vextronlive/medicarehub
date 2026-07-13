"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  format,
  formatDistanceToNow,
  differenceInCalendarDays,
  isToday as dfIsToday,
  isTomorrow as dfIsTomorrow,
} from "date-fns"
import {
  CalendarClock,
  Calendar,
  Clock,
  Ticket,
  MapPin,
  Stethoscope,
  User,
  AlertCircle,
  CheckCircle2,
  Radio,
  Bell,
} from "lucide-react"

import { useAuthStore } from "@/lib/auth-store"
import { apiFetch } from "@/lib/api"
import { cn, doctorName } from "@/lib/utils"
import {
  HeroBanner,
  EmptyState,
} from "@/components/dashboard/shared/primitives"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Person {
  id: string
  name: string
  mobile?: string | null
  bloodGroup?: string | null
  specialization?: string | null
  city?: string | null
}

interface Appointment {
  id: string
  patientId: string
  doctorId: string
  scheduledAt: string
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED"
  tokenNumber?: string | null
  reason?: string | null
  notes?: string | null
  patient: Person
  doctor: Person
}

type Role = "PATIENT" | "DOCTOR" | "ORGANIZATION"

interface CountdownParts {
  days: number
  hours: number
  minutes: number
  seconds: number
  totalSeconds: number
  isPast: boolean
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function getCountdown(target: Date, now: Date): CountdownParts {
  const totalSeconds = Math.floor((target.getTime() - now.getTime()) / 1000)
  const isPast = totalSeconds < 0
  const abs = Math.abs(totalSeconds)
  return {
    days: Math.floor(abs / 86400),
    hours: Math.floor((abs % 86400) / 3600),
    minutes: Math.floor((abs % 3600) / 60),
    seconds: abs % 60,
    totalSeconds,
    isPast,
  }
}

function relativeShort(target: Date, now: Date): string {
  if (dfIsToday(target)) return "Today"
  if (dfIsTomorrow(target)) return "Tomorrow"
  const d = differenceInCalendarDays(target, now)
  if (d > 1 && d <= 7) return `in ${d} days`
  if (d > 7) return `in ${Math.round(d / 7)} wk`
  if (d < 0) return formatDistanceToNow(target, { addSuffix: true, now })
  return formatDistanceToNow(target, { addSuffix: true, now })
}

function initials(name: string): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Role-aware label: who is the "other party" the current viewer cares about? */
function counterpartyLabel(role: Role, appt: Appointment) {
  if (role === "PATIENT") {
    return {
      primary: doctorName(appt.doctor.name || "Doctor"),
      secondary: appt.doctor.specialization || "General Practitioner",
      city: appt.doctor.city,
      avatarName: appt.doctor.name,
      icon: Stethoscope,
    }
  }
  // DOCTOR or ORGANIZATION → look at the patient
  return {
    primary: appt.patient.name || "Patient",
    secondary: appt.patient.bloodGroup
      ? `Blood group ${appt.patient.bloodGroup}`
      : "Patient",
    city: undefined,
    avatarName: appt.patient.name,
    icon: User,
  }
}

/* ------------------------------------------------------------------ */
/* Countdown boxes (4 small boxes in a row)                            */
/* ------------------------------------------------------------------ */

function CountdownBoxes({
  target,
  now,
  variant = "default",
  pulse = false,
}: {
  target: Date
  now: Date
  variant?: "default" | "featured"
  pulse?: boolean
}) {
  const c = getCountdown(target, now)

  const boxes: { label: string; value: number }[] = [
    { label: "Days", value: c.days },
    { label: "Hours", value: c.hours },
    { label: "Minutes", value: c.minutes },
    { label: "Seconds", value: c.seconds },
  ]

  if (variant === "featured") {
    return (
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {boxes.map((b) => (
          <div
            key={b.label}
            className={cn(
              "rounded-xl bg-white/15 ring-1 ring-white/20 backdrop-blur-sm",
              pulse && b.label === "Seconds" && "animate-pulse"
            )}
          >
            <div className="px-1 py-2 text-center sm:py-3">
              <div className="font-mono text-2xl font-bold tabular-nums text-white sm:text-4xl">
                {String(b.value).padStart(2, "0")}
              </div>
              <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-50/80 sm:text-xs">
                {b.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
      {boxes.map((b) => (
        <div
          key={b.label}
          className={cn(
            "rounded-lg bg-emerald-50 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/20",
            pulse && b.label === "Seconds" && "animate-pulse"
          )}
        >
          <div className="px-1 py-1.5 text-center">
            <div className="font-mono text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300 sm:text-2xl">
              {String(b.value).padStart(2, "0")}
            </div>
            <div className="text-[9px] font-medium uppercase tracking-wide text-emerald-700/60 dark:text-emerald-300/60 sm:text-[10px]">
              {b.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Status pill                                                         */
/* ------------------------------------------------------------------ */

function StatusPill({ status }: { status: Appointment["status"] }) {
  if (status === "CONFIRMED") {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />
        Confirmed
      </Badge>
    )
  }
  if (status === "PENDING") {
    return (
      <Badge className="gap-1 bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300">
        <Clock className="h-3 w-3" />
        Awaiting confirmation
      </Badge>
    )
  }
  if (status === "COMPLETED") {
    return (
      <Badge className="gap-1 bg-slate-100 text-slate-600 hover:bg-slate-100 dark:bg-slate-500/15 dark:text-slate-300">
        <CheckCircle2 className="h-3 w-3" />
        Completed
      </Badge>
    )
  }
  return (
    <Badge className="gap-1 bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300">
      <AlertCircle className="h-3 w-3" />
      Cancelled
    </Badge>
  )
}

/* ------------------------------------------------------------------ */
/* Smart reminder badge                                                */
/* ------------------------------------------------------------------ */

function ReminderBadge({
  target,
  now,
  status,
}: {
  target: Date
  now: Date
  status: Appointment["status"]
}) {
  // Overdue: past PENDING appointment that didn't get confirmed
  if (status === "PENDING" && target.getTime() < now.getTime()) {
    return (
      <Badge className="gap-1 bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300">
        <AlertCircle className="h-3 w-3" />
        Overdue
      </Badge>
    )
  }
  if (dfIsToday(target)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600" />
        </span>
        Today
      </span>
    )
  }
  if (dfIsTomorrow(target)) {
    return (
      <Badge className="gap-1 bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300">
        <Bell className="h-3 w-3" />
        Tomorrow
      </Badge>
    )
  }
  const d = differenceInCalendarDays(target, now)
  if (d > 1 && d <= 7) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-emerald-200 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300"
      >
        <Calendar className="h-3 w-3" />
        In {d} days
      </Badge>
    )
  }
  if (d > 7) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-slate-200 text-slate-600 dark:border-slate-500/30 dark:text-slate-300"
      >
        <Calendar className="h-3 w-3" />
        In {Math.round(d / 7)} wk
      </Badge>
    )
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Token badge                                                         */
/* ------------------------------------------------------------------ */

function TokenBadge({
  token,
  variant = "default",
}: {
  token?: string | null
  variant?: "default" | "featured"
}) {
  if (!token) return null
  if (variant === "featured") {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/90 px-3 py-1 text-sm font-bold text-amber-950 shadow-sm ring-1 ring-amber-300/50">
        <Ticket className="h-4 w-4" />
        Token #{token}
      </div>
    )
  }
  return (
    <div className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
      <Ticket className="h-3 w-3" />
      #{token}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Action hint                                                         */
/* ------------------------------------------------------------------ */

function ActionHint({ status }: { status: Appointment["status"] }) {
  if (status === "CONFIRMED") {
    return (
      <p className="flex items-start gap-1.5 text-xs text-emerald-50/90">
        <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Plan to leave 30 min before your slot.
      </p>
    )
  }
  return (
    <p className="flex items-start gap-1.5 text-xs text-emerald-50/90">
      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      We&apos;ll notify you when the doctor confirms.
    </p>
  )
}

/* ------------------------------------------------------------------ */
/* Featured card (next-up)                                             */
/* ------------------------------------------------------------------ */

function FeaturedCard({
  appt,
  role,
  now,
}: {
  appt: Appointment
  role: Role
  now: Date
}) {
  const cp = counterpartyLabel(role, appt)
  const target = new Date(appt.scheduledAt)
  const CpIcon = cp.icon
  const isToday = dfIsToday(target)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-600 p-5 text-white shadow-lg shadow-emerald-500/20 sm:p-6"
    >
      {/* Decorative blobs */}
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-16 right-24 h-32 w-32 rounded-full bg-teal-300/20 blur-2xl" />
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            Next up
          </div>
          <div className="flex items-center gap-2">
            <TokenBadge token={appt.tokenNumber} variant="featured" />
            <StatusPill status={appt.status} />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          {/* Left: counterparty + schedule */}
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <Avatar className="h-12 w-12 shrink-0 border-2 border-white/30 bg-white/15">
                <AvatarFallback className="bg-transparent font-bold text-white">
                  {initials(cp.avatarName || "")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-50/80">
                  <CpIcon className="h-3.5 w-3.5" />
                  {role === "PATIENT" ? "With" : "Patient"}
                </div>
                <h3 className="mt-0.5 truncate text-lg font-bold tracking-tight sm:text-xl">
                  {cp.primary}
                </h3>
                <p className="truncate text-sm text-emerald-50/90">
                  {cp.secondary}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              <span className="inline-flex items-center gap-1.5 text-emerald-50/90">
                <Calendar className="h-3.5 w-3.5" />
                {format(target, "EEE, dd MMM yyyy")}
              </span>
              <span className="inline-flex items-center gap-1.5 text-emerald-50/90">
                <Clock className="h-3.5 w-3.5" />
                {format(target, "h:mm a")}
              </span>
              {cp.city && (
                <span className="inline-flex items-center gap-1.5 text-emerald-50/90">
                  <MapPin className="h-3.5 w-3.5" />
                  {cp.city}
                </span>
              )}
            </div>

            {appt.reason && (
              <p className="mt-2 line-clamp-2 text-sm text-emerald-50/80">
                Reason: {appt.reason}
              </p>
            )}

            <div className="mt-4">
              <ActionHint status={appt.status} />
            </div>
          </div>

          {/* Right: live countdown */}
          <div className="lg:min-w-[320px]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-emerald-50/80">
                {isToday ? "Starts in" : "Countdown"}
              </span>
              <span className="font-mono text-xs text-emerald-50/80">
                {relativeShort(target, now)}
              </span>
            </div>
            <CountdownBoxes
              target={target}
              now={now}
              variant="featured"
              pulse={isToday}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* Today card                                                          */
/* ------------------------------------------------------------------ */

function TodayCard({
  appt,
  role,
  now,
}: {
  appt: Appointment
  role: Role
  now: Date
}) {
  const cp = counterpartyLabel(role, appt)
  const target = new Date(appt.scheduledAt)
  const CpIcon = cp.icon
  const c = getCountdown(target, now)
  const startsIn = c.isPast
    ? "Started"
    : `Starts in ${String(c.hours).padStart(2, "0")}:${String(c.minutes).padStart(2, "0")}:${String(c.seconds).padStart(2, "0")}`

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/20 dark:bg-emerald-500/5">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <Avatar className="h-10 w-10 shrink-0 border border-emerald-200 bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/15">
                <AvatarFallback className="bg-transparent text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  {initials(cp.avatarName || "")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="truncate font-semibold leading-tight">
                    {cp.primary}
                  </h4>
                  <CpIcon className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {cp.secondary}
                  {cp.city ? ` · ${cp.city}` : ""}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(target, "h:mm a")}
                  </span>
                  <TokenBadge token={appt.tokenNumber} />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600" />
                </span>
                Live today
              </span>
              <span className="font-mono text-xs font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {startsIn}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* Upcoming compact card                                               */
/* ------------------------------------------------------------------ */

function UpcomingCard({
  appt,
  role,
  now,
}: {
  appt: Appointment
  role: Role
  now: Date
}) {
  const cp = counterpartyLabel(role, appt)
  const target = new Date(appt.scheduledAt)
  const CpIcon = cp.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-emerald-500/5">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            {/* Left: date block + counterparty */}
            <div className="flex min-w-0 items-start gap-3">
              {/* Date block */}
              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20">
                <span className="text-[10px] font-bold uppercase leading-none">
                  {format(target, "MMM")}
                </span>
                <span className="text-lg font-bold leading-none">
                  {format(target, "dd")}
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="truncate font-semibold leading-tight">
                    {cp.primary}
                  </h4>
                  <CpIcon className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {cp.secondary}
                  {cp.city ? ` · ${cp.city}` : ""}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(target, "EEE, dd MMM")}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(target, "h:mm a")}
                  </span>
                  <TokenBadge token={appt.tokenNumber} />
                </div>
              </div>
            </div>

            {/* Right: relative + status + reminder badge */}
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {relativeShort(target, now)}
              </span>
              <div className="flex items-center gap-1.5">
                <ReminderBadge target={target} now={now} status={appt.status} />
                <StatusPill status={appt.status} />
              </div>
            </div>
          </div>

          <Separator className="my-3" />

          <CountdownBoxes target={target} now={now} />
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* Past compact item                                                   */
/* ------------------------------------------------------------------ */

function PastItem({
  appt,
  role,
  now,
}: {
  appt: Appointment
  role: Role
  now: Date
}) {
  const cp = counterpartyLabel(role, appt)
  const target = new Date(appt.scheduledAt)
  const CpIcon = cp.icon

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-200 bg-muted/20 px-4 py-3 opacity-70 dark:border-slate-700 dark:bg-muted/10">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400">
          <CpIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{cp.primary}</p>
          <p className="truncate text-xs text-muted-foreground">
            {format(target, "dd MMM yyyy, h:mm a")}
            {appt.tokenNumber ? ` · Token #${appt.tokenNumber}` : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(target, { addSuffix: true, now })}
        </span>
        <StatusPill status={appt.status} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Loading skeleton                                                    */
/* ------------------------------------------------------------------ */

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <Skeleton className="h-24 rounded-xl" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section heading with live clock                                     */
/* ------------------------------------------------------------------ */

function HeaderWithClock({ now }: { now: Date }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
          <CalendarClock className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">
            Your Schedule
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Live countdowns to your next visits — updated every second.
          </p>
        </div>
      </div>
      <div className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-1.5 text-right dark:border-emerald-500/20 dark:bg-emerald-500/5">
        <div className="flex items-center justify-end gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600" />
          </span>
          Live
        </div>
        <div className="font-mono text-xs font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
          {format(now, "dd MMM, h:mm:ss a")}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function AppointmentReminders({ role }: { role: Role }) {
  const user = useAuthStore((s) => s.user)
  const [appointments, setAppointments] = useState<Appointment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Bump this to trigger a manual re-fetch (e.g. the "Try again" button).
  const [reloadNonce, setReloadNonce] = useState(0)
  // tick state — incremented every second inside a setInterval callback (NOT
  // a synchronous effect body) so the lint rule `react-hooks/set-state-in-effect`
  // is happy. Each tick triggers a re-render, and `now` is recomputed below.
  const [tick, setTick] = useState(0)

  // Live clock — single setInterval, functional setState in the callback.
  // setInterval callbacks are NOT synchronous effect bodies, so this is safe.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Derive "now" from the latest tick so countdowns update each second without
  // storing a Date in state.
  const now = useMemo(() => new Date(), [tick])

  // Initial + role/user-change fetch. The actual setState calls happen AFTER
  // `await`, so they are not synchronous effect bodies — lint-safe.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      try {
        const data = await apiFetch<{ appointments: Appointment[] }>(
          `/api/appointments?userId=${encodeURIComponent(user.id)}&role=${encodeURIComponent(role)}`
        )
        if (cancelled) return
        setAppointments(data.appointments ?? [])
        setError(null)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to load appointments")
        setAppointments([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, role, reloadNonce])

  // Poll for backend status changes (e.g. confirmations) every 60s.
  // setInterval callback is NOT a synchronous effect body, so setState is fine.
  useEffect(() => {
    if (!user) return
    const id = window.setInterval(() => {
      void (async () => {
        try {
          const data = await apiFetch<{ appointments: Appointment[] }>(
            `/api/appointments?userId=${encodeURIComponent(user.id)}&role=${encodeURIComponent(role)}`
          )
          setAppointments(data.appointments ?? [])
          setError(null)
        } catch {
          // Swallow polling errors — the user can still see stale data.
        }
      })()
    }, 60000)
    return () => window.clearInterval(id)
  }, [user, role])

  // Re-bucket on every tick. The sort runs over a small array so the cost is
  // negligible, and this guarantees an appointment flips from upcoming → past
  // the moment its scheduled time elapses.
  const partitions = useMemo(() => {
    if (!appointments) {
      return { featured: null, today: [], upcoming: [], past: [] }
    }

    const upcomingAll = appointments
      .filter(
        (a) =>
          (a.status === "PENDING" || a.status === "CONFIRMED") &&
          new Date(a.scheduledAt).getTime() > now.getTime()
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() -
          new Date(b.scheduledAt).getTime()
      )

    const featured = upcomingAll[0] ?? null

    // Today's confirmed appointments, excluding the featured one to avoid dupes.
    const today = upcomingAll
      .filter(
        (a) =>
          a.id !== featured?.id &&
          a.status === "CONFIRMED" &&
          dfIsToday(new Date(a.scheduledAt))
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() -
          new Date(b.scheduledAt).getTime()
      )

    // Other upcoming (not featured, not today-confirmed).
    const upcoming = upcomingAll.filter((a) => {
      if (a.id === featured?.id) return false
      if (a.status === "CONFIRMED" && dfIsToday(new Date(a.scheduledAt)))
        return false
      return true
    })

    const past = appointments
      .filter((a) => a.status === "COMPLETED" || a.status === "CANCELLED")
      .sort(
        (a, b) =>
          new Date(b.scheduledAt).getTime() -
          new Date(a.scheduledAt).getTime()
      )
      .slice(0, 3)

    return { featured, today, upcoming, past }
  }, [appointments, now])

  // Defensive: if user is null, render nothing.
  if (!user) return null

  const totalCount = appointments?.length ?? 0
  const hasAny = totalCount > 0
  const showEmpty = appointments !== null && !hasAny && !error

  return (
    <div className="space-y-6">
      <HeroBanner
        title="Appointment Reminders"
        subtitle="Stay on top of your upcoming visits with smart countdown timers and reminders."
        icon={CalendarClock}
      />

      <HeaderWithClock now={now} />

      {error && (
        <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-500/20 dark:bg-rose-500/5">
          <CardContent className="flex items-start gap-3 p-5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                Couldn&apos;t load appointments
              </p>
              <p className="mt-0.5 text-sm text-rose-700/80 dark:text-rose-300/80">
                {error}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 border-rose-200 text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:text-rose-300"
                onClick={() => setReloadNonce((n) => n + 1)}
              >
                Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {appointments === null && !error && <LoadingSkeleton />}

      {showEmpty && (
        <EmptyState
          icon={CalendarClock}
          title="No appointments scheduled"
          description="Book your first appointment to see countdown timers here."
        />
      )}

      {hasAny && (
        <AnimatePresence mode="wait">
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Featured next-up */}
            {partitions.featured && (
              <FeaturedCard
                appt={partitions.featured}
                role={role}
                now={now}
              />
            )}

            {/* Today section */}
            {partitions.today.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Today
                  </h3>
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300">
                    {partitions.today.length}
                  </Badge>
                </div>
                <div className="space-y-3">
                  {partitions.today.map((a) => (
                    <TodayCard key={a.id} appt={a} role={role} now={now} />
                  ))}
                </div>
              </section>
            )}

            {/* All upcoming list */}
            {partitions.upcoming.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Upcoming
                  </h3>
                  <Badge
                    variant="outline"
                    className="border-emerald-200 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300"
                  >
                    {partitions.upcoming.length}
                  </Badge>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {partitions.upcoming.map((a) => (
                    <UpcomingCard key={a.id} appt={a} role={role} now={now} />
                  ))}
                </div>
              </section>
            )}

            {/* Recent past */}
            {partitions.past.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Recent history
                  </h3>
                </div>
                <div className="space-y-2">
                  {partitions.past.map((a) => (
                    <PastItem key={a.id} appt={a} role={role} now={now} />
                  ))}
                </div>
              </section>
            )}

            {/* Edge case: appointments exist but none are upcoming and none are recent past */}
            {!partitions.featured &&
              partitions.today.length === 0 &&
              partitions.upcoming.length === 0 &&
              partitions.past.length === 0 && (
                <EmptyState
                  icon={CalendarClock}
                  title="No active reminders"
                  description="You have appointments on record, but none are upcoming or recently completed."
                />
              )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}

export default AppointmentReminders
