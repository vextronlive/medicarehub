"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Star, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  doctorName: string
  doctorId: string
  patientId: string
  onSubmitted?: (score?: number) => void
}

export function RatingDialog({
  open,
  onOpenChange,
  doctorName,
  doctorId,
  patientId,
  onSubmitted,
}: Props) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState("")
  const [loading, setLoading] = useState(false)

  const labels = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"]
  const display = hover || rating

  async function submit() {
    if (rating === 0) {
      toast.error("Please select a star rating")
      return
    }
    setLoading(true)
    try {
      await apiFetch("/api/ratings", {
        method: "POST",
        body: JSON.stringify({
          fromId: patientId,
          toId: doctorId,
          score: rating,
          comment: comment.trim() || undefined,
        }),
      })
      toast.success("Thank you for your feedback!")
      setRating(0)
      setHover(0)
      setComment("")
      onOpenChange(false)
      onSubmitted?.(rating)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
            <Star className="h-7 w-7 fill-amber-400 text-amber-400" />
          </div>
          <DialogTitle>Rate your visit</DialogTitle>
          <DialogDescription>
            How was your experience with{" "}
            <span className="font-medium text-foreground">{doctorName}</span>?
            Your feedback helps other patients.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Star selector */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  className="rounded-md p-1 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
                >
                  <Star
                    className={cn(
                      "h-8 w-8 transition-colors",
                      n <= display
                        ? "fill-amber-400 text-amber-400"
                        : "fill-muted text-muted-foreground/40"
                    )}
                  />
                </button>
              ))}
            </div>
            {display > 0 && (
              <p className="text-sm font-medium text-amber-600">
                {labels[display]}
              </p>
            )}
          </div>

          {/* Comment */}
          <div className="space-y-1.5">
            <Label htmlFor="comment" className="text-xs">
              Comment (optional)
            </Label>
            <Textarea
              id="comment"
              placeholder="Share details of your visit..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            disabled={loading || rating === 0}
            onClick={submit}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Rating
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
