"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { format } from "date-fns"
import { Calendar, Clock, Plus, Trash2, Loader2, Users, X, RefreshCw, CalendarClock } from "lucide-react"
import { toast } from "sonner"

import { useAuthStore } from "@/lib/auth-store"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
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
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * MoM Point 4 — Capacity-per-hour slot manager.
 *
 * Doctors / organizations define hourly slots (e.g. 10-11 AM, capacity 4).
 * Patients booking an appointment pick a slot; the system auto-blocks
 * further bookings once capacity is reached.
 */
interface Slot {
  id: string
  startAt: string
  endAt: string
  capacity: number
  bookedCount: number
  status: string // OPEN | FULL | CLOSED
  notes: string | null
  appointments?: Array<{
    id: string
    status: string
    patient: { name: string; mobile: string }
  }>
}

export default function CapacitySlots() {
  const user = useAuthStore((s) => s.user)
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    startTime: "10:00",
    endTime: "11:00",
    capacity: "4",
    notes: "",
    recurring: false,
  })
  const [saving, setSaving] = useState(false)

  const fetchSlots = async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await apiFetch<{ slots: Slot[] }>(
        `/api/capacity-slots?doctorId=${user.id}&from=${new Date().toISOString()}`
      )
      setSlots(res.slots || [])
    } catch (e) {
      toast.error("Failed to load slots: " + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSlots()
  }, [user?.id])

  const handleCreate = async () => {
    if (!user) return
    if (!form.date || !form.startTime || !form.endTime) {
      toast.error("Please fill date, start time and end time")
      return
    }
    const startAt = new Date(`${form.date}T${form.startTime}:00`)
    const endAt = new Date(`${form.date}T${form.endTime}:00`)
    if (endAt <= startAt) {
      toast.error("End time must be after start time")
      return
    }
    setSaving(true)
    try {
      await apiFetch("/api/capacity-slots", {
        method: "POST",
        body: JSON.stringify({
          doctorId: user.id,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          capacity: Number(form.capacity) || 1,
          notes: form.notes || null,
          recurring: form.recurring ? "weekly" : undefined,
        }),
      })
      toast.success(form.recurring ? "8 weekly slots created" : "Slot created")
      setOpen(false)
      setForm({
        date: new Date().toISOString().slice(0, 10),
        startTime: "10:00",
        endTime: "11:00",
        capacity: "4",
        notes: "",
        recurring: false,
      })
      fetchSlots()
    } catch (e) {
      toast.error("Failed to create slot: " + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (slot: Slot) => {
    const next = slot.status === "CLOSED" ? "OPEN" : "CLOSED"
    try {
      await apiFetch("/api/capacity-slots", {
        method: "PATCH",
        body: JSON.stringify({ id: slot.id, status: next }),
      })
      toast.success(`Slot ${next.toLowerCase()}`)
      fetchSlots()
    } catch (e) {
      toast.error("Failed to update slot")
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await apiFetch(`/api/capacity-slots?id=${deleteId}`, { method: "DELETE" })
      toast.success("Slot deleted")
      setDeleteId(null)
      fetchSlots()
    } catch (e) {
      toast.error("Failed to delete slot: " + (e as Error).message)
    }
  }

  // Group slots by date
  const byDate: Record<string, Slot[]> = {}
  for (const s of slots) {
    const d = format(new Date(s.startAt), "yyyy-MM-dd")
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(s)
  }
  const dateKeys = Object.keys(byDate).sort()

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      {/* Hero */}
      <Card className="overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-card dark:to-teal-950/20">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
              <CalendarClock className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Capacity Slots</h2>
              <p className="text-sm text-muted-foreground">
                Define hourly consultation slots. Patients book against these slots — capacity auto-blocks when full.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchSlots} disabled={loading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="mr-2 h-4 w-4" />
              New Slot
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBox label="Total Slots" value={slots.length} icon={Calendar} tone="emerald" />
        <StatBox label="Open" value={slots.filter((s) => s.status === "OPEN").length} icon={Clock} tone="sky" />
        <StatBox label="Full" value={slots.filter((s) => s.status === "FULL").length} icon={Users} tone="amber" />
        <StatBox label="Closed" value={slots.filter((s) => s.status === "CLOSED").length} icon={X} tone="rose" />
      </div>

      {/* Slots grouped by date */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <CalendarClock className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="font-medium">No capacity slots yet</p>
              <p className="text-sm text-muted-foreground">Create your first slot to start accepting time-bound appointments.</p>
            </div>
            <Button onClick={() => setOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="mr-2 h-4 w-4" />
              Create First Slot
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {dateKeys.map((dateKey) => (
            <div key={dateKey}>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-semibold">
                  {format(new Date(dateKey), "EEEE, MMMM d, yyyy")}
                </h3>
                <Badge variant="outline" className="text-xs">
                  {byDate[dateKey].length} slot{byDate[dateKey].length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {byDate[dateKey].map((slot) => (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    onToggle={() => handleToggleStatus(slot)}
                    onDelete={() => setDeleteId(slot.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Capacity Slot</DialogTitle>
            <DialogDescription>
              Define a time window patients can book against. Capacity auto-blocks when full.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="start">Start Time</Label>
                <Input
                  id="start"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="end">End Time</Label>
                <Input
                  id="end"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="cap">Capacity (max patients)</Label>
              <Input
                id="cap"
                type="number"
                min={1}
                max={50}
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                How many patients can be seen during this slot.
              </p>
            </div>
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                placeholder="e.g. Walk-in only, Telemedicine, etc."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm">
              <Switch
                checked={form.recurring}
                onCheckedChange={(v) => setForm({ ...form, recurring: v })}
              />
              <div>
                <div className="font-medium">Repeat weekly for 8 weeks</div>
                <div className="text-xs text-muted-foreground">Auto-create the same slot every week.</div>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this slot?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Slots with confirmed appointments cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}

function StatBox({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  icon: typeof Calendar
  tone: "emerald" | "sky" | "amber" | "rose"
}) {
  const toneClass = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  }[tone]
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function SlotCard({
  slot,
  onToggle,
  onDelete,
}: {
  slot: Slot
  onToggle: () => void
  onDelete: () => void
}) {
  const start = new Date(slot.startAt)
  const end = new Date(slot.endAt)
  const isFull = slot.status === "FULL"
  const isClosed = slot.status === "CLOSED"
  const isOpen = slot.status === "OPEN"
  const pct = slot.capacity > 0 ? Math.min(100, (slot.bookedCount / slot.capacity) * 100) : 0

  return (
    <Card className={cn("transition-shadow hover:shadow-md", isClosed && "opacity-60")}>
      <CardContent className="p-4">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {format(start, "h:mm a")} – {format(end, "h:mm a")}
            </div>
            {slot.notes && (
              <p className="mt-0.5 text-xs text-muted-foreground">{slot.notes}</p>
            )}
          </div>
          <Badge
            className={cn(
              "border",
              isOpen && "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400",
              isFull && "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400",
              isClosed && "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400"
            )}
          >
            {slot.status}
          </Badge>
        </div>
        <div className="mb-2 flex items-center gap-2 text-xs">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{slot.bookedCount}</span>
          <span className="text-muted-foreground">/ {slot.capacity} booked</span>
        </div>
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              pct >= 100 ? "bg-amber-500" : pct >= 50 ? "bg-sky-500" : "bg-emerald-500"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        {slot.appointments && slot.appointments.length > 0 && (
          <div className="mb-3 space-y-1 rounded-md bg-muted/50 p-2">
            {slot.appointments.slice(0, 3).map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs">
                <span className="font-medium truncate">{a.patient.name}</span>
                <Badge variant="outline" className="ml-auto text-[10px] py-0 px-1">
                  {a.status}
                </Badge>
              </div>
            ))}
            {slot.appointments.length > 3 && (
              <p className="text-[10px] text-muted-foreground">
                + {slot.appointments.length - 3} more
              </p>
            )}
          </div>
        )}
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={onToggle}>
            {isClosed ? "Reopen" : "Close"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
