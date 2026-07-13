"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

import { apiFetch } from "@/lib/api"
import { cn, initials } from "@/lib/utils"
import {
  StatCard,
  EmptyState,
  HeroBanner,
} from "@/components/dashboard/shared/primitives"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import {
  ShieldCheck,
  Search,
  Building2,
  Phone,
  Mail,
  Globe,
  Star,
  StarHalf,
  ExternalLink,
  X,
  Loader2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Plus,
  Hotel,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  Crown,
  HeartPulse,
} from "lucide-react"

// ─────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────
type SortKey = "rating" | "networkHospitals" | "name"

interface CategoryOption {
  value: string
  label: string
  color: string
}

const CATEGORIES: CategoryOption[] = [
  { value: "HEALTH", label: "Health", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
  { value: "LIFE", label: "Life", color: "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300" },
  { value: "CRITICAL_ILLNESS", label: "Critical Illness", color: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" },
  { value: "FAMILY_FLOATER", label: "Family Floater", color: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
  { value: "SENIOR_CITIZEN", label: "Senior Citizen", color: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300" },
]

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label])
)
const CATEGORY_COLOR: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.color])
)

interface Provider {
  id: string
  name: string
  logoUrl?: string | null
  website?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  categories: string[]
  networkHospitals: number
  cashless: boolean
  rating: number
  isActive: boolean
  createdAt?: string
}

interface ProvidersResponse {
  providers: Provider[]
}

interface AddProviderBody {
  name: string
  website?: string
  contactPhone?: string
  contactEmail?: string
  categories: string[]
  cashless: boolean
  networkHospitals: number
  logoUrl?: string
}

const PAGE_SIZE = 9

// ─────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────
function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const full = Math.floor(rating)
  const hasHalf = rating - full >= 0.5
  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating ${rating.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => {
        if (i < full)
          return <Star key={i} size={size} className="fill-amber-400 text-amber-400" />
        if (i === full && hasHalf)
          return <StarHalf key={i} size={size} className="fill-amber-400 text-amber-400" />
        return <Star key={i} size={size} className="text-amber-300/50 dark:text-amber-500/30" />
      })}
    </div>
  )
}

function providerInitials(name: string): string {
  if (!name) return "?"
  const cleaned = name
    .replace(/\b(insurance|general|health|&|allied|co)\b/gi, "")
    .trim()
  const parts = cleaned.split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((w) => w[0]).join("").toUpperCase() || initials(name)
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
}

// ─────────────────────────────────────────────────────────
//  Provider Card
// ─────────────────────────────────────────────────────────
function ProviderCard({
  provider,
  onView,
  onAdd,
  index,
}: {
  provider: Provider
  onView: () => void
  onAdd: () => void
  index: number
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4) }}
    >
      <Card className="group relative flex h-full flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/5">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-500 opacity-0 transition-opacity group-hover:opacity-100" />
        <CardContent className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-sm font-bold text-white ring-2 ring-emerald-100 dark:ring-emerald-500/20">
              {provider.logoUrl ? (
                <img
                  src={provider.logoUrl}
                  alt={`${provider.name} logo`}
                  className="h-full w-full rounded-xl object-cover"
                />
              ) : (
                providerInitials(provider.name)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 font-semibold leading-tight">{provider.name}</h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {provider.cashless && (
                  <Badge className="h-5 gap-0.5 bg-emerald-100 px-2 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <CheckCircle2 size={10} />
                    Cashless
                  </Badge>
                )}
                {provider.rating >= 4.2 && (
                  <Badge className="h-5 gap-0.5 bg-amber-100 px-2 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    <Crown size={10} />
                    Top Rated
                  </Badge>
                )}
                {provider.networkHospitals >= 10000 && (
                  <Badge className="h-5 gap-0.5 bg-teal-100 px-2 text-[10px] font-semibold text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
                    <Hotel size={10} />
                    Large Network
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {provider.categories.slice(0, 3).map((c) => (
              <span
                key={c}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[10px] font-medium",
                  CATEGORY_COLOR[c] ||
                    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                )}
              >
                {CATEGORY_LABEL[c] || c}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border bg-muted/30 p-2">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Hotel size={11} className="text-teal-600 dark:text-teal-400" />
                Network
              </div>
              <p className="mt-0.5 text-sm font-bold">
                {formatNumber(provider.networkHospitals)}
                <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">hospitals</span>
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-2">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Star size={11} className="text-amber-500" />
                Rating
              </div>
              <p className="mt-0.5 text-sm font-bold">{provider.rating.toFixed(1)}<span className="ml-0.5 text-[10px] font-normal text-muted-foreground">/ 5</span></p>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            {provider.contactPhone && (
              <a
                href={`tel:${provider.contactPhone}`}
                className="flex items-center gap-2 text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-400"
              >
                <Phone size={12} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate">{provider.contactPhone}</span>
              </a>
            )}
            {provider.website && (
              <a
                href={provider.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-400"
              >
                <Globe size={12} className="shrink-0 text-teal-600 dark:text-teal-400" />
                <span className="truncate">{provider.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                <ExternalLink size={10} className="shrink-0 opacity-60" />
              </a>
            )}
            {provider.contactEmail && (
              <a
                href={`mailto:${provider.contactEmail}`}
                className="flex items-center gap-2 text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-400"
              >
                <Mail size={12} className="shrink-0 text-rose-600 dark:text-rose-400" />
                <span className="truncate">{provider.contactEmail}</span>
              </a>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-dashed pt-3">
            <div className="flex items-center gap-1.5">
              <Stars rating={provider.rating} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-8" onClick={onView}>
                View Details
              </Button>
              <Button
                size="sm"
                className="h-8 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
                onClick={onAdd}
              >
                <Plus size={12} className="mr-1" />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────
//  Loading Skeleton
// ─────────────────────────────────────────────────────────
function ProviderSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-5 w-2/3 rounded-full" />
          </div>
        </div>
        <div className="flex gap-1">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-24" />
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────
//  Provider Details Dialog
// ─────────────────────────────────────────────────────────
function ProviderDetailsDialog({
  provider,
  open,
  onOpenChange,
  onAdd,
  adding,
}: {
  provider: Provider | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onAdd: () => void
  adding: boolean
}) {
  if (!provider) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-lg font-bold text-white ring-2 ring-emerald-100 dark:ring-emerald-500/20">
              {provider.logoUrl ? (
                <img
                  src={provider.logoUrl}
                  alt={`${provider.name} logo`}
                  className="h-full w-full rounded-2xl object-cover"
                />
              ) : (
                providerInitials(provider.name)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="leading-tight">{provider.name}</DialogTitle>
              <DialogDescription className="mt-1">
                Health insurance provider
              </DialogDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {provider.cashless && (
                  <Badge className="h-6 gap-0.5 bg-emerald-100 px-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <CheckCircle2 size={12} />
                    Cashless Network
                  </Badge>
                )}
                <div className="flex items-center gap-1">
                  <Stars rating={provider.rating} size={14} />
                  <span className="text-xs font-semibold">{provider.rating.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-emerald-50/40 p-3 dark:bg-emerald-500/5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Hotel size={12} /> Network
              </div>
              <p className="mt-1 text-lg font-bold">{formatNumber(provider.networkHospitals)}</p>
              <p className="text-[10px] text-muted-foreground">hospitals</p>
            </div>
            <div className="rounded-lg border bg-teal-50/40 p-3 dark:bg-teal-500/5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Star size={12} className="text-amber-500" /> Rating
              </div>
              <p className="mt-1 text-lg font-bold">{provider.rating.toFixed(1)}<span className="text-xs font-normal text-muted-foreground">/5</span></p>
            </div>
            <div className="rounded-lg border bg-amber-50/40 p-3 dark:bg-amber-500/5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <ShieldCheck size={12} /> Cashless
              </div>
              <p className="mt-1 text-lg font-bold">{provider.cashless ? "Yes" : "No"}</p>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Plan Categories
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {provider.categories.length === 0 && (
                <span className="text-xs text-muted-foreground">No categories listed.</span>
              )}
              {provider.categories.map((c) => (
                <Badge
                  key={c}
                  className={cn(
                    "h-6 px-2 text-xs font-semibold",
                    CATEGORY_COLOR[c] ||
                      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                  )}
                >
                  {CATEGORY_LABEL[c] || c}
                </Badge>
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Contact Details
            </div>
            <Separator className="my-3" />
            <div className="space-y-2 text-sm">
              {provider.contactPhone && (
                <a
                  href={`tel:${provider.contactPhone}`}
                  className="flex items-center gap-2 text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-400"
                >
                  <Phone size={14} className="text-emerald-600 dark:text-emerald-400" />
                  {provider.contactPhone}
                </a>
              )}
              {provider.contactEmail && (
                <a
                  href={`mailto:${provider.contactEmail}`}
                  className="flex items-center gap-2 text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-400"
                >
                  <Mail size={14} className="text-rose-600 dark:text-rose-400" />
                  {provider.contactEmail}
                </a>
              )}
              {provider.website && (
                <a
                  href={provider.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-400"
                >
                  <Globe size={14} className="text-teal-600 dark:text-teal-400" />
                  {provider.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  <ExternalLink size={11} className="opacity-60" />
                </a>
              )}
              {!provider.contactPhone && !provider.contactEmail && !provider.website && (
                <p className="text-xs text-muted-foreground">No contact details available.</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={onAdd}
            disabled={adding}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
          >
            {adding ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Plus size={14} className="mr-1.5" />}
            Add to my insurance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────
//  Add Provider Dialog (admin / advanced user)
// ─────────────────────────────────────────────────────────
function AddProviderDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated?: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: "",
    website: "",
    contactPhone: "",
    contactEmail: "",
    networkHospitals: "",
    cashless: true,
    categories: [] as string[],
  })

  const toggleCategory = (c: string) => {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(c)
        ? f.categories.filter((x) => x !== c)
        : [...f.categories, c],
    }))
  }

  const reset = () =>
    setForm({
      name: "",
      website: "",
      contactPhone: "",
      contactEmail: "",
      networkHospitals: "",
      cashless: true,
      categories: [],
    })

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }
    setSaving(true)
    try {
      const body: AddProviderBody = {
        name: form.name.trim(),
        website: form.website.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
        categories: form.categories,
        cashless: form.cashless,
        networkHospitals: Number(form.networkHospitals) || 0,
      }
      await apiFetch("/api/insurance-providers", {
        method: "POST",
        body: JSON.stringify(body),
      })
      toast.success("Provider added", { description: `${form.name} is now in the directory.` })
      onOpenChange(false)
      reset()
      onCreated?.()
    } catch (e) {
      toast.error("Failed to add provider", { description: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Insurance Provider</DialogTitle>
          <DialogDescription>
            Contribute a new insurer to the public database. Only add providers not already listed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Provider name *</Label>
            <Input
              placeholder="e.g. ACKO General Insurance"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Website</Label>
              <Input
                placeholder="https://..."
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contact phone</Label>
              <Input
                placeholder="1800-xxx-xxxx"
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Contact email</Label>
              <Input
                placeholder="care@provider.com"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Network hospitals</Label>
              <Input
                type="number"
                min={0}
                placeholder="5000"
                value={form.networkHospitals}
                onChange={(e) => setForm({ ...form, networkHospitals: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Plan categories</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => toggleCategory(c.value)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                    form.categories.includes(c.value)
                      ? CATEGORY_COLOR[c.value] + " border-transparent"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Cashless network</p>
              <p className="text-xs text-muted-foreground">Provider offers cashless claims at network hospitals.</p>
            </div>
            <Switch checked={form.cashless} onCheckedChange={(v) => setForm({ ...form, cashless: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Plus size={14} className="mr-1.5" />}
            Add Provider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────
//  Filter Bar
// ─────────────────────────────────────────────────────────
function FilterBar({
  filters,
  setFilters,
  onApply,
  onClear,
  applying,
  onAddNew,
}: {
  filters: { search: string; category: string; cashless: boolean; sort: SortKey }
  setFilters: (f: typeof filters) => void
  onApply: () => void
  onClear: () => void
  applying: boolean
  onAddNew: () => void
}) {
  return (
    <Card className="sticky top-2 z-10 border-emerald-100/60 shadow-sm backdrop-blur dark:border-emerald-500/10">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Search size={11} className="mr-1 inline" /> Search
            </Label>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Provider name or website…"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") onApply() }}
                className="h-9 pl-9"
              />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Category
            </Label>
            <Select
              value={filters.category}
              onValueChange={(v) => setFilters({ ...filters, category: v === "__all" ? "" : v })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Sort by
            </Label>
            <Select
              value={filters.sort}
              onValueChange={(v) => setFilters({ ...filters, sort: v as SortKey })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="networkHospitals">Largest Network</SelectItem>
                <SelectItem value="name">Name (A–Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-1 items-center justify-between rounded-md border px-3 py-1.5">
              <Label htmlFor="cashless-toggle" className="cursor-pointer text-xs">
                Cashless only
              </Label>
              <Switch
                id="cashless-toggle"
                checked={filters.cashless}
                onCheckedChange={(v) => setFilters({ ...filters, cashless: v })}
              />
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={onAddNew} className="border-dashed">
            <Plus size={14} className="mr-1.5" />
            Add new provider
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
              <X size={14} className="mr-1" />
              Clear
            </Button>
            <Button size="sm" onClick={onApply} disabled={applying} className="bg-emerald-600 hover:bg-emerald-700">
              {applying ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <SlidersHorizontal size={14} className="mr-1.5" />}
              Apply
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────
export interface InsuranceDirectoryProps {
  /** Called when patient clicks "Add to my insurance". */
  onAddToInsurance?: (provider: Provider) => void
  /** Hide the hero (when embedded). */
  hideHero?: boolean
}

export function InsuranceDirectory({ onAddToInsurance, hideHero }: InsuranceDirectoryProps) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)

  const [filters, setFilters] = useState({
    search: "",
    category: "",
    cashless: false,
    sort: "rating" as SortKey,
  })
  const [appliedFilters, setAppliedFilters] = useState(filters)

  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)

  const fetchProviders = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setLoading(true)
      setApplying(true)
      try {
        const params = new URLSearchParams()
        if (appliedFilters.search) params.set("search", appliedFilters.search)
        if (appliedFilters.category) params.set("category", appliedFilters.category)
        if (appliedFilters.cashless) params.set("cashless", "true")

        const res = await apiFetch<ProvidersResponse>(`/api/insurance-providers?${params.toString()}`)
        let list = res.providers || []

        // Client-side sort (API sorts by rating only)
        if (appliedFilters.sort === "networkHospitals") {
          list = [...list].sort((a, b) => b.networkHospitals - a.networkHospitals)
        } else if (appliedFilters.sort === "name") {
          list = [...list].sort((a, b) => a.name.localeCompare(b.name))
        }
        setProviders(list)
      } catch (e) {
        toast.error("Failed to load providers", { description: (e as Error).message })
        setProviders([])
      } finally {
        setLoading(false)
        setApplying(false)
      }
    },
    [appliedFilters]
  )

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  // Live-apply when sort or cashless toggles (no need for explicit Apply)
  useEffect(() => {
    setAppliedFilters(filters)
  }, [filters.sort, filters.cashless])

  const handleApply = () => {
    setAppliedFilters(filters)
  }
  const handleClear = () => {
    setFilters({ search: "", category: "", cashless: false, sort: "rating" })
    setAppliedFilters({ search: "", category: "", cashless: false, sort: "rating" })
  }

  const handleAdd = async (provider: Provider) => {
    if (onAddToInsurance) {
      onAddToInsurance(provider)
      return
    }
    setAddingId(provider.id)
    // Simulate a small delay so users see feedback
    await new Promise((r) => setTimeout(r, 400))
    setAddingId(null)
    toast.success("Saved to your insurance list", {
      description: `${provider.name} added — you can link it from your profile.`,
    })
  }

  // Statistics
  const stats = useMemo(() => {
    const total = providers.length
    const networkHospitals = providers.reduce((s, p) => s + (p.networkHospitals || 0), 0)
    const cashlessCount = providers.filter((p) => p.cashless).length
    const avgRating =
      total === 0
        ? 0
        : providers.reduce((s, p) => s + (p.rating || 0), 0) / total
    return { total, networkHospitals, cashlessCount, avgRating }
  }, [providers])

  // Pagination
  const [offset, setOffset] = useState(0)
  useEffect(() => { setOffset(0) }, [appliedFilters])
  const paged = providers.slice(offset, offset + PAGE_SIZE)
  const hasNext = offset + PAGE_SIZE < providers.length
  const hasPrev = offset > 0
  const startIdx = providers.length === 0 ? 0 : offset + 1
  const endIdx = Math.min(offset + paged.length, providers.length)

  const activeFilterCount = useMemo(() => {
    return [
      appliedFilters.search,
      appliedFilters.category,
      appliedFilters.cashless ? "cashless" : "",
    ].filter(Boolean).length
  }, [appliedFilters])

  return (
    <div className="space-y-4">
      {!hideHero && (
        <HeroBanner
          title="Insurance Providers"
          subtitle="Compare health insurance plans from leading insurers in India"
          icon={ShieldCheck}
        >
          <div className="hidden sm:block">
            <StatCard
              title="Providers"
              value={stats.total}
              icon={HeartPulse}
              color="bg-white/20 text-white"
            />
          </div>
        </HeroBanner>
      )}

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="Total Providers"
          value={stats.total}
          icon={Building2}
          color="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
          accent="from-emerald-500 to-teal-500"
        />
        <StatCard
          title="Network Hospitals"
          value={formatNumber(stats.networkHospitals)}
          icon={Hotel}
          color="bg-teal-50 text-teal-600 dark:bg-teal-500/10"
          accent="from-teal-500 to-emerald-500"
        />
        <StatCard
          title="Cashless Providers"
          value={stats.cashlessCount}
          icon={CheckCircle2}
          color="bg-amber-50 text-amber-600 dark:bg-amber-500/10"
          accent="from-amber-500 to-orange-500"
        />
        <StatCard
          title="Average Rating"
          value={stats.avgRating.toFixed(1)}
          icon={TrendingUp}
          color="bg-rose-50 text-rose-600 dark:bg-rose-500/10"
          accent="from-rose-500 to-red-500"
        />
      </div>

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        onApply={handleApply}
        onClear={handleClear}
        applying={applying}
        onAddNew={() => setAddOpen(true)}
      />

      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-emerald-600" />
                Loading providers…
              </span>
            ) : (
              <>
                Showing{" "}
                <span className="font-semibold text-foreground">{startIdx}–{endIdx}</span>{" "}
                of <span className="font-semibold text-foreground">{providers.length}</span>
                {activeFilterCount > 0 && (
                  <Badge variant="outline" className="ml-2 h-5 px-1.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                    {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
                  </Badge>
                )}
              </>
            )}
          </p>
          {!loading && providers.length > 0 && (
            <Badge variant="outline" className="hidden items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300 sm:flex">
              <Sparkles size={10} />
              Verified Database
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProviderSkeleton key={i} />
            ))}
          </div>
        ) : paged.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No insurance providers found"
            description="Try clearing your filters or searching with a different keyword. You can also add a new provider to the database."
            action={
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleClear}>
                  <X size={14} className="mr-1.5" /> Clear Filters
                </Button>
                <Button size="sm" onClick={() => setAddOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus size={14} className="mr-1.5" /> Add Provider
                </Button>
              </div>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {paged.map((p, i) => (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  index={i}
                  onView={() => { setSelectedProvider(p); setDetailsOpen(true) }}
                  onAdd={() => handleAdd(p)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && providers.length > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrev || applying}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            <ChevronLeft size={14} className="mr-1" />
            Previous
          </Button>
          <p className="text-xs text-muted-foreground">
            Page <span className="font-semibold">{Math.floor(offset / PAGE_SIZE) + 1}</span> of{" "}
            <span className="font-semibold">{Math.max(1, Math.ceil(providers.length / PAGE_SIZE))}</span>
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNext || applying}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next
            <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>
      )}

      <ProviderDetailsDialog
        provider={selectedProvider}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onAdd={() => selectedProvider && handleAdd(selectedProvider)}
        adding={!!selectedProvider && addingId === selectedProvider.id}
      />

      <AddProviderDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => fetchProviders({ silent: true })}
      />
    </div>
  )
}

export default InsuranceDirectory
