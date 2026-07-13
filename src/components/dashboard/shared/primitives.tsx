"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import { motion } from "framer-motion"
import { ArrowUpRight } from "lucide-react"

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendUp,
  color = "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10",
  accent = "from-emerald-500 to-teal-500",
  onClick,
}: {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: string
  trendUp?: boolean
  color?: string
  accent?: string
  onClick?: () => void
}) {
  const clickable = typeof onClick === "function"
  return (
    <Card
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `Open ${title}` : undefined}
      onClick={onClick}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick!()
              }
            }
          : undefined
      }
      className={cn(
        "group relative overflow-hidden transition-all duration-300",
        clickable &&
          "cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      )}
    >
      {/* Gradient accent bar on top */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1 bg-gradient-to-r transition-opacity duration-300",
          clickable ? "opacity-60 group-hover:opacity-100" : "opacity-0 group-hover:opacity-100",
          accent
        )}
      />
      {/* Decorative gradient blob */}
      <div
        className={cn(
          "absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br opacity-5 blur-2xl transition-opacity duration-300 group-hover:opacity-10",
          accent
        )}
      />
      {/* Decorative dotted pattern on hover */}
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "12px 12px",
        }}
      />
      {/* Click affordance: top-right arrow badge — always visible (low opacity), full on hover/focus */}
      {clickable && (
        <div
          className={cn(
            "absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-sm transition-all duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 group-hover:-translate-y-0.5 group-hover:translate-x-0.5",
            accent,
            "opacity-70"
          )}
          aria-hidden="true"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </div>
      )}
      <CardContent className="relative flex items-center justify-between p-5">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <p className="mt-1.5 text-3xl font-bold tracking-tight">{value}</p>
          {trend && (
            <p
              className={cn(
                "mt-1.5 flex items-center gap-1 truncate text-xs font-medium",
                trendUp === undefined
                  ? "text-muted-foreground"
                  : trendUp
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
              )}
            >
              {trendUp !== undefined && (
                <span className="text-[10px]">
                  {trendUp ? "▲" : "▼"}
                </span>
              )}
              {trend}
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/5 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md",
            color
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
      </CardContent>
    </Card>
  )
}

export function SectionHeader({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: LucideIcon
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-2.5 min-w-0">
        {Icon && (
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-10 text-center">
      <div className="relative mb-4">
        {/* Pulsing ring */}
        <div className="absolute inset-0 animate-ping rounded-2xl bg-emerald-500/10" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-600 shadow-sm ring-1 ring-emerald-100 dark:from-emerald-500/10 dark:to-teal-500/10 dark:ring-emerald-500/20">
          <Icon className="h-8 w-8" />
        </div>
      </div>
      <p className="font-semibold">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/**
 * A compact gradient hero banner for the top of dashboard tabs.
 */
export function HeroBanner({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string
  subtitle: string
  icon: LucideIcon
  children?: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-600 p-6 text-white shadow-lg shadow-emerald-500/20">
      {/* Decorative circles */}
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-16 right-20 h-32 w-32 rounded-full bg-teal-300/20 blur-2xl" />
      {/* Soft accent orb top-left */}
      <div className="absolute -left-10 -top-10 h-28 w-28 rounded-full bg-white/5 blur-2xl" />
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
              <Icon className="h-5 w-5" />
            </div>
          </div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            {title}
          </h1>
          <p className="mt-1 text-sm text-emerald-50/90">{subtitle}</p>
        </div>
        {children && <div className="shrink-0">{children}</div>}
      </div>
    </div>
  )
}

/**
 * Circular progress ring (SVG) — for goal tracking, adherence %, etc.
 */
export function MetricRing({
  value,
  size = 80,
  strokeWidth = 8,
  label,
  sublabel,
  colorTier = "auto",
}: {
  value: number // 0-100
  size?: number
  strokeWidth?: number
  label?: string
  sublabel?: string
  colorTier?: "auto" | "emerald" | "amber" | "rose" | "sky"
}) {
  const pct = Math.max(0, Math.min(100, value))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  let tier: "emerald" | "amber" | "rose" | "sky"
  if (colorTier === "auto") {
    if (pct >= 80) tier = "emerald"
    else if (pct >= 50) tier = "amber"
    else tier = "rose"
  } else {
    tier = colorTier
  }

  const strokeColor = {
    emerald: "#10b981",
    amber: "#f59e0b",
    rose: "#f43f5e",
    sky: "#0ea5e9",
  }[tier]

  const gradientId = `ring-grad-${tier}`

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={strokeColor} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.6" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label && (
          <span className="text-sm font-bold leading-none">{label}</span>
        )}
        {sublabel && (
          <span className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Info card — a small decorative card with icon, label, value, and optional hint.
 * Useful for compact metric displays in sidebars or grid sections.
 */
export function InfoCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "emerald",
  onClick,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  hint?: string
  accent?: "emerald" | "amber" | "rose" | "sky" | "teal" | "violet"
  onClick?: () => void
}) {
  const accentMap = {
    emerald: {
      bg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10",
      ring: "ring-emerald-100 dark:ring-emerald-500/20",
      glow: "group-hover:shadow-emerald-500/10",
    },
    amber: {
      bg: "bg-amber-50 text-amber-600 dark:bg-amber-500/10",
      ring: "ring-amber-100 dark:ring-amber-500/20",
      glow: "group-hover:shadow-amber-500/10",
    },
    rose: {
      bg: "bg-rose-50 text-rose-600 dark:bg-rose-500/10",
      ring: "ring-rose-100 dark:ring-rose-500/20",
      glow: "group-hover:shadow-rose-500/10",
    },
    sky: {
      bg: "bg-sky-50 text-sky-600 dark:bg-sky-500/10",
      ring: "ring-sky-100 dark:ring-sky-500/20",
      glow: "group-hover:shadow-sky-500/10",
    },
    teal: {
      bg: "bg-teal-50 text-teal-600 dark:bg-teal-500/10",
      ring: "ring-teal-100 dark:ring-teal-500/20",
      glow: "group-hover:shadow-teal-500/10",
    },
    violet: {
      bg: "bg-violet-50 text-violet-600 dark:bg-violet-500/10",
      ring: "ring-violet-100 dark:ring-violet-500/20",
      glow: "group-hover:shadow-violet-500/10",
    },
  }[accent]

  return (
    <Card
      className={cn(
        "group relative overflow-hidden p-4 transition-all duration-300",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
        accentMap.glow
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm ring-1 transition-transform duration-300 group-hover:scale-110",
            accentMap.bg,
            accentMap.ring
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 truncate text-lg font-semibold leading-tight">
            {value}
          </p>
          {hint && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {hint}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

/**
 * Quick action tile — square-ish clickable tile for dashboards.
 */
export function QuickAction({
  icon: Icon,
  label,
  description,
  accent = "emerald",
  onClick,
}: {
  icon: LucideIcon
  label: string
  description?: string
  accent?: "emerald" | "amber" | "rose" | "sky" | "teal" | "violet"
  onClick: () => void
}) {
  const accentMap = {
    emerald: "from-emerald-500 to-teal-600 shadow-emerald-500/20",
    amber: "from-amber-500 to-orange-600 shadow-amber-500/20",
    rose: "from-rose-500 to-red-600 shadow-rose-500/20",
    sky: "from-sky-500 to-cyan-600 shadow-sky-500/20",
    teal: "from-teal-500 to-emerald-600 shadow-teal-500/20",
    violet: "from-violet-500 to-fuchsia-600 shadow-violet-500/20",
  }[accent]

  return (
    <motion.button
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "group relative flex w-full flex-col items-start gap-3 overflow-hidden rounded-xl bg-gradient-to-br p-4 text-left text-white shadow-md transition-shadow hover:shadow-lg",
        accentMap
      )}
    >
      {/* Decorative pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
      />
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10 blur-xl transition-opacity group-hover:opacity-20" />
      <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
        <Icon className="h-5 w-5" />
      </div>
      <div className="relative min-w-0">
        <p className="text-sm font-semibold leading-tight">{label}</p>
        {description && (
          <p className="mt-0.5 text-[11px] leading-snug text-white/80">
            {description}
          </p>
        )}
      </div>
    </motion.button>
  )
}
