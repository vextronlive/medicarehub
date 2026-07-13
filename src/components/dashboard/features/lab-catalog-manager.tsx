"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { format, parseISO } from "date-fns"
import { toast } from "sonner"

import { useAuthStore } from "@/lib/auth-store"
import { apiFetch } from "@/lib/api"
import {
  StatCard,
  EmptyState,
  HeroBanner,
} from "@/components/dashboard/shared/primitives"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import {
  TestTube,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  IndianRupee,
  CheckCircle2,
  Activity,
  FlaskConical,
  Clock,
  Droplet,
  FileSearch,
} from "lucide-react"

// ─────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────
type Role = "PATIENT" | "DOCTOR" | "ORGANIZATION"

interface LabTestCatalogItem {
  id: string
  labId: string
  testName: string
  category: string
  description?: string | null
  price: number
  durationMins: number
  sampleType?: string | null
  fastingRequired: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface LabOption {
  id: string
  name: string
  city?: string | null
  state?: string | null
}

// ─────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────
const CATEGORIES: { key: string; label: string }[] = [
  { key: "HEMATOLOGY", label: "Hematology" },
  { key: "BIOCHEMISTRY", label: "Biochemistry" },
  { key: "MICROBIOLOGY", label: "Microbiology" },
  { key: "IMAGING", label: "Imaging" },
  { key: "CARDIOLOGY", label: "Cardiology" },
  { key: "ENDOCRINOLOGY", label: "Endocrinology" },
  { key: "IMMUNOLOGY", label: "Immunology" },
  { key: "URINE_ANALYSIS", label: "Urine Analysis" },
  { key: "OTHER", label: "Other" },
]

const SAMPLE_TYPES = ["BLOOD", "URINE", "SWAB", "NONE"] as const

const SAMPLE_COLORS: Record<string, string> = {
  BLOOD:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20",
  URINE:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
  SWAB:
    "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20",
  NONE:
    "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/20",
}

const CATEGORY_PILL_COLORS: Record<string, string> = {
  HEMATOLOGY:
    "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  BIOCHEMISTRY:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  MICROBIOLOGY:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  IMAGING:
    "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300",
  CARDIOLOGY:
    "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  ENDOCRINOLOGY:
    "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300",
  IMMUNOLOGY:
    "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  URINE_ANALYSIS:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  OTHER:
    "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300",
}

const EMPTY_FORM = {
  testName: "",
  category: "HEMATOLOGY",
  description: "",
  price: "",
  durationMins: "60",
  sampleType: "BLOOD",
  fastingRequired: false,
  isActive: true,
}

// ─────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────
function categoryLabel(key: string): string {
  return (
    CATEGORIES.find((c) => c.key === key)?.label ||
    key
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

function formatINR(amount: number): string {
  return `₹${(amount || 0).toLocaleString("en-IN")}`
}

function sampleColor(type?: string | null): string {
  if (!type) return SAMPLE_COLORS.NONE
  return SAMPLE_COLORS[type] || SAMPLE_COLORS.NONE
}

// ─────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────
export function LabCatalogManager({ role }: { role: Role }) {
  const user = useAuthStore((s) => s.user)
  const isPatient = role === "PATIENT"

  // Common state
  const [items, setItems] = useState<LabTestCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [patching, setPatching] = useState<string | null>(null)

  // Patient-only state
  const [labs, setLabs] = useState<LabOption[]>([])
  const [loadingLabs, setLoadingLabs] = useState(false)
  const [selectedLabId, setSelectedLabId] = useState("")
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>("ALL")

  // Lab manager dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [submitting, setSubmitting] = useState(false)

  // Delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ─────────────────────────────────────────────────────────
  //  Fetch catalog
  // ─────────────────────────────────────────────────────────
  const loadCatalog = useCallback(
    async (labId: string) => {
      setLoading(true)
      try {
        // Patients only see active tests; labs see all their tests
        const url = isPatient
          ? `/api/lab-catalog?labId=${encodeURIComponent(labId)}`
          : `/api/lab-catalog?labId=${encodeURIComponent(labId)}&activeOnly=false`
        const data = await apiFetch<{ items: LabTestCatalogItem[] }>(url)
        setItems(data.items || [])
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load catalog")
      } finally {
        setLoading(false)
      }
    },
    [isPatient]
  )

  // ─────────────────────────────────────────────────────────
  //  Fetch labs for patient selector
  // ─────────────────────────────────────────────────────────
  const loadLabs = useCallback(async () => {
    setLoadingLabs(true)
    try {
      const data = await apiFetch<{ doctors: LabOption[] }>(
        `/api/doctors?role=ORGANIZATION`
      )
      const list = data.doctors || []
      setLabs(list)
      if (list.length > 0) {
        setSelectedLabId((prev) => prev || list[0].id)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load labs")
    } finally {
      setLoadingLabs(false)
    }
  }, [])

  useEffect(() => {
    if (isPatient) {
      loadLabs()
    }
  }, [isPatient, loadLabs])

  // Load catalog when scope changes
  useEffect(() => {
    if (isPatient) {
      if (selectedLabId) loadCatalog(selectedLabId)
      else setItems([])
    } else if (user) {
      loadCatalog(user.id)
    }
  }, [isPatient, selectedLabId, user, loadCatalog])

  // ─────────────────────────────────────────────────────────
  //  Stats (lab manager)
  // ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = items.length
    const active = items.filter((i) => i.isActive).length
    const avg =
      total === 0
        ? 0
        : items.reduce((s, i) => s + (i.price || 0), 0) / total
    return { total, active, avg }
  }, [items])

  // ─────────────────────────────────────────────────────────
  //  Patient filters
  // ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = items
    if (activeCategory !== "ALL") {
      list = list.filter((i) => i.category === activeCategory)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (i) =>
          i.testName.toLowerCase().includes(q) ||
          (i.description || "").toLowerCase().includes(q)
      )
    }
    return list
  }, [items, activeCategory, search])

  const grouped = useMemo(() => {
    const map = new Map<string, LabTestCatalogItem[]>()
    for (const it of filtered) {
      if (!map.has(it.category)) map.set(it.category, [])
      map.get(it.category)!.push(it)
    }
    // Sort categories by the preset order
    return Array.from(map.entries()).sort((a, b) => {
      const ai = CATEGORIES.findIndex((c) => c.key === a[0])
      const bi = CATEGORIES.findIndex((c) => c.key === b[0])
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
  }, [filtered])

  const availableCategories = useMemo(() => {
    const present = new Set(items.map((i) => i.category))
    return CATEGORIES.filter((c) => present.has(c.key))
  }, [items])

  // ─────────────────────────────────────────────────────────
  //  Form handlers
  // ─────────────────────────────────────────────────────────
  function openAddDialog() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setDialogOpen(true)
  }

  function openEditDialog(item: LabTestCatalogItem) {
    setEditingId(item.id)
    setForm({
      testName: item.testName,
      category: CATEGORIES.some((c) => c.key === item.category)
        ? item.category
        : "OTHER",
      description: item.description || "",
      price: String(item.price || ""),
      durationMins: String(item.durationMins || 60),
      sampleType:
        item.sampleType && (SAMPLE_TYPES as readonly string[]).includes(item.sampleType)
          ? item.sampleType
          : "BLOOD",
      fastingRequired: item.fastingRequired,
      isActive: item.isActive,
    })
    setDialogOpen(true)
  }

  async function submitForm() {
    if (!user) return
    if (!form.testName.trim()) {
      toast.error("Test name is required")
      return
    }
    const priceNum = Number(form.price)
    if (form.price === "" || isNaN(priceNum) || priceNum < 0) {
      toast.error("Please enter a valid price")
      return
    }
    const durationNum = Number(form.durationMins) || 60

    setSubmitting(true)
    try {
      const basePayload = {
        testName: form.testName.trim(),
        category: form.category,
        description: form.description.trim() || undefined,
        price: priceNum,
        durationMins: durationNum,
        sampleType: form.sampleType,
        fastingRequired: form.fastingRequired,
        isActive: form.isActive,
      }

      if (editingId) {
        await apiFetch("/api/lab-catalog", {
          method: "PATCH",
          body: JSON.stringify({ id: editingId, ...basePayload }),
        })
        toast.success("Test updated successfully")
      } else {
        await apiFetch("/api/lab-catalog", {
          method: "POST",
          body: JSON.stringify({ labId: user.id, ...basePayload }),
        })
        toast.success("Test added to catalog")
      }
      setDialogOpen(false)
      setForm({ ...EMPTY_FORM })
      setEditingId(null)
      await loadCatalog(user.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save test")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(
    item: LabTestCatalogItem,
    value: boolean
  ) {
    if (!user) return
    setPatching(item.id)
    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isActive: value } : i))
    )
    try {
      await apiFetch("/api/lab-catalog", {
        method: "PATCH",
        body: JSON.stringify({ id: item.id, isActive: value }),
      })
      toast.success(value ? "Test activated" : "Test deactivated")
    } catch (e) {
      // Revert on error
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isActive: !value } : i))
      )
      toast.error(e instanceof Error ? e.message : "Failed to update test")
    } finally {
      setPatching(null)
    }
  }

  async function confirmDelete() {
    if (!deleteId || !user) return
    setDeleting(true)
    try {
      await apiFetch(`/api/lab-catalog?id=${encodeURIComponent(deleteId)}`, {
        method: "DELETE",
      })
      toast.success("Test removed from catalog")
      setDeleteId(null)
      await loadCatalog(user.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete test")
    } finally {
      setDeleting(false)
    }
  }

  // ─────────────────────────────────────────────────────────
  //  Guard
  // ─────────────────────────────────────────────────────────
  if (!user) return null

  // ─────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <HeroBanner
        title={isPatient ? "Lab Test Catalog" : "Test Catalog"}
        subtitle={
          isPatient
            ? "Browse tests and prices offered by partner labs."
            : "Manage the diagnostic tests your lab offers and their prices."
        }
        icon={TestTube}
      >
        {!isPatient && (
          <Button
            onClick={openAddDialog}
            className="bg-white text-emerald-700 hover:bg-emerald-50 shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">Add Test</span>
            <span className="ml-1 sm:hidden">Add</span>
          </Button>
        )}
      </HeroBanner>

      {isPatient ? (
        <PatientCatalogView
          labs={labs}
          loadingLabs={loadingLabs}
          selectedLabId={selectedLabId}
          onSelectLab={setSelectedLabId}
          loading={loading}
          items={items}
          filtered={filtered}
          grouped={grouped}
          availableCategories={availableCategories}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          search={search}
          setSearch={setSearch}
        />
      ) : (
        <LabCatalogView
          loading={loading}
          items={items}
          stats={stats}
          patching={patching}
          onAdd={openAddDialog}
          onEdit={openEditDialog}
          onDelete={(id) => setDeleteId(id)}
          onToggle={handleToggleActive}
        />
      )}

      {/* ─────────── Add/Edit Dialog ─────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Test" : "Add New Test"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the test details below."
                : "Fill in the details for the new diagnostic test."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            {/* Test name */}
            <div className="grid gap-2">
              <Label htmlFor="test-name">
                Test Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="test-name"
                value={form.testName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, testName: e.target.value }))
                }
                placeholder="e.g. Complete Blood Count"
              />
            </div>

            {/* Category + Sample type */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, category: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Sample Type</Label>
                <Select
                  value={form.sampleType}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, sampleType: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sample type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SAMPLE_TYPES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s === "NONE" ? "None / N/A" : s.charAt(0) + s.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Price + Duration */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="price">
                  Price (₹) <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    value={form.price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, price: e.target.value }))
                    }
                    placeholder="0"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="duration">Duration (mins)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  value={form.durationMins}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, durationMins: e.target.value }))
                  }
                  placeholder="60"
                />
              </div>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Brief description of what the test measures or includes"
              />
            </div>

            <Separator />

            {/* Switches */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label htmlFor="fasting">Fasting Required</Label>
                <p className="text-xs text-muted-foreground">
                  Patient must fast before sample collection
                </p>
              </div>
              <Switch
                id="fasting"
                checked={form.fastingRequired}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, fastingRequired: v }))
                }
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label htmlFor="active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Visible to patients browsing the catalog
                </p>
              </div>
              <Switch
                id="active"
                checked={form.isActive}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, isActive: v }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={submitForm}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {editingId ? "Save Changes" : "Add Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────── Delete AlertDialog ─────────── */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this test?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The test will be permanently
              removed from your catalog and will no longer be visible to
              patients.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default LabCatalogManager

// ─────────────────────────────────────────────────────────
//  Patient read-only view
// ─────────────────────────────────────────────────────────
function PatientCatalogView({
  labs,
  loadingLabs,
  selectedLabId,
  onSelectLab,
  loading,
  items,
  filtered,
  grouped,
  availableCategories,
  activeCategory,
  setActiveCategory,
  search,
  setSearch,
}: {
  labs: LabOption[]
  loadingLabs: boolean
  selectedLabId: string
  onSelectLab: (id: string) => void
  loading: boolean
  items: LabTestCatalogItem[]
  filtered: LabTestCatalogItem[]
  grouped: [string, LabTestCatalogItem[]][]
  availableCategories: { key: string; label: string }[]
  activeCategory: string
  setActiveCategory: (c: string) => void
  search: string
  setSearch: (s: string) => void
}) {
  const hasItems = items.length > 0
  const selectedLab = labs.find((l) => l.id === selectedLabId)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Lab selector + Search */}
      <Card>
        <CardContent className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Select Lab
              </Label>
              {loadingLabs ? (
                <Skeleton className="h-10 w-full" />
              ) : labs.length === 0 ? (
                <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                  <FlaskConical className="h-4 w-4" />
                  No partner labs available
                </div>
              ) : (
                <Select value={selectedLabId} onValueChange={onSelectLab}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a lab" />
                  </SelectTrigger>
                  <SelectContent>
                    {labs.map((lab) => (
                      <SelectItem key={lab.id} value={lab.id}>
                        {lab.name}
                        {lab.city ? ` · ${lab.city}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedLab && (
                <p className="text-xs text-muted-foreground">
                  Showing published test catalog for{" "}
                  <span className="font-medium text-foreground">
                    {selectedLab.name}
                  </span>
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Search Tests
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by test name…"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {/* Category pills */}
          {hasItems && (
            <div className="mt-4 flex flex-wrap gap-2">
              <CategoryPill
                active={activeCategory === "ALL"}
                onClick={() => setActiveCategory("ALL")}
                label="All"
                count={items.length}
              />
              {availableCategories.map((c) => (
                <CategoryPill
                  key={c.key}
                  active={activeCategory === c.key}
                  onClick={() => setActiveCategory(c.key)}
                  label={c.label}
                  count={items.filter((i) => i.category === c.key).length}
                  colorClass={CATEGORY_PILL_COLORS[c.key]}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Catalog body */}
      {!selectedLabId ? (
        <EmptyState
          icon={FileSearch}
          title="Select a lab to view its catalog"
          description="Choose a partner lab from the dropdown above to see the diagnostic tests and prices they offer."
        />
      ) : loading ? (
        <CatalogSkeleton />
      ) : !hasItems ? (
        <EmptyState
          icon={TestTube}
          title="This lab hasn't published a test catalog yet."
          description="Check back later or try a different lab from the selector above."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No tests match your search"
          description="Try a different keyword or category filter."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([category, catItems]) => (
            <div key={category} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex h-7 items-center rounded-md px-2.5 text-xs font-semibold",
                      CATEGORY_PILL_COLORS[category] ||
                        CATEGORY_PILL_COLORS.OTHER
                    )}
                  >
                    {categoryLabel(category)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {catItems.length}{" "}
                    {catItems.length === 1 ? "test" : "tests"}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {catItems.map((item, idx) => (
                  <TestCard key={item.id} item={item} index={idx} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

function CategoryPill({
  active,
  onClick,
  label,
  count,
  colorClass,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  colorClass?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
        active
          ? "border-emerald-500 bg-emerald-600 text-white shadow-sm"
          : "border-border bg-background text-muted-foreground hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-500/10"
      )}
    >
      <span
        className={cn(
          "hidden h-1.5 w-1.5 rounded-full sm:inline-block",
          active
            ? "bg-white"
            : colorClass
              ? colorClass.split(" ")[0]
              : "bg-emerald-400"
        )}
      />
      {label}
      <span
        className={cn(
          "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
          active ? "bg-white/20" : "bg-muted text-muted-foreground"
        )}
      >
        {count}
      </span>
    </button>
  )
}

function TestCard({
  item,
  index,
}: {
  item: LabTestCatalogItem
  index: number
}) {
  const sample = item.sampleType || "NONE"
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
    >
      <Card className="h-full transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-emerald-500/5">
        <CardContent className="flex h-full flex-col p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold leading-tight">
                {item.testName}
              </h3>
              {item.description ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {item.description}
                </p>
              ) : (
                <p className="mt-1 text-xs italic text-muted-foreground/60">
                  No description provided
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn("gap-1 text-[10px]", sampleColor(item.sampleType))}
            >
              <Droplet className="h-3 w-3" />
              {sample === "NONE" ? "No sample" : sample.charAt(0) + sample.slice(1).toLowerCase()}
            </Badge>
            {item.fastingRequired && (
              <Badge
                variant="outline"
                className="gap-1 bg-amber-50 text-amber-700 border-amber-200 text-[10px] dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20"
              >
                <Clock className="h-3 w-3" />
                Fasting
              </Badge>
            )}
            <Badge
              variant="outline"
              className="gap-1 bg-slate-50 text-slate-600 border-slate-200 text-[10px] dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/20"
            >
              <Clock className="h-3 w-3" />
              {item.durationMins} min
            </Badge>
          </div>

          <Separator className="my-3" />

          <div className="mt-auto flex items-end justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Price
              </p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatINR(item.price)}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Updated {format(parseISO(item.updatedAt), "dd MMM yyyy")}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────
//  Lab manager view (CRUD)
// ─────────────────────────────────────────────────────────
function LabCatalogView({
  loading,
  items,
  stats,
  patching,
  onAdd,
  onEdit,
  onDelete,
  onToggle,
}: {
  loading: boolean
  items: LabTestCatalogItem[]
  stats: { total: number; active: number; avg: number }
  patching: string | null
  onAdd: () => void
  onEdit: (item: LabTestCatalogItem) => void
  onDelete: (id: string) => void
  onToggle: (item: LabTestCatalogItem, value: boolean) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Stat row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Tests"
          value={stats.total}
          icon={FlaskConical}
          color="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
          accent="from-emerald-500 to-teal-500"
        />
        <StatCard
          title="Active Tests"
          value={stats.active}
          icon={CheckCircle2}
          color="bg-teal-50 text-teal-600 dark:bg-teal-500/10"
          accent="from-teal-500 to-cyan-500"
        />
        <StatCard
          title="Average Price"
          value={formatINR(Math.round(stats.avg))}
          icon={IndianRupee}
          color="bg-amber-50 text-amber-600 dark:bg-amber-500/10"
          accent="from-amber-500 to-orange-500"
        />
      </div>

      {/* Catalog table */}
      {loading ? (
        <CatalogTableSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={TestTube}
          title="No tests in your catalog yet. Click 'Add Test' to get started."
          description="Build your diagnostic test catalog so patients can browse and order tests from your lab."
          action={
            <Button
              onClick={onAdd}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="h-4 w-4" />
              Add Your First Test
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-2 border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-semibold">Your Test Catalog</h3>
                <Badge variant="secondary" className="text-[10px]">
                  {items.length} total
                </Badge>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test Name</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Category
                  </TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="hidden sm:table-cell">Sample</TableHead>
                  <TableHead className="hidden lg:table-cell">Fasting</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const sample = item.sampleType || "NONE"
                  const isPatching = patching === item.id
                  return (
                    <TableRow key={item.id} className="hover:bg-muted/30">
                      <TableCell className="min-w-[180px]">
                        <div className="flex flex-col">
                          <span className="font-medium leading-tight">
                            {item.testName}
                          </span>
                          {item.description && (
                            <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                              {item.description}
                            </span>
                          )}
                          <span className="mt-1 text-[10px] text-muted-foreground md:hidden">
                            {categoryLabel(item.category)} · {item.durationMins}m
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold",
                            CATEGORY_PILL_COLORS[item.category] ||
                              CATEGORY_PILL_COLORS.OTHER
                          )}
                        >
                          {categoryLabel(item.category)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatINR(item.price)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1 text-[10px]",
                            sampleColor(item.sampleType)
                          )}
                        >
                          <Droplet className="h-3 w-3" />
                          {sample === "NONE"
                            ? "N/A"
                            : sample.charAt(0) + sample.slice(1).toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {item.fastingRequired ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20"
                          >
                            Required
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.isActive}
                            onCheckedChange={(v) => onToggle(item, v)}
                            disabled={isPatching}
                            aria-label="Toggle active"
                          />
                          {isPatching ? (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          ) : (
                            <span
                              className={cn(
                                "text-xs font-medium",
                                item.isActive
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-muted-foreground"
                              )}
                            >
                              {item.isActive ? "Active" : "Inactive"}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onEdit(item)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-500/10"
                            aria-label="Edit test"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDelete(item.id)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10"
                            aria-label="Delete test"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────
//  Skeletons
// ─────────────────────────────────────────────────────────
function CatalogSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Separator />
              <div className="flex items-end justify-between">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function CatalogTableSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}
