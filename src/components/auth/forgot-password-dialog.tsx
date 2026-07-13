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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api"
import { validatePassword } from "@/lib/password"
import { PasswordStrength } from "./password-strength"
import { OtpDialog } from "./otp-dialog"
import { toast } from "sonner"
import { Loader2, KeyRound } from "lucide-react"

type Step = "request" | "otp" | "reset"

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ForgotPasswordDialog({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("request")
  const [identifier, setIdentifier] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [loading, setLoading] = useState(false)

  function close() {
    setStep("request")
    setIdentifier("")
    setNewPassword("")
    onClose()
  }

  async function requestOtp() {
    if (!identifier) return toast.error("Enter email or mobile")
    setLoading(true)
    try {
      await apiFetch("/api/auth/otp", {
        method: "POST",
        body: JSON.stringify({ identifier, purpose: "FORGOT_PASSWORD" }),
      })
      toast.success("OTP sent")
      setStep("otp")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function resetPassword() {
    const pwCheck = validatePassword(newPassword)
    if (!pwCheck.valid)
      return toast.error("Password: " + pwCheck.errors.join(", "))
    setLoading(true)
    try {
      await apiFetch("/api/auth/forgot", {
        method: "POST",
        body: JSON.stringify({ identifier, newPassword }),
      })
      toast.success("Password reset! Please login.")
      close()
      onSuccess()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Dialog open={open && step !== "otp"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <KeyRound className="h-6 w-6 text-emerald-600" />
            </div>
            <DialogTitle className="text-center">
              {step === "request" ? "Reset Password" : "Set New Password"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {step === "request"
                ? "Enter your registered email or mobile to receive an OTP"
                : "Enter a strong new password for your account"}
            </DialogDescription>
          </DialogHeader>

          {step === "request" && (
            <div className="space-y-2">
              <Label>Email or Mobile</Label>
              <Input
                placeholder="you@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
          )}

          {step === "reset" && (
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <PasswordStrength password={newPassword} />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={close} className="flex-1">
              Cancel
            </Button>
            {step === "request" ? (
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={loading}
                onClick={requestOtp}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send OTP
              </Button>
            ) : (
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={loading}
                onClick={resetPassword}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OtpDialog
        open={open && step === "otp"}
        identifier={identifier}
        purpose="FORGOT_PASSWORD"
        onClose={close}
        onVerified={() => {
          toast.success("OTP verified! Set a new password.")
          setStep("reset")
        }}
      />
    </>
  )
}
