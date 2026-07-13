"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useState } from "react"
import { MapPin, Mic, Users, Camera, Fingerprint, Bell, ShieldCheck } from "lucide-react"

interface Props {
  open: boolean
  onAccept: () => void
  onCancel: () => void
}

const PERMISSIONS = [
  { id: "location", label: "Location (GPS)", icon: MapPin, desc: "To find nearby doctors & estimate travel time" },
  { id: "mic", label: "Microphone", icon: Mic, desc: "For voice notes & AI voice assistance" },
  { id: "contacts", label: "Contacts", icon: Users, desc: "To add emergency contacts quickly" },
  { id: "camera", label: "Camera", icon: Camera, desc: "To scan prescriptions & capture documents" },
  { id: "biometric", label: "Biometric (Face/Fingerprint)", icon: Fingerprint, desc: "For secure biometric login" },
  { id: "notifications", label: "Notifications", icon: Bell, desc: "Appointment & insurance reminders" },
]

export function TermsDialog({ open, onAccept, onCancel }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({
    location: true,
    mic: true,
    contacts: true,
    camera: true,
    biometric: true,
    notifications: true,
  })
  const allRequired = Object.values(checked).every(Boolean)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
          </div>
          <DialogTitle className="text-center text-xl">
            Terms, Conditions & Permissions
          </DialogTitle>
          <DialogDescription className="text-center">
            To provide you with the best healthcare experience, we need your
            consent for the following permissions. Your data is encrypted and
            stored securely.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {PERMISSIONS.map((p) => {
            const Icon = p.icon
            return (
              <label
                key={p.id}
                htmlFor={p.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition hover:bg-muted/50"
              >
                <Checkbox
                  id={p.id}
                  checked={checked[p.id]}
                  onCheckedChange={(v) =>
                    setChecked((s) => ({ ...s, [p.id]: !!v }))
                  }
                  className="mt-1"
                />
                <Icon className="mt-0.5 h-5 w-5 text-emerald-600" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="text-xs text-muted-foreground">{p.desc}</div>
                </div>
              </label>
            )
          })}
          <p className="px-1 pt-2 text-xs text-muted-foreground">
            By continuing you agree to the{" "}
            <span className="font-medium text-foreground">
              Terms of Service
            </span>{" "}
            and{" "}
            <span className="font-medium text-foreground">Privacy Policy</span>.
            Healthcare records are encrypted end-to-end to maintain
            confidentiality.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            disabled={!allRequired}
            onClick={onAccept}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            I Agree & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
