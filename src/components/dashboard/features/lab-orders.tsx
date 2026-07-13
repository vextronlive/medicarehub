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
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
import { cn } from "@/lib/utils"

import {
  TestTube,
  Plus,
  Loader2,
  CheckCircle2,
  IndianRupee,
  Activity,
  FileText,
  ExternalLink,
  Phone,
  MapPin,
  Play,
  Check,
  X,
  FlaskConical,
  ClipboardList,
  Receipt,
  Building2,
  Droplet,
} from "lucide-react"

// ─────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────
type Status = "REQUESTED" | "SAMPLE_COLLECTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
type Payment = "PENDING" | "PAID"
type Role = "PATIENT" | "DOCTOR" | "ORGANIZATION"

interface Person {
  id: string
  name: string
  mobile?: string | null
  bloodGroup?: string | null
  city?: string | null
  state?: string | null
}

interface LabOrder {
  id: string
  orderNumber: string
  patientId: string
  labId: string
  tests: string // JSON array of test names
  notes?: string | null
  status: Status
  totalAmount: number
  paymentStatus: Payment
  reportUrl?: string | null
  createdAt: string
  updatedAt: string
  patient: Person
  lab: Person
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
const PRESET_TESTS: { name: string; price: number }[] = [
  { name: "Complete Blood Count (CBC)", price: 300 },
  { name: "Lipid Profile", price: 800 },
  { name: "Blood Glucose (Fasting)", price: 120 },
  { name: "HbA1c", price: 450 },
  { name: "Liver Function Test (LFT)", price: 700 },
  { name: "Kidney Function Test (KFT)", price: 650 },
  { name: "Thyroid Profile (T3/T4/TSH)", price: 600 },
  { name: "Vitamin D", price: 1200 },
  { name: "Vitamin B12", price: 800 },
  { name: "Urine Routine", price: 150 },
  { name: "ECG", price: 400 },
  { name: "X-Ray Chest", price: 500 },
  { name: "MRI Brain", price: 6000 },
  { name: "CT Scan Abdomen", price: 4500 },
  { name: "COVID-19 RT-PCR", price: 700 },
]

const STATUS_COLORS: Record<Status, string> = {
  REQUESTED: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20",
  SAMPLE_COLLECTED: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
  IN_PROGRESS: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20",
}

const STATUS_LABEL: Record<Status, string> = {
  REQUESTED: "Requested",
  SAMPLE_COLLECTED: "Sample Collected",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
}

function parseTests(tests: string): string[] {
  try {
    const v = JSON.parse(tests)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

function formatINR(amount: number): string {
  return `₹${(amount || 0).toLocaleString("en-IN")}`
}

// ─────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────
function LabOrders({ role }: { role: Role }) {
  const user = useAuthStore((s) => s.user)
  const isPatient = role === "PATIENT"

  const [orders, setOrders] = useState<LabOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>("all")

  // New order dialog (patient)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [labs, setLabs] = useState<LabOption[]>([])
  const [loadingLabs, setLoadingLabs] = useState(false)
  const [selectedLabId, setSelectedLabId] = useState("")
  const [selectedTests, setSelectedTests] = useState<string[]>([])
  const [customTests, setCustomTests] = useState<string[]>([])
  const [customTestInput, setCustomTestInput] = useState("")
  const [notes, setNotes] = useState("")
  const [totalAmount, setTotalAmount] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // Complete dialog (doctor/org)
  const [completeDialog, setCompleteDialog] = useState<{
    open: boolean
    orderId: string | null
    reportUrl: string
  }>({ open: false, orderId: null, reportUrl: "" })

  // Cancel dialog (doctor/org)
  const [cancelDialog, setCancelDialog] = useState<{
    open: boolean
    orderId: string | null
  }>({ open: false, orderId: null })

  const [patching, setPatching] = useState<string | null>(null)

  // ─────────────────────────────────────────────────────────
  //  Fetch orders
  // ─────────────────────────────────────────────────────────
  const loadOrders = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await apiFetch<{ orders: LabOrder[] }>(
        `/api/lab-orders?userId=${encodeURIComponent(user.id)}&role=${role}`
      )
      setOrders(data.orders || [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load lab orders")
    } finally {
      setLoading(false)
    }
  }, [user, role])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // ─────────────────────────────────────────────────────────
  //  Fetch labs (patient, lazy)
  // ─────────────────────────────────────────────────────────
  const loadLabs = useCallback(async () => {
    setLoadingLabs(true)
    try {
      const data = await apiFetch<{ doctors: LabOption[] }>(
        `/api/doctors?role=ORGANIZATION`
      )
      setLabs(data.doctors || [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load labs")
    } finally {
      setLoadingLabs(false)
    }
  }, [])

  useEffect(() => {
    if (isPatient && showNewDialog && labs.length === 0) {
      loadLabs()
    }
  }, [isPatient, showNewDialog, labs.length, loadLabs])

  // ─────────────────────────────────────────────────────────
  //  Auto-suggest total
  // ─────────────────────────────────────────────────────────
  const suggestedTotal = useMemo(() => {
    return selectedTests.reduce((sum, name) => {
      const p = PRESET_TESTS.find((t) => t.name === name)
      return sum + (p?.price || 0)
    }, 0)
  }, [selectedTests])

  // When test selection changes, re-suggest the total (user can still override between changes)
  useEffect(() => {
    setTotalAmount(suggestedTotal)
  }, [suggestedTotal])

  // ─────────────────────────────────────────────────────────
  //  Stats
  // ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const inProgress = orders.filter(
      (o) => o.status === "SAMPLE_COLLECTED" || o.status === "IN_PROGRESS"
    ).length
    const completed = orders.filter((o) => o.status === "COMPLETED").length
    const requested = orders.filter((o) => o.status === "REQUESTED").length
    const money = orders
      .filter((o) => o.paymentStatus === "PAID")
      .reduce((s, o) => s + (o.totalAmount || 0), 0)
    return {
      inProgress,
      completed,
      requested,
      money,
      total: orders.length,
    }
  }, [orders])

  // ─────────────────────────────────────────────────────────
  //  Filter
  // ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (activeTab === "all") return orders
    if (isPatient && activeTab === "in_progress") {
      return orders.filter(
        (o) => o.status === "SAMPLE_COLLECTED" || o.status === "IN_PROGRESS"
      )
    }
    return orders.filter((o) => o.status === activeTab.toUpperCase())
  }, [orders, activeTab, isPatient])

  // ─────────────────────────────────────────────────────────
  //  New order handlers (patient)
  // ─────────────────────────────────────────────────────────
  function resetNewForm() {
    setSelectedLabId("")
    setSelectedTests([])
    setCustomTests([])
    setCustomTestInput("")
    setNotes("")
    setTotalAmount(0)
  }

  function toggleTest(name: string) {
    setSelectedTests((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
    )
  }

  function addCustomTest() {
    const v = customTestInput.trim()
    if (!v) return
    if (selectedTests.includes(v) || customTests.includes(v)) {
      toast.error("That test is already added")
      return
    }
    setCustomTests((prev) => [...prev, v])
    setCustomTestInput("")
  }

  function removeCustomTest(name: string) {
    setCustomTests((prev) => prev.filter((t) => t !== name))
  }

  async function submitNewOrder() {
    if (!user) return
    if (!selectedLabId) {
      toast.error("Please select a lab")
      return
    }
    const allTests = [...selectedTests, ...customTests]
    if (allTests.length === 0) {
      toast.error("Select at least one test")
      return
    }
    setSubmitting(true)
    try {
      const res = await apiFetch<{ order: LabOrder }>("/api/lab-orders", {
        method: "POST",
        body: JSON.stringify({
          patientId: user.id,
          labId: selectedLabId,
          tests: allTests,
          notes: notes.trim() || undefined,
          totalAmount: Number(totalAmount) || 0,
        }),
      })
      // Nuclear fix: the POST response IS the canonical record.
      // Gate the toast + state update on the response payload so we
      // never show a false "successfully added" toast. Do NOT fire an
      // un-awaited background refetch — Supabase pooler read-after-write
      // lag can cause the refetch to return a list WITHOUT the new item,
      // which would wholesale-replace state and silently wipe it.
      if (!res?.order) {
        throw new Error("Server confirmed the save but did not return the record.")
      }
      setOrders((prev) => [res.order, ...prev])
      toast.success("Lab order placed successfully")
      setShowNewDialog(false)
      resetNewForm()
      // No background refetch — the POST response above is the source of truth.
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to place order")
    } finally {
      setSubmitting(false)
    }
  }

  // ─────────────────────────────────────────────────────────
  //  Patch handlers (doctor/org)
  // ─────────────────────────────────────────────────────────
  async function patchOrder(
    id: string,
    payload: { status?: Status; paymentStatus?: Payment; reportUrl?: string }
  ) {
    setPatching(id)
    try {
      const res = await apiFetch<{ order: LabOrder }>("/api/lab-orders", {
        method: "PATCH",
        body: JSON.stringify({ id, ...payload }),
      })
      // Nuclear fix: gate toast + state update on the response payload.
      // Do NOT fire an un-awaited background refetch — Supabase pooler
      // read-after-write lag can cause the refetch to return a list
      // WITHOUT the updated item, wholesale-replacing state and silently
      // wiping it.
      if (!res?.order) {
        throw new Error("Server confirmed the update but did not return the record.")
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, ...res.order } : o))
      )
      toast.success("Order updated")
      // No background refetch — the PATCH response above is the source of truth.
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update order")
    } finally {
      setPatching(null)
    }
  }

  function handleAcceptSample(orderId: string) {
    patchOrder(orderId, { status: "SAMPLE_COLLECTED" })
  }
  function handleStartProcessing(orderId: string) {
    patchOrder(orderId, { status: "IN_PROGRESS" })
  }
  function handleMarkPaid(orderId: string) {
    patchOrder(orderId, { paymentStatus: "PAID" })
  }
  function openCompleteDialog(orderId: string) {
    setCompleteDialog({ open: true, orderId, reportUrl: "" })
  }
  async function submitComplete() {
    if (!completeDialog.orderId) return
    await patchOrder(completeDialog.orderId, {
      status: "COMPLETED",
      reportUrl: completeDialog.reportUrl.trim() || undefined,
    })
    setCompleteDialog({ open: false, orderId: null, reportUrl: "" })
  }
  function openCancelDialog(orderId: string) {
    setCancelDialog({ open: true, orderId })
  }
  async function submitCancel() {
    if (!cancelDialog.orderId) return
    await patchOrder(cancelDialog.orderId, { status: "CANCELLED" })
    setCancelDialog({ open: false, orderId: null })
  }

  // ─────────────────────────────────────────────────────────
  //  Guard
  // ─────────────────────────────────────────────────────────
  if (!user) return null

  const tabs = isPatient
    ? [
        { value: "all", label: "All" },
        { value: "requested", label: "Requested" },
        { value: "in_progress", label: "In Progress" },
        { value: "completed", label: "Completed" },
        { value: "cancelled", label: "Cancelled" },
      ]
    : [
        { value: "all", label: "All" },
        { value: "requested", label: "Requested" },
        { value: "sample_collected", label: "Sample Collected" },
        { value: "in_progress", label: "In Progress" },
        { value: "completed", label: "Completed" },
        { value: "cancelled", label: "Cancelled" },
      ]

  // ─────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <HeroBanner
        title={isPatient ? "Lab Tests" : "Incoming Lab Orders"}
        subtitle={
          isPatient
            ? "Order diagnostic tests from partnered labs and track your results."
            : "Manage and fulfill diagnostic test orders from patients."
        }
        icon={TestTube}
      >
        {isPatient && (
          <Button
            onClick={() => setShowNewDialog(true)}
            className="bg-white text-emerald-700 hover:bg-emerald-50 shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">Order New Test</span>
            <span className="ml-1 sm:hidden">New</span>
          </Button>
        )}
      </HeroBanner>

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isPatient ? (
          <>
            <StatCard
              title="Total Orders"
              value={stats.total}
              icon={ClipboardList}
              color="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
              accent="from-emerald-500 to-teal-500"
            />
            <StatCard
              title="In Progress"
              value={stats.inProgress}
              icon={Activity}
              color="bg-amber-50 text-amber-600 dark:bg-amber-500/10"
              accent="from-amber-500 to-orange-500"
            />
            <StatCard
              title="Completed"
              value={stats.completed}
              icon={CheckCircle2}
              color="bg-teal-50 text-teal-600 dark:bg-teal-500/10"
              accent="from-teal-500 to-cyan-500"
            />
            <StatCard
              title="Total Spend"
              value={formatINR(stats.money)}
              icon={IndianRupee}
              color="bg-sky-50 text-sky-600 dark:bg-sky-500/10"
              accent="from-sky-500 to-cyan-500"
            />
          </>
        ) : (
          <>
            <StatCard
              title="New Requests"
              value={stats.requested}
              icon={ClipboardList}
              color="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
              accent="from-emerald-500 to-teal-500"
            />
            <StatCard
              title="In Progress"
              value={stats.inProgress}
              icon={Activity}
              color="bg-amber-50 text-amber-600 dark:bg-amber-500/10"
              accent="from-amber-500 to-orange-500"
            />
            <StatCard
              title="Completed"
              value={stats.completed}
              icon={CheckCircle2}
              color="bg-teal-50 text-teal-600 dark:bg-teal-500/10"
              accent="from-teal-500 to-cyan-500"
            />
            <StatCard
              title="Revenue"
              value={formatINR(stats.money)}
              icon={IndianRupee}
              color="bg-sky-50 text-sky-600 dark:bg-sky-500/10"
              accent="from-sky-500 to-cyan-500"
            />
          </>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => {
          const active = activeTab === t.value
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setActiveTab(t.value)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              )}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Orders */}
      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={TestTube}
          title={isPatient ? "No lab orders yet" : "No incoming orders"}
          description={
            isPatient
              ? "Place your first diagnostic test order from a partnered lab to get started."
              : "Patient lab orders will appear here as soon as they're placed."
          }
          action={
            isPatient ? (
              <Button
                onClick={() => setShowNewDialog(true)}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                <span className="ml-1">Order New Test</span>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4">
          {filtered.map((order, idx) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.4) }}
            >
              <OrderCard
                order={order}
                role={role}
                patching={patching === order.id}
                onAcceptSample={handleAcceptSample}
                onStartProcessing={handleStartProcessing}
                onOpenComplete={openCompleteDialog}
                onOpenCancel={openCancelDialog}
                onMarkPaid={handleMarkPaid}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* New Order Dialog (patient) */}
      <Dialog
        open={showNewDialog}
        onOpenChange={(open) => {
          setShowNewDialog(open)
          if (!open) resetNewForm()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5 text-emerald-600" />
              Order New Lab Test
            </DialogTitle>
            <DialogDescription>
              Choose a partnered lab and select the tests you&apos;d like to order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Lab select */}
            <div className="space-y-2">
              <Label>Lab / Hospital</Label>
              {loadingLabs ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading labs...
                </div>
              ) : labs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No partnered labs found. Please try again later.
                </p>
              ) : (
                <Select value={selectedLabId} onValueChange={setSelectedLabId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a lab" />
                  </SelectTrigger>
                  <SelectContent>
                    {labs.map((lab) => (
                      <SelectItem key={lab.id} value={lab.id}>
                        {lab.name}
                        {lab.city ? ` — ${lab.city}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Tests */}
            <div className="space-y-3">
              <Label>Select Tests</Label>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-3">
                {PRESET_TESTS.map((t) => {
                  const checked = selectedTests.includes(t.name)
                  return (
                    <label
                      key={t.name}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-md p-2 text-sm transition-colors",
                        checked
                          ? "bg-emerald-50 dark:bg-emerald-500/10"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleTest(t.name)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-tight">{t.name}</p>
                        <p className="text-xs text-muted-foreground">₹{t.price}</p>
                      </div>
                    </label>
                  )
                })}
              </div>

              {/* Custom tests */}
              {customTests.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {customTests.map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1 pr-1.5">
                      {t}
                      <button
                        type="button"
                        onClick={() => removeCustomTest(t)}
                        className="rounded-full p-0.5 hover:bg-muted"
                        aria-label={`Remove ${t}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder="Add other test (custom name)"
                  value={customTestInput}
                  onChange={(e) => setCustomTestInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addCustomTest()
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addCustomTest}
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="lab-notes">Notes (optional)</Label>
              <Textarea
                id="lab-notes"
                placeholder="Any specific instructions for the lab..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Total */}
            <div className="space-y-2">
              <Label htmlFor="lab-total">Total Amount (INR)</Label>
              <Input
                id="lab-total"
                type="number"
                min={0}
                value={totalAmount}
                onChange={(e) => setTotalAmount(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Auto-suggested based on selected tests. You can edit if needed.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewDialog(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={submitNewOrder}
              disabled={submitting || loadingLabs}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span className={submitting ? "ml-1" : ""}>Place Order</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog (doctor/org) */}
      <Dialog
        open={completeDialog.open}
        onOpenChange={(open) => setCompleteDialog((s) => ({ ...s, open }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Order Completed</DialogTitle>
            <DialogDescription>
              Optionally attach a report URL so the patient can view their results.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="report-url">Report URL (optional)</Label>
            <Input
              id="report-url"
              placeholder="https://reports.example.com/..."
              value={completeDialog.reportUrl}
              onChange={(e) =>
                setCompleteDialog((s) => ({ ...s, reportUrl: e.target.value }))
              }
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setCompleteDialog({ open: false, orderId: null, reportUrl: "" })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={submitComplete}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Check className="h-4 w-4" />
              <span className="ml-1">Mark Completed</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel AlertDialog (doctor/org) */}
      <AlertDialog
        open={cancelDialog.open}
        onOpenChange={(open) => setCancelDialog((s) => ({ ...s, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the lab order as cancelled. The patient will no longer
              be able to track it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, keep order</AlertDialogCancel>
            <AlertDialogAction
              onClick={submitCancel}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              Yes, cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
//  Order Card
// ─────────────────────────────────────────────────────────
function OrderCard({
  order,
  role,
  patching,
  onAcceptSample,
  onStartProcessing,
  onOpenComplete,
  onOpenCancel,
  onMarkPaid,
}: {
  order: LabOrder
  role: Role
  patching: boolean
  onAcceptSample: (id: string) => void
  onStartProcessing: (id: string) => void
  onOpenComplete: (id: string) => void
  onOpenCancel: (id: string) => void
  onMarkPaid: (id: string) => void
}) {
  const tests = parseTests(order.tests)
  const isPatient = role === "PATIENT"
  const isCancelled = order.status === "CANCELLED"
  const partner = isPatient ? order.lab : order.patient
  const created = parseISO(order.createdAt)

  return (
    <Card className={cn("overflow-hidden", isCancelled && "opacity-70")}>
      <CardContent className="p-5">
        {/* Header row */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold tracking-tight">
                {order.orderNumber}
              </span>
              <Badge
                variant="outline"
                className={cn("border", STATUS_COLORS[order.status])}
              >
                {STATUS_LABEL[order.status]}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "border",
                  order.paymentStatus === "PAID"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20"
                    : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20"
                )}
              >
                {order.paymentStatus === "PAID" ? "Paid" : "Payment Pending"}
              </Badge>
            </div>

            {isPatient ? (
              <p className="text-sm font-medium">
                <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {partner.name}
                  </span>
                  {partner.city && (
                    <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {partner.city}
                      {partner.state ? `, ${partner.state}` : ""}
                    </span>
                  )}
                </span>
              </p>
            ) : (
              <p className="text-sm font-medium">
                <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>{partner.name}</span>
                  {partner.bloodGroup && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Droplet className="h-3 w-3" />
                      {partner.bloodGroup}
                    </span>
                  )}
                  {partner.mobile && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {partner.mobile}
                    </span>
                  )}
                  {partner.city && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {partner.city}
                    </span>
                  )}
                </span>
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              {isPatient ? "Ordered on " : "Requested on "}
              {format(created, "dd MMM yyyy, hh:mm a")}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Total
            </p>
            <p className="text-lg font-bold">{formatINR(order.totalAmount || 0)}</p>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Tests */}
        <div className="flex flex-wrap gap-1.5">
          {tests.length === 0 ? (
            <span className="text-sm text-muted-foreground">No tests</span>
          ) : (
            tests.map((t, i) => (
              <Badge key={`${t}-${i}`} variant="secondary" className="font-normal">
                <FlaskConical className="mr-1 h-3 w-3" />
                {t}
              </Badge>
            ))
          )}
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {isPatient ? "Your notes" : "Patient notes"}
            </p>
            <p className="text-foreground/90">{order.notes}</p>
          </div>
        )}

        {/* View report (patient, completed) */}
        {isPatient && order.status === "COMPLETED" && order.reportUrl && (
          <div className="mt-4">
            <Button
              asChild
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <a
                href={order.reportUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText className="h-4 w-4" />
                <span className="ml-1">View Report</span>
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          </div>
        )}

        {/* Actions (doctor/org) */}
        {!isPatient && !isCancelled && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {order.status === "REQUESTED" && (
              <Button
                size="sm"
                onClick={() => onAcceptSample(order.id)}
                disabled={patching}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {patching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span className="ml-1">Accept &amp; Collect Sample</span>
              </Button>
            )}
            {order.status === "SAMPLE_COLLECTED" && (
              <Button
                size="sm"
                onClick={() => onStartProcessing(order.id)}
                disabled={patching}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {patching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span className="ml-1">Start Processing</span>
              </Button>
            )}
            {order.status === "IN_PROGRESS" && (
              <Button
                size="sm"
                onClick={() => onOpenComplete(order.id)}
                disabled={patching}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {patching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span className="ml-1">Mark Completed</span>
              </Button>
            )}
            {order.paymentStatus === "PENDING" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onMarkPaid(order.id)}
                disabled={patching}
              >
                <Receipt className="h-4 w-4" />
                <span className="ml-1">Mark Paid</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenCancel(order.id)}
              disabled={patching}
              className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500/20 dark:text-rose-400 dark:hover:bg-rose-500/10"
            >
              <X className="h-4 w-4" />
              <span className="ml-1">Cancel</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default LabOrders
export { LabOrders }
