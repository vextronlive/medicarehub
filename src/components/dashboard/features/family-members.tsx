"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  Users,
  UserPlus,
  Phone,
  AlertTriangle,
  Activity,
  Pill,
  Pencil,
  Trash2,
  RefreshCw,
  Cake,
  Droplet,
  Mail,
  Heart,
  Shield,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

import { useAuthStore } from "@/lib/auth-store"
import { apiFetch } from "@/lib/api"
import { cn, initials } from "@/lib/utils"
import {
  HeroBanner,
  SectionHeader,
  EmptyState,
  StatCard,
} from "@/components/dashboard/shared/primitives"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ============== Types ==============
type Relation =
  | "SPOUSE"
  | "SON"
  | "DAUGHTER"
  | "FATHER"
  | "MOTHER"
  | "BROTHER"
  | "SISTER"
  | "OTHER"

type Gender = "MALE" | "FEMALE" | "OTHER"

interface FamilyMember {
  id: string
  ownerId: string
  name: string
  relation: Relation
  gender?: Gender | null
  dateOfBirth?: string | null
  bloodGroup?: string | null
  phone?: string | null
  email?: string | null
  allergies?: string | null
  chronicConditions?: string | null
  currentMedications?: string | null
  emergencyContact?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

interface FormState {
  name: string
  relation: Relation | ""
  gender: Gender | ""
  dateOfBirth: string
  bloodGroup: string
  phone: string
  email: string
  allergies: string
  chronicConditions: string
  currentMedications: string
  emergencyContact: string
  notes: string
}

const EMPTY_FORM: FormState = {
  name: "",
  relation: "",
  gender: "",
  dateOfBirth: "",
  bloodGroup: "",
  phone: "",
  email: "",
  allergies: "",
  chronicConditions: "",
  currentMedications: "",
  emergencyContact: "",
  notes: "",
}

// ============== Constants ==============
const RELATIONS: { value: Relation; label: string }[] = [
  { value: "SPOUSE", label: "Spouse" },
  { value: "SON", label: "Son" },
  { value: "DAUGHTER", label: "Daughter" },
  { value: "FATHER", label: "Father" },
  { value: "MOTHER", label: "Mother" },
  { value: "BROTHER", label: "Brother" },
  { value: "SISTER", label: "Sister" },
  { value: "OTHER", label: "Other" },
]

const GENDERS: { value: Gender; label: string }[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
]

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]

// ============== Relation color config ==============
interface RelationConfig {
  label: string
  /** Avatar background + text */
  avatar: string
  /** Badge classes */
  badge: string
  /** Accent dot / ring */
  accent: string
}

const RELATION_CONFIG: Record<Relation, RelationConfig> = {
  SPOUSE: {
    label: "Spouse",
    avatar:
      "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    badge:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-500/10 dark:text-rose-300",
    accent: "from-rose-500 to-pink-500",
  },
  SON: {
    label: "Son",
    avatar:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-500/10 dark:text-emerald-300",
    accent: "from-emerald-500 to-teal-500",
  },
  DAUGHTER: {
    label: "Daughter",
    avatar:
      "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300",
    badge:
      "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-900/50 dark:bg-fuchsia-500/10 dark:text-fuchsia-300",
    accent: "from-fuchsia-500 to-pink-500",
  },
  FATHER: {
    label: "Father",
    avatar:
      "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    badge:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-500/10 dark:text-sky-300",
    accent: "from-sky-500 to-cyan-500",
  },
  MOTHER: {
    label: "Mother",
    avatar:
      "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    badge:
      "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900/50 dark:bg-teal-500/10 dark:text-teal-300",
    accent: "from-teal-500 to-emerald-500",
  },
  BROTHER: {
    label: "Brother",
    avatar:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    badge:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-500/10 dark:text-amber-300",
    accent: "from-amber-500 to-orange-500",
  },
  SISTER: {
    label: "Sister",
    avatar:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    badge:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-500/10 dark:text-violet-300",
    accent: "from-violet-500 to-purple-500",
  },
  OTHER: {
    label: "Other",
    avatar:
      "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
    badge:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700/50 dark:bg-slate-500/10 dark:text-slate-300",
    accent: "from-slate-500 to-slate-600",
  },
}

// ============== Helpers ==============
function computeAge(dob?: string | null): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  if (Number.isNaN(birth.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--
  }
  return age >= 0 ? age : null
}

function formatList(value?: string | null): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function toDateInputValue(dob?: string | null): string {
  if (!dob) return ""
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ============== Member Card ==============
function MemberCard({
  member,
  index,
  onEdit,
  onDelete,
}: {
  member: FamilyMember
  index: number
  onEdit: () => void
  onDelete: () => void
}) {
  const cfg = RELATION_CONFIG[member.relation] || RELATION_CONFIG.OTHER
  const age = computeAge(member.dateOfBirth)
  const allergies = formatList(member.allergies)
  const conditions = formatList(member.chronicConditions)
  const meds = formatList(member.currentMedications)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4) }}
    >
      <Card
        className={cn(
          "group relative h-full overflow-hidden rounded-xl border-border/60 shadow-sm",
          "transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
          "hover:bg-gradient-to-br hover:from-emerald-50/50 hover:to-transparent",
          "dark:hover:from-emerald-500/5 dark:hover:to-transparent"
        )}
      >
        {/* Top accent bar */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-70",
            cfg.accent
          )}
        />

        <CardContent className="relative p-5">
          {/* Header: avatar + name + actions */}
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-2 ring-white dark:ring-slate-900",
                cfg.avatar
              )}
              aria-hidden
            >
              {initials(member.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="truncate text-base font-semibold tracking-tight">
                  {member.name}
                </h3>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={cn("px-2 py-0 text-[11px] font-medium", cfg.badge)}
                >
                  {cfg.label}
                </Badge>
                {age !== null && (
                  <Badge
                    variant="outline"
                    className="border-border/60 bg-muted/40 px-2 py-0 text-[11px] font-medium text-muted-foreground"
                  >
                    <Cake className="mr-1 h-3 w-3" />
                    {age} {age === 1 ? "yr" : "yrs"}
                  </Badge>
                )}
                {member.bloodGroup && (
                  <Badge
                    variant="outline"
                    className="border-rose-200 bg-rose-50 px-2 py-0 text-[11px] font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-500/10 dark:text-rose-300"
                  >
                    <Droplet className="mr-1 h-3 w-3" />
                    {member.bloodGroup}
                  </Badge>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300"
                onClick={onEdit}
                aria-label={`Edit ${member.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                onClick={onDelete}
                aria-label={`Delete ${member.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Contact rows */}
          <div className="mt-4 space-y-2 text-sm">
            {member.phone && (
              <a
                href={`tel:${member.phone.replace(/\s+/g, "")}`}
                className="group/contact flex items-center gap-2 text-foreground transition-colors hover:text-emerald-700 dark:hover:text-emerald-300"
              >
                <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate">{member.phone}</span>
              </a>
            )}
            {member.email && (
              <a
                href={`mailto:${member.email}`}
                className="group/contact flex items-center gap-2 text-foreground transition-colors hover:text-emerald-700 dark:hover:text-emerald-300"
              >
                <Mail className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate">{member.email}</span>
              </a>
            )}
          </div>

          {/* Health info rows */}
          {(allergies.length > 0 ||
            conditions.length > 0 ||
            meds.length > 0) && (
            <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
              {allergies.length > 0 && (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-rose-600 dark:text-rose-400">
                      Allergies
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {allergies.map((a, i) => (
                        <span
                          key={i}
                          className="rounded-md bg-rose-50 px-1.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {conditions.length > 0 && (
                <div className="flex items-start gap-2">
                  <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      Chronic Conditions
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {conditions.map((c, i) => (
                        <span
                          key={i}
                          className="rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {meds.length > 0 && (
                <div className="flex items-start gap-2">
                  <Pill className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                      Medications
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {meds.map((m, i) => (
                        <span
                          key={i}
                          className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Emergency contact */}
          {member.emergencyContact && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-2 text-xs">
              <Shield className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="text-muted-foreground">Emergency:</span>
              <span className="truncate font-medium">
                {member.emergencyContact}
              </span>
            </div>
          )}

          {/* Notes */}
          {member.notes && (
            <p className="mt-3 line-clamp-2 rounded-lg bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
              {member.notes}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============== Form Dialog ==============
function MemberFormDialog({
  open,
  onOpenChange,
  editingId,
  form,
  setField,
  onSubmit,
  submitting,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  editingId: string | null
  form: FormState
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  onSubmit: () => void
  submitting: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b p-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5 text-emerald-600" />
            {editingId ? "Edit Family Member" : "Add Family Member"}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {editingId
              ? "Update the health profile for this family member. Fields marked with * are required."
              : "Create a health profile for a family member. Fields marked with * are required."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Name */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label
                htmlFor="fm-name"
                className="flex items-center gap-1.5 text-xs font-medium"
              >
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                Full Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="fm-name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="e.g. Aarav Sharma"
                className="rounded-lg"
              />
            </div>

            {/* Relation */}
            <div className="space-y-1.5">
              <Label
                htmlFor="fm-relation"
                className="flex items-center gap-1.5 text-xs font-medium"
              >
                <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                Relation <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={form.relation}
                onValueChange={(v) => setField("relation", v as Relation)}
              >
                <SelectTrigger id="fm-relation" className="w-full rounded-lg">
                  <SelectValue placeholder="Select relation" />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Gender */}
            <div className="space-y-1.5">
              <Label
                htmlFor="fm-gender"
                className="flex items-center gap-1.5 text-xs font-medium"
              >
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                Gender
              </Label>
              <Select
                value={form.gender}
                onValueChange={(v) => setField("gender", v as Gender)}
              >
                <SelectTrigger id="fm-gender" className="w-full rounded-lg">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* DOB */}
            <div className="space-y-1.5">
              <Label
                htmlFor="fm-dob"
                className="flex items-center gap-1.5 text-xs font-medium"
              >
                <Cake className="h-3.5 w-3.5 text-muted-foreground" />
                Date of Birth
              </Label>
              <Input
                id="fm-dob"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setField("dateOfBirth", e.target.value)}
                className="rounded-lg"
              />
            </div>

            {/* Blood group */}
            <div className="space-y-1.5">
              <Label
                htmlFor="fm-blood"
                className="flex items-center gap-1.5 text-xs font-medium"
              >
                <Droplet className="h-3.5 w-3.5 text-muted-foreground" />
                Blood Group
              </Label>
              <Select
                value={form.bloodGroup}
                onValueChange={(v) => setField("bloodGroup", v)}
              >
                <SelectTrigger id="fm-blood" className="w-full rounded-lg">
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {BLOOD_GROUPS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label
                htmlFor="fm-phone"
                className="flex items-center gap-1.5 text-xs font-medium"
              >
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                Phone
              </Label>
              <Input
                id="fm-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder="+91 98765 43210"
                className="rounded-lg"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label
                htmlFor="fm-email"
                className="flex items-center gap-1.5 text-xs font-medium"
              >
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                Email
              </Label>
              <Input
                id="fm-email"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="name@example.com"
                className="rounded-lg"
              />
            </div>

            {/* Allergies */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label
                htmlFor="fm-allergies"
                className="flex items-center gap-1.5 text-xs font-medium"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                Allergies
                <span className="text-muted-foreground">· comma-separated</span>
              </Label>
              <Input
                id="fm-allergies"
                value={form.allergies}
                onChange={(e) => setField("allergies", e.target.value)}
                placeholder="e.g. Penicillin, Peanuts, Pollen"
                className="rounded-lg"
              />
            </div>

            {/* Chronic conditions */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label
                htmlFor="fm-conditions"
                className="flex items-center gap-1.5 text-xs font-medium"
              >
                <Activity className="h-3.5 w-3.5 text-amber-500" />
                Chronic Conditions
                <span className="text-muted-foreground">· comma-separated</span>
              </Label>
              <Input
                id="fm-conditions"
                value={form.chronicConditions}
                onChange={(e) => setField("chronicConditions", e.target.value)}
                placeholder="e.g. Diabetes, Hypertension"
                className="rounded-lg"
              />
            </div>

            {/* Medications */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label
                htmlFor="fm-meds"
                className="flex items-center gap-1.5 text-xs font-medium"
              >
                <Pill className="h-3.5 w-3.5 text-emerald-500" />
                Current Medications
                <span className="text-muted-foreground">· comma-separated</span>
              </Label>
              <Input
                id="fm-meds"
                value={form.currentMedications}
                onChange={(e) => setField("currentMedications", e.target.value)}
                placeholder="e.g. Metformin 500mg, Amlodipine 5mg"
                className="rounded-lg"
              />
            </div>

            {/* Emergency contact */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label
                htmlFor="fm-emergency"
                className="flex items-center gap-1.5 text-xs font-medium"
              >
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                Emergency Contact
              </Label>
              <Input
                id="fm-emergency"
                value={form.emergencyContact}
                onChange={(e) => setField("emergencyContact", e.target.value)}
                placeholder="e.g. Spouse — +91 98765 43210"
                className="rounded-lg"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label
                htmlFor="fm-notes"
                className="flex items-center gap-1.5 text-xs font-medium"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                Notes
                <span className="text-muted-foreground">· optional</span>
              </Label>
              <Textarea
                id="fm-notes"
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Any additional context — e.g. upcoming surgery, dietary preferences, etc."
                className="min-h-[72px] resize-y rounded-lg"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="border-t p-6 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={submitting}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {editingId ? "Updating…" : "Saving…"}
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                {editingId ? "Update Member" : "Add Member"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============== Delete Confirmation ==============
function DeleteAlertDialog({
  open,
  onOpenChange,
  onConfirm,
  submitting,
  memberName,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onConfirm: () => void
  submitting: boolean
  memberName?: string
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-rose-600" />
            Delete this family member?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {memberName ? (
              <>
                You are about to permanently delete{" "}
                <span className="font-medium text-foreground">{memberName}</span>
                &apos;s health profile. This action cannot be undone.
              </>
            ) : (
              <>
                This action cannot be undone. The family member&apos;s health
                profile will be permanently removed.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            disabled={submitting}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete Member
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ============== Main Component ==============
export function FamilyMembers() {
  const user = useAuthStore((s) => s.user)
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const fetchMembers = useCallback(
    async (mode: "load" | "refresh" = "load") => {
      if (!user) return
      try {
        if (mode === "load") setLoading(true)
        else setRefreshing(true)
        const data = await apiFetch<{ members: FamilyMember[] }>(
          `/api/family-members?ownerId=${encodeURIComponent(user.id)}`
        )
        setMembers(data.members || [])
      } catch (e) {
        toast.error("Failed to load family members", {
          description: (e as Error).message,
        })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [user]
  )

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) =>
      setForm((f) => ({ ...f, [key]: value })),
    []
  )

  const openCreate = () => {
    setForm({ ...EMPTY_FORM })
    setEditingId(null)
    setDialogOpen(true)
  }

  const openEdit = (m: FamilyMember) => {
    setForm({
      name: m.name,
      relation: m.relation,
      gender: m.gender || "",
      dateOfBirth: toDateInputValue(m.dateOfBirth),
      bloodGroup: m.bloodGroup || "",
      phone: m.phone || "",
      email: m.email || "",
      allergies: m.allergies || "",
      chronicConditions: m.chronicConditions || "",
      currentMedications: m.currentMedications || "",
      emergencyContact: m.emergencyContact || "",
      notes: m.notes || "",
    })
    setEditingId(m.id)
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!user) return

    if (!form.name.trim()) {
      toast.error("Please enter a name.")
      return
    }
    if (!form.relation) {
      toast.error("Please select a relation.")
      return
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      relation: form.relation,
      gender: form.gender || null,
      dateOfBirth: form.dateOfBirth || null,
      bloodGroup: form.bloodGroup || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      allergies: form.allergies.trim() || null,
      chronicConditions: form.chronicConditions.trim() || null,
      currentMedications: form.currentMedications.trim() || null,
      emergencyContact: form.emergencyContact.trim() || null,
      notes: form.notes.trim() || null,
    }

    try {
      setSubmitting(true)
      if (editingId) {
        const res = await apiFetch<{ member: FamilyMember }>("/api/family-members", {
          method: "PATCH",
          body: JSON.stringify({ id: editingId, ...payload }),
        })
        // Nuclear fix: gate toast + state update on the response payload.
        if (!res?.member) {
          throw new Error("Server confirmed the update but did not return the record.")
        }
        setMembers((prev) =>
          prev.map((m) => (m.id === editingId ? { ...m, ...res.member } : m))
        )
        toast.success("Family member updated successfully.")
      } else {
        const res = await apiFetch<{ member: FamilyMember }>("/api/family-members", {
          method: "POST",
          body: JSON.stringify({ ownerId: user.id, ...payload }),
        })
        // Nuclear fix: the POST response IS the canonical record.
        // Gate the toast + state update on the response payload so we
        // never show a false "successfully added" toast. Do NOT fire an
        // un-awaited background refetch — Supabase pooler read-after-write
        // lag can cause the refetch to return a list WITHOUT the new item,
        // which would wholesale-replace state and silently wipe it.
        if (!res?.member) {
          throw new Error("Server confirmed the save but did not return the record.")
        }
        setMembers((prev) => [res.member, ...prev])
        toast.success("Family member added successfully.")
      }
      setDialogOpen(false)
      setEditingId(null)
      // No background refetch — the POST response above is the source of truth.
    } catch (e) {
      toast.error(
        editingId ? "Failed to update family member" : "Failed to add family member",
        { description: (e as Error).message }
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const id = deleteId
    try {
      setSubmitting(true)
      await apiFetch(`/api/family-members?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      // Optimistic delete — local state is already correct.
      setMembers((prev) => prev.filter((m) => m.id !== id))
      toast.success("Family member deleted.")
      setDeleteId(null)
      // No background refetch — the optimistic delete is authoritative.
    } catch (e) {
      toast.error("Failed to delete family member", {
        description: (e as Error).message,
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ============== Derived stats ==============
  const stats = useMemo(() => {
    const total = members.length
    const withAllergies = members.filter((m) => {
      const a = formatList(m.allergies)
      return a.length > 0
    }).length
    const withChronic = members.filter((m) => {
      const c = formatList(m.chronicConditions)
      return c.length > 0
    }).length
    const minors = members.filter((m) => {
      const age = computeAge(m.dateOfBirth)
      return age !== null && age < 18
    }).length
    return { total, withAllergies, withChronic, minors }
  }, [members])

  const deleteTarget = useMemo(
    () => members.find((m) => m.id === deleteId) || null,
    [members, deleteId]
  )

  if (!user) return null

  // ============== Loading state ==============
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-44 rounded-lg" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // ============== Empty state ==============
  if (members.length === 0) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <HeroBanner
            title="Family Members"
            subtitle="Manage health profiles for your spouse, parents, children and siblings — allergies, conditions and medications all in one place."
            icon={Users}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <EmptyState
            icon={Users}
            title="No family members yet"
            description="Add health profiles for your loved ones to keep track of their allergies, chronic conditions, medications and emergency contacts."
            action={
              <Button
                onClick={openCreate}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <UserPlus className="h-4 w-4" />
                Add your first family member
              </Button>
            }
          />
        </motion.div>

        <MemberFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editingId={editingId}
          form={form}
          setField={setField}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
        <DeleteAlertDialog
          open={!!deleteId}
          onOpenChange={(o) => !o && setDeleteId(null)}
          onConfirm={handleDelete}
          submitting={submitting}
          memberName={deleteTarget?.name}
        />
      </div>
    )
  }

  // ============== Main render ==============
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <HeroBanner
          title="Family Members"
          subtitle="Manage health profiles for your spouse, parents, children and siblings — allergies, conditions and medications all in one place."
          icon={Users}
        />
      </motion.div>

      {/* Stat row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          title="Total Members"
          value={stats.total}
          icon={Users}
          color="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
          accent="from-emerald-500 to-teal-500"
        />
        <StatCard
          title="With Allergies"
          value={stats.withAllergies}
          icon={AlertTriangle}
          color="bg-rose-50 text-rose-600 dark:bg-rose-500/10"
          accent="from-rose-500 to-pink-500"
        />
        <StatCard
          title="Chronic Conditions"
          value={stats.withChronic}
          icon={Activity}
          color="bg-amber-50 text-amber-600 dark:bg-amber-500/10"
          accent="from-amber-500 to-orange-500"
        />
        <StatCard
          title="Minors (under 18)"
          value={stats.minors}
          icon={Shield}
          color="bg-teal-50 text-teal-600 dark:bg-teal-500/10"
          accent="from-teal-500 to-emerald-500"
        />
      </motion.div>

      {/* Section header + add button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          title="Family Member Profiles"
          description="Click a profile to view contact, allergy and medication details."
          icon={Users}
        />
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            onClick={() => fetchMembers("refresh")}
            disabled={refreshing}
            className="rounded-lg"
          >
            <RefreshCw
              className={cn("h-4 w-4", refreshing && "animate-spin")}
            />
            Refresh
          </Button>
          <Button
            onClick={openCreate}
            className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
          >
            <UserPlus className="h-4 w-4" />
            Add Family Member
          </Button>
        </div>
      </div>

      {/* Members grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {members.map((m, i) => (
          <MemberCard
            key={m.id}
            member={m}
            index={i}
            onEdit={() => openEdit(m)}
            onDelete={() => setDeleteId(m.id)}
          />
        ))}
      </div>

      {/* Add/Edit dialog */}
      <MemberFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingId={editingId}
        form={form}
        setField={setField}
        onSubmit={handleSubmit}
        submitting={submitting}
      />

      {/* Delete confirmation */}
      <DeleteAlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={handleDelete}
        submitting={submitting}
        memberName={deleteTarget?.name}
      />
    </div>
  )
}

export default FamilyMembers
