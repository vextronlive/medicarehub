"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { apiFetch, ApiError } from "@/lib/api"
import {
  ShieldCheck,
  Loader2,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from "lucide-react"
import { toast } from "sonner"
import { AnimatePresence, motion } from "framer-motion"

const DEFAULT_RESEND_SECONDS = 60
const MAX_ATTEMPTS = 5
const SUCCESS_HOLD_MS = 1100

interface Props {
  open: boolean
  identifier: string
  purpose: "SIGNUP" | "FORGOT_PASSWORD"
  onClose: () => void
  onVerified: () => void
}

type ErrorKind = "invalid" | "expired" | "locked" | "rate" | "generic" | null

interface ErrorState {
  kind: ErrorKind
  message: string
}

interface OtpCreateResponse {
  ok?: boolean
  demoCode?: string
  maskedIdentifier?: string
  expiresAt?: string
  resendCooldownSec?: number
  retryAfter?: number
  error?: string
}

function formatCountdown(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60)
  const ss = totalSeconds % 60
  return `${mm}:${String(ss).padStart(2, "0")}`
}

export function OtpDialog({
  open,
  identifier,
  purpose,
  onClose,
  onVerified,
}: Props) {
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [demoCode, setDemoCode] = useState<string | null>(null)
  const [maskedIdentifier, setMaskedIdentifier] = useState<string>("")
  const [resendIn, setResendIn] = useState(0)
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_ATTEMPTS)
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState<ErrorState>({ kind: null, message: "" })
  const [showSuccess, setShowSuccess] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Countdown ticker ────────────────────────────────────────
  useEffect(() => {
    if (resendIn <= 0) return
    intervalRef.current = setInterval(() => {
      setResendIn((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [resendIn])

  // ── Reset all dialog state ──────────────────────────────────
  const resetState = useCallback(() => {
    setCode("")
    setLoading(false)
    setRequesting(false)
    setDemoCode(null)
    setMaskedIdentifier("")
    setResendIn(0)
    setAttemptsRemaining(MAX_ATTEMPTS)
    setLocked(false)
    setError({ kind: null, message: "" })
    setShowSuccess(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current)
      successTimerRef.current = null
    }
  }, [])

  // ── Request a fresh OTP (POST) ──────────────────────────────
  const requestOtp = useCallback(
    async (opts?: { silent?: boolean }) => {
      setRequesting(true)
      setError({ kind: null, message: "" })
      try {
        const res = await apiFetch<OtpCreateResponse>("/api/auth/otp", {
          method: "POST",
          body: JSON.stringify({ identifier, purpose }),
        })
        setDemoCode(res.demoCode ?? null)
        setMaskedIdentifier(res.maskedIdentifier ?? identifier)
        setResendIn(res.resendCooldownSec ?? DEFAULT_RESEND_SECONDS)
        setAttemptsRemaining(MAX_ATTEMPTS)
        setLocked(false)
        setCode("")
        if (!opts?.silent) toast.success("Code sent")
      } catch (e) {
        if (e instanceof ApiError) {
          const body = e.body as OtpCreateResponse
          if (e.status === 429 && typeof body.retryAfter === "number") {
            // Rate-limited. If the server returned a demoCode it means an
            // active OTP already exists for this identifier (e.g. because
            // ForgotPasswordDialog pre-requested one before opening us).
            // Treat that as a soft success — surface the code & countdown
            // without a scary banner so the user can still verify.
            const hasUsableCode = !!body.demoCode
            setResendIn(body.retryAfter)
            setMaskedIdentifier(body.maskedIdentifier ?? identifier)
            setDemoCode(body.demoCode ?? null)
            setCode("")
            setLocked(false)
            setAttemptsRemaining(MAX_ATTEMPTS)
            if (hasUsableCode) {
              setError({ kind: null, message: "" })
              if (!opts?.silent) toast.success("Code sent")
            } else {
              setError({
                kind: "rate",
                message:
                  body.error ?? "Please wait before requesting another code.",
              })
              if (!opts?.silent) {
                toast.error(
                  `Please wait ${formatCountdown(body.retryAfter)} before resending`
                )
              }
            }
          } else {
            const msg = body.error ?? "Failed to send code"
            setError({ kind: "generic", message: msg })
            if (!opts?.silent) toast.error(msg)
          }
        } else {
          const msg = (e as Error).message || "Failed to send code"
          setError({ kind: "generic", message: msg })
          if (!opts?.silent) toast.error(msg)
        }
      } finally {
        setRequesting(false)
      }
    },
    [identifier, purpose]
  )

  // ── Lifecycle: open / close ─────────────────────────────────
  useEffect(() => {
    if (open) {
      // Silent on first open — ForgotPasswordDialog pre-requests an OTP
      // before opening us; if our POST is rate-limited because of that,
      // we'll get the existing demoCode back and treat it as a soft success.
      void requestOtp({ silent: true })
    } else {
      resetState()
    }
  }, [open, requestOtp, resetState])

  // ── Final cleanup on unmount ────────────────────────────────
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
    }
  }, [])

  // ── Verify (PUT) ────────────────────────────────────────────
  const verify = useCallback(async () => {
    if (code.length < 6 || loading || locked || showSuccess) return
    setLoading(true)
    setError({ kind: null, message: "" })
    try {
      await apiFetch("/api/auth/otp", {
        method: "PUT",
        body: JSON.stringify({ identifier, code, purpose }),
      })
      setShowSuccess(true)
      toast.success("Verified successfully")
      successTimerRef.current = setTimeout(() => {
        onVerified()
      }, SUCCESS_HOLD_MS)
    } catch (e) {
      if (e instanceof ApiError) {
        const body = e.body as {
          attemptsRemaining?: number
          locked?: boolean
          error?: string
        }
        const remaining =
          typeof body.attemptsRemaining === "number"
            ? body.attemptsRemaining
            : Math.max(0, attemptsRemaining - 1)
        setAttemptsRemaining(remaining)

        if (e.status === 429 || body.locked || remaining <= 0) {
          setLocked(true)
          setError({
            kind: "locked",
            message:
              body.error ?? "Too many attempts. Please request a new code.",
          })
          toast.error(body.error ?? "Too many attempts. Please request a new code.")
        } else if (body.error && /expired|request a new/i.test(body.error)) {
          setError({ kind: "expired", message: body.error })
          toast.error(body.error)
        } else {
          setError({
            kind: "invalid",
            message: body.error ?? "Incorrect code. Please try again.",
          })
          toast.error(body.error ?? "Incorrect code")
        }
      } else {
        const msg = (e as Error).message || "Verification failed"
        setError({ kind: "generic", message: msg })
        toast.error(msg)
      }
      setCode("")
    } finally {
      setLoading(false)
    }
  }, [
    code,
    loading,
    locked,
    showSuccess,
    identifier,
    purpose,
    attemptsRemaining,
    onVerified,
  ])

  // ── Resend ──────────────────────────────────────────────────
  const resend = useCallback(async () => {
    if (resendIn > 0 || requesting) return
    await requestOtp()
  }, [resendIn, requesting, requestOtp])

  // ── Clear error on retype ───────────────────────────────────
  const handleCodeChange = (val: string) => {
    setCode(val)
    if (error.kind && error.kind !== "locked" && error.kind !== "rate") {
      setError({ kind: null, message: "" })
    }
  }

  const countdownLabel = formatCountdown(resendIn)
  const canVerify =
    code.length === 6 && !loading && !locked && !showSuccess && !requesting
  const canResend =
    resendIn === 0 && !requesting && !loading && !showSuccess

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[440px] gap-0 overflow-hidden p-6 sm:p-6">
        <AnimatePresence mode="wait">
          {showSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="flex flex-col items-center justify-center py-10 text-center"
            >
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 18,
                    delay: 0.05,
                  }}
                >
                  <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                </motion.div>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Verified</h3>
              <p className="mt-1 text-sm text-slate-500">
                Your identity has been confirmed.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {/* Header */}
              <DialogHeader className="items-center text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-200">
                  <ShieldCheck className="h-7 w-7 text-white" />
                </div>
                <DialogTitle className="text-xl font-semibold text-slate-900">
                  Verify your identity
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500">
                  Enter the 6-digit code sent to{" "}
                  <span className="font-semibold text-slate-700">
                    {maskedIdentifier || identifier}
                  </span>
                </DialogDescription>
              </DialogHeader>

              {/* OTP input */}
              <div className="mt-6 flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={handleCodeChange}
                  disabled={locked || showSuccess}
                  autoFocus
                >
                  <InputOTPGroup className="gap-1.5">
                    <InputOTPSlot
                      index={0}
                      className="h-12 w-9 text-lg font-semibold sm:h-14 sm:w-11"
                    />
                    <InputOTPSlot
                      index={1}
                      className="h-12 w-9 text-lg font-semibold sm:h-14 sm:w-11"
                    />
                    <InputOTPSlot
                      index={2}
                      className="h-12 w-9 text-lg font-semibold sm:h-14 sm:w-11"
                    />
                    <InputOTPSlot
                      index={3}
                      className="h-12 w-9 text-lg font-semibold sm:h-14 sm:w-11"
                    />
                    <InputOTPSlot
                      index={4}
                      className="h-12 w-9 text-lg font-semibold sm:h-14 sm:w-11"
                    />
                    <InputOTPSlot
                      index={5}
                      className="h-12 w-9 text-lg font-semibold sm:h-14 sm:w-11"
                    />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {/* Inline error / warning banner */}
              {error.kind && (
                <div
                  className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                    error.kind === "locked" || error.kind === "rate"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-rose-200 bg-rose-50 text-rose-600"
                  }`}
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error.message}</span>
                </div>
              )}

              {/* Attempts remaining */}
              {!locked &&
                error.kind !== "rate" &&
                attemptsRemaining < MAX_ATTEMPTS && (
                  <div className="mt-3 text-center text-xs">
                    <span
                      className={
                        attemptsRemaining <= 2
                          ? "font-medium text-amber-600"
                          : "text-slate-500"
                      }
                    >
                      {attemptsRemaining} attempt
                      {attemptsRemaining === 1 ? "" : "s"} remaining
                    </span>
                  </div>
                )}

              {/* Demo code hint (sandbox only) */}
              {demoCode && (
                <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-dashed border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-700">
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Demo mode: your code is</span>
                  <span className="font-mono font-bold tracking-widest text-emerald-800">
                    {demoCode}
                  </span>
                </div>
              )}

              {/* Verify button */}
              <Button
                onClick={verify}
                disabled={!canVerify}
                className="mt-5 h-11 w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-base font-semibold text-white shadow-md shadow-emerald-200 hover:from-emerald-600 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {locked ? "Locked" : "Verify & Continue"}
              </Button>

              {/* Resend + change identifier */}
              <div className="mt-5 flex flex-col items-center gap-3 border-t border-slate-100 pt-4 text-center">
                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>Didn&apos;t receive a code?</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resend}
                  disabled={!canResend}
                  className="h-9 gap-1.5 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 disabled:text-slate-400"
                >
                  {requesting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {resendIn > 0
                    ? `Resend code in ${countdownLabel}`
                    : "Resend code"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 text-xs text-slate-500 hover:text-slate-700"
                >
                  Use a different identifier
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
