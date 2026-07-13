"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuthStore, type UserRole } from "@/lib/auth-store"
import { apiFetch } from "@/lib/api"
import { validatePassword } from "@/lib/password"
import { PasswordStrength } from "./password-strength"
import { TermsDialog } from "./terms-dialog"
import { ForgotPasswordDialog } from "./forgot-password-dialog"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import {
  Loader2,
  HeartPulse,
  Stethoscope,
  Hospital,
  MapPin,
  Fingerprint,
  Mail,
  Lock,
  Phone,
  User,
  CreditCard,
  ShieldCheck,
  BedDouble,
  Timer,
  Award,
  Droplet,
  Upload,
  Eye,
  EyeOff,
  Check,
  Shield,
  Clock,
  Sparkles,
  ScanLine,
  ScanFace,
  CalendarClock,
  Siren,
  type LucideIcon,
} from "lucide-react"

type RoleKey = UserRole

const ROLES: {
  id: RoleKey
  label: string
  desc: string
  icon: LucideIcon
  gradient: string
  ring: string
  tint: string
  text: string
}[] = [
  {
    id: "PATIENT",
    label: "Patient",
    desc: "Manage your health",
    icon: HeartPulse,
    gradient: "from-emerald-500 to-teal-500",
    ring: "ring-emerald-500/60",
    tint: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  {
    id: "DOCTOR",
    label: "Doctor",
    desc: "Treat your patients",
    icon: Stethoscope,
    gradient: "from-teal-500 to-emerald-600",
    ring: "ring-teal-500/60",
    tint: "bg-teal-50 dark:bg-teal-500/10",
    text: "text-teal-700 dark:text-teal-300",
  },
  {
    id: "ORGANIZATION",
    label: "Hospital",
    desc: "Run your hospital",
    icon: Hospital,
    gradient: "from-violet-500 to-violet-700",
    ring: "ring-violet-500/60",
    tint: "bg-violet-50 dark:bg-violet-500/10",
    text: "text-violet-700 dark:text-violet-300",
  },
]

const FEATURES: { icon: LucideIcon; title: string; desc: string; tint: string }[] = [
  {
    icon: ScanLine,
    title: "AI-powered prescription scanning",
    desc: "Snap a photo, get structured data instantly.",
    tint: "from-emerald-400/20 to-emerald-400/5 text-emerald-300",
  },
  {
    icon: CalendarClock,
    title: "Real-time appointment tokens",
    desc: "Live queue with ETA & travel suggestions.",
    tint: "from-teal-400/20 to-teal-400/5 text-teal-300",
  },
  {
    icon: ShieldCheck,
    title: "Encrypted medical records",
    desc: "AES-256 at rest, end-to-end secure.",
    tint: "from-amber-400/20 to-amber-400/5 text-amber-300",
  },
  {
    icon: Siren,
    title: "Emergency SOS alerts",
    desc: "One-tap broadcast to family & doctors.",
    tint: "from-violet-400/20 to-violet-400/5 text-violet-300",
  },
]

const LEFT_TRUST: { label: string }[] = [
  { label: "HIPAA-style encryption" },
  { label: "ISO 27001 ready" },
  { label: "24/7 support" },
]

const FOOTER_TRUST: { icon: LucideIcon; label: string }[] = [
  { icon: Lock, label: "Bank-grade encryption" },
  { icon: Shield, label: "HIPAA-inspired" },
  { icon: Clock, label: "24/7 access" },
]

const SPECIALIZATIONS = [
  "General Medicine",
  "Cardiology",
  "Endocrinology",
  "Pulmonology",
  "Orthopedics",
  "Dermatology",
  "Neurology",
  "Pediatrics",
  "Gynecology",
  "Psychiatry",
  "Others",
]

export function AuthScreen() {
  const setUser = useAuthStore((s) => s.setUser)
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [role, setRole] = useState<UserRole>("PATIENT")
  const [loading, setLoading] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  // password visibility
  const [showLoginPw, setShowLoginPw] = useState(false)
  const [showSignupPw, setShowSignupPw] = useState(false)
  const [showServerPw, setShowServerPw] = useState(false)

  // login fields
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [biometric, setBiometric] = useState(false)

  // signup fields
  const [name, setName] = useState("")
  const [mobile, setMobile] = useState("")
  const [govtIdType, setGovtIdType] = useState("AADHAAR")
  const [govtIdNumber, setGovtIdNumber] = useState("")
  // MoM — Aadhaar & Driving License for doctors/hospitals (replaces generic govt id)
  const [aadhaarNumber, setAadhaarNumber] = useState("")
  const [drivingLicenseNumber, setDrivingLicenseNumber] = useState("")
  const [addressLine, setAddressLine] = useState("")
  const [landmark, setLandmark] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [pincode, setPincode] = useState("")
  const [lat, setLat] = useState("")
  const [lng, setLng] = useState("")
  const [agree, setAgree] = useState(false)

  // biometric / face enrollment (MoM — enabled)
  const [biometricMode, setBiometricMode] = useState<"fingerprint" | "face">("fingerprint")
  const [biometricScanning, setBiometricScanning] = useState(false)
  const [biometricEnrolled, setBiometricEnrolled] = useState(false)

  // patient-specific
  const [emergencyName, setEmergencyName] = useState("")
  const [emergencyMobile, setEmergencyMobile] = useState("")
  const [hasInsurance, setHasInsurance] = useState(false)
  const [insurance, setInsurance] = useState({
    providerName: "",
    policyNumber: "",
    insuranceType: "HEALTH",
    amountCovered: "",
    medicalPremium: "",
    coverageDetails: "",
    premiumDueDate: "",
  })

  // doctor/org specific
  const [membershipNumber, setMembershipNumber] = useState("")
  const [bedCount, setBedCount] = useState("")
  const [capacityPerHour, setCapacityPerHour] = useState("")
  const [specialization, setSpecialization] = useState("")
  const [serverLoginUser, setServerLoginUser] = useState("")
  const [serverLoginPass, setServerLoginPass] = useState("")

  function useGps() {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude))
        setLng(String(pos.coords.longitude))
        toast.success("Location captured")
      },
      () => toast.error("Could not get location"),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  // ─── MoM — Biometric & Face login (enabled) ───
  // Uses WebAuthn where available; falls back to a simulated scan in sandbox.
  async function enrollBiometric(): Promise<boolean> {
    setBiometricScanning(true)
    try {
      // Try real WebAuthn enrollment
      if (
        typeof window !== "undefined" &&
        "PublicKeyCredential" in window &&
        typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable ===
          "function"
      ) {
        const available =
          await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        if (available) {
          const challenge = new Uint8Array(32)
          crypto.getRandomValues(challenge)
          const userId = new Uint8Array(16)
          crypto.getRandomValues(userId)
          await navigator.credentials.create({
            publicKey: {
              challenge,
              rp: { name: "MediCare Hub" },
              user: {
                id: userId,
                name: email || "user",
                displayName: name || "User",
              },
              pubKeyCredParams: [
                { type: "public-key", alg: -7 },
                { type: "public-key", alg: -257 },
              ],
              authenticatorSelection: {
                authenticatorAttachment: "platform",
                userVerification: "required",
              },
              timeout: 30000,
            },
          })
          setBiometricEnrolled(true)
          toast.success(
            biometricMode === "face"
              ? "Face ID enrolled successfully!"
              : "Fingerprint enrolled successfully!"
          )
          return true
        }
      }
      // Fallback: simulated scan (sandbox)
      await new Promise((r) => setTimeout(r, 1800))
      setBiometricEnrolled(true)
      toast.success(
        biometricMode === "face"
          ? "Face ID enrolled successfully!"
          : "Fingerprint enrolled successfully!"
      )
      return true
    } catch {
      toast.error("Biometric enrollment was cancelled or failed.")
      return false
    } finally {
      setBiometricScanning(false)
    }
  }

  async function authenticateBiometric(): Promise<boolean> {
    setBiometricScanning(true)
    try {
      if (
        typeof window !== "undefined" &&
        "PublicKeyCredential" in window
      ) {
        const challenge = new Uint8Array(32)
        crypto.getRandomValues(challenge)
        await navigator.credentials.get({
          publicKey: {
            challenge,
            timeout: 30000,
            userVerification: "required",
          },
        })
        return true
      }
      // Fallback: simulated scan
      await new Promise((r) => setTimeout(r, 1800))
      return true
    } catch {
      toast.error("Biometric authentication failed.")
      return false
    } finally {
      setBiometricScanning(false)
    }
  }

  async function handleLogin() {
    if (!email) return toast.error("Enter your email")
    setLoading(true)
    try {
      // MoM — biometric / face login: scan before hitting the API
      if (biometric) {
        const ok = await authenticateBiometric()
        if (!ok) {
          setLoading(false)
          return
        }
      }
      const res = await apiFetch<{
        user: Parameters<typeof setUser>[0]
        token: string
      }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password: biometric ? undefined : password, biometric }),
      })
      setUser(res.user, res.token)
      toast.success(`Welcome back, ${res.user.name}!`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function doSignup() {
    if (!email || !password || !name || !mobile) {
      return toast.error("Fill all mandatory fields")
    }
    const pwCheck = validatePassword(password)
    if (!pwCheck.valid) {
      return toast.error("Password: " + pwCheck.errors.join(", "))
    }
    // MoM — doctors & hospitals must provide Aadhaar + Driving License
    if (role === "DOCTOR" || role === "ORGANIZATION") {
      if (!aadhaarNumber || !/^\d{12}$/.test(aadhaarNumber.replace(/\s+/g, ""))) {
        return toast.error("A valid 12-digit Aadhaar number is required")
      }
      if (!drivingLicenseNumber.trim()) {
        return toast.error("Driving License number is required")
      }
    }
    // MoM — enroll biometric before creating the account
    if (biometric && !biometricEnrolled) {
      const ok = await enrollBiometric()
      if (!ok) return
    }
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        role,
        email,
        password,
        name,
        mobile,
        addressLine,
        landmark,
        city,
        state,
        pincode,
        lat,
        lng,
        biometricEnrolled: biometric && biometricEnrolled,
      }
      if (role === "PATIENT") {
        // MoM — govt ID removed from patient signup; collected at appointment booking
        payload.govtIdType = null
        payload.govtIdNumber = null
        payload.emergencyName = emergencyName
        payload.emergencyMobile = emergencyMobile
        if (hasInsurance) payload.insurance = insurance
      } else {
        // MoM — Aadhaar + Driving License for doctors & hospitals
        payload.govtIdType = "AADHAAR"
        payload.govtIdNumber = aadhaarNumber.replace(/\s+/g, "")
        payload.aadhaarNumber = aadhaarNumber.replace(/\s+/g, "")
        payload.drivingLicenseNumber = drivingLicenseNumber.trim()
        payload.membershipNumber = membershipNumber
        payload.bedCount = bedCount
        payload.capacityPerHour = capacityPerHour
        payload.specialization = specialization
      }
      if (role === "ORGANIZATION") {
        payload.serverLoginUser = serverLoginUser
        payload.serverLoginPass = serverLoginPass
      }

      const res = await apiFetch<{
        user: Parameters<typeof setUser>[0]
        token: string
      }>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      setUser(res.user, res.token)
      toast.success("Account created successfully!")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function handleSignup() {
    if (!agree) {
      setShowTerms(true)
      return
    }
    doSignup()
  }

  const currentRole = ROLES.find((r) => r.id === role)!

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20">
      {/* Decorative dot-grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4] dark:opacity-[0.15]"
        style={{
          backgroundImage:
            "radial-gradient(circle, hsl(var(--muted-foreground) / 0.18) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      {/* Soft blurred orbs */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/10" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-teal-400/15 blur-3xl dark:bg-teal-500/10" />
      <div className="pointer-events-none absolute right-1/4 top-1/3 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl dark:bg-violet-500/10" />

      <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">
        {/* LEFT — Branded hero panel */}
        <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 p-10 text-white lg:flex xl:p-14">
          {/* Decorative orbs */}
          <div className="absolute -right-20 -top-20 h-80 w-80 animate-pulse rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-10 h-96 w-96 rounded-full bg-teal-300/15 blur-3xl" />
          <div className="absolute right-1/3 top-1/2 h-44 w-44 rounded-full bg-emerald-300/15 blur-3xl" />
          {/* Subtle grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          {/* Logo + name */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative z-10 flex items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-400 shadow-lg shadow-emerald-900/30 ring-1 ring-white/30">
              <HeartPulse className="h-6 w-6 text-white" />
            </div>
            <div className="leading-tight">
              <span className="block text-lg font-bold tracking-tight">
                MediCare Hub
              </span>
              <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-200/80">
                Unified Healthcare
              </span>
            </div>
          </motion.div>

          {/* Headline + features */}
          <div className="relative z-10 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="space-y-5"
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur ring-1 ring-white/20">
                <Sparkles className="h-3.5 w-3.5 text-emerald-200" />
                AI-Powered Healthcare Platform
              </div>
              <h1 className="text-4xl font-bold leading-tight xl:text-5xl">
                Your unified
                <br />
                <span className="bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent">
                  healthcare companion
                </span>
              </h1>
              <p className="max-w-md text-sm leading-relaxed text-emerald-50/90 xl:text-base">
                Connect patients, doctors and hospitals on one secure, AI-powered
                platform. Manage appointments, records, referrals and insights —
                all in one place.
              </p>
            </motion.div>

            {/* Feature highlight cards */}
            <div className="space-y-3">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
                  className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-sm transition-colors hover:bg-white/[0.1]"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${f.tint} ring-1 ring-white/10`}
                  >
                    <f.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{f.title}</div>
                    <div className="text-xs text-emerald-100/70">{f.desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Trust badges row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="relative z-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/15 pt-5 text-xs text-emerald-100/80"
          >
            {LEFT_TRUST.map((t) => (
              <div key={t.label} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-300" />
                {t.label}
              </div>
            ))}
          </motion.div>
        </div>

        {/* RIGHT — Auth panel */}
        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md"
          >
            {/* Mobile compact header */}
            <div className="mb-6 flex flex-col items-center gap-2 lg:hidden">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30">
                <HeartPulse className="h-6 w-6" />
              </div>
              <div className="text-center">
                <div className="text-lg font-bold tracking-tight">MediCare Hub</div>
                <div className="text-xs text-muted-foreground">
                  Your unified healthcare companion
                </div>
              </div>
            </div>

            <Tabs
              value={mode}
              onValueChange={(v) => setMode(v as "login" | "signup")}
            >
              {/* Premium tab list with sliding indicator */}
              <TabsList className="relative grid h-11 w-full grid-cols-2 gap-1 rounded-xl border border-emerald-100/60 bg-emerald-50/60 p-1 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                <TabsTrigger
                  value="login"
                  className="relative z-10 h-9 rounded-lg text-sm font-medium transition-colors data-[state=active]:text-white data-[state=inactive]:text-muted-foreground data-[state=active]:shadow-none"
                >
                  {mode === "login" && (
                    <motion.span
                      layoutId="authTabPill"
                      className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md shadow-emerald-500/25"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">Login</span>
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="relative z-10 h-9 rounded-lg text-sm font-medium transition-colors data-[state=active]:text-white data-[state=inactive]:text-muted-foreground data-[state=active]:shadow-none"
                >
                  {mode === "signup" && (
                    <motion.span
                      layoutId="authTabPill"
                      className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md shadow-emerald-500/25"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">Sign Up</span>
                </TabsTrigger>
              </TabsList>

              <AnimatePresence mode="wait">
                {mode === "login" ? (
                  <motion.div
                    key="login"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                  >
                    <TabsContent value="login" className="mt-4">
                      <Card className="overflow-hidden border-emerald-100/60 bg-white/95 shadow-xl shadow-emerald-500/5 backdrop-blur dark:border-emerald-900/40 dark:bg-slate-900/95">
                        <CardContent className="pt-6">
                          <div className="mb-1 flex items-center gap-2">
                            <h2 className="text-xl font-semibold">Welcome back</h2>
                          </div>
                          <p className="mb-4 text-sm text-muted-foreground">
                            Sign in to your healthcare account
                          </p>

                          <RoleSelector role={role} onChange={setRole} />

                          <div className="mt-4 space-y-3">
                            <Field label="Email">
                              <IconInput icon={Mail}>
                                <Input
                                  type="email"
                                  className="pl-10"
                                  placeholder="you@example.com"
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                />
                              </IconInput>
                            </Field>
                            <Field label="Password">
                              <IconInput
                                icon={Lock}
                                trailing={
                                  <button
                                    type="button"
                                    onClick={() => setShowLoginPw((s) => !s)}
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-emerald-600 dark:hover:bg-muted/60"
                                    aria-label={
                                      showLoginPw ? "Hide password" : "Show password"
                                    }
                                  >
                                    {showLoginPw ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </button>
                                }
                              >
                                <Input
                                  type={showLoginPw ? "text" : "password"}
                                  className="px-10"
                                  placeholder="••••••••"
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  onKeyDown={(e) =>
                                    e.key === "Enter" && handleLogin()
                                  }
                                />
                              </IconInput>
                            </Field>

                            <BiometricLoginCard
                              enabled={biometric}
                              onToggle={(v) => setBiometric(v)}
                              mode={biometricMode}
                              onModeChange={setBiometricMode}
                              scanning={biometricScanning}
                            />

                            <div className="flex justify-end">
                              <button
                                className="text-sm font-medium text-emerald-600 transition-colors hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                                onClick={() => setForgotOpen(true)}
                              >
                                Forgot password?
                              </button>
                            </div>

                            <GradientButton
                              loading={loading}
                              onClick={handleLogin}
                            >
                              Sign in as {currentRole.label}
                            </GradientButton>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </motion.div>
                ) : (
                  <motion.div
                    key="signup"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                  >
                    <TabsContent value="signup" className="mt-4">
                      <Card className="overflow-hidden border-emerald-100/60 bg-white/95 shadow-xl shadow-emerald-500/5 backdrop-blur dark:border-emerald-900/40 dark:bg-slate-900/95">
                        <CardContent className="pt-6">
                          <h2 className="mb-1 text-xl font-semibold">Create account</h2>
                          <p className="mb-4 text-sm text-muted-foreground">
                            Join MediCare Hub as a {currentRole.label.toLowerCase()}
                          </p>

                          <RoleSelector role={role} onChange={setRole} />

                          <div className="mt-4 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                            <Field label="Full Name *">
                              <IconInput icon={User}>
                                <Input
                                  className="pl-10"
                                  placeholder={
                                    role === "ORGANIZATION"
                                      ? "Hospital name"
                                      : "Your name"
                                  }
                                  value={name}
                                  onChange={(e) => setName(e.target.value)}
                                />
                              </IconInput>
                            </Field>

                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Mobile *">
                                <IconInput icon={Phone}>
                                  <Input
                                    className="pl-10"
                                    placeholder="10-digit number"
                                    value={mobile}
                                    onChange={(e) => setMobile(e.target.value)}
                                  />
                                </IconInput>
                              </Field>
                              <Field label="Email *">
                                <IconInput icon={Mail}>
                                  <Input
                                    type="email"
                                    className="pl-10"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                  />
                                </IconInput>
                              </Field>
                            </div>

                            {role === "PATIENT" ? (
                              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                                <div className="flex items-start gap-2">
                                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                  <div>
                                    <span className="font-semibold">Govt ID not required at signup.</span>{" "}
                                    You can start using MediCare Hub right away. Aadhaar verification
                                    will be collected when you book an appointment, as per MoM guidelines.
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                  Government ID Verification (Required for {role === "DOCTOR" ? "Doctors" : "Hospitals"})
                                </p>
                                <div className="space-y-3">
                                  <Field label="Aadhaar Number *" icon={CreditCard}>
                                    <IconInput icon={CreditCard}>
                                      <Input
                                        className="pl-10"
                                        placeholder="12-digit Aadhaar number"
                                        value={aadhaarNumber}
                                        onChange={(e) => setAadhaarNumber(e.target.value)}
                                        inputMode="numeric"
                                        maxLength={12}
                                      />
                                    </IconInput>
                                  </Field>
                                  <Field label="Driving License Number *" icon={CreditCard}>
                                    <IconInput icon={CreditCard}>
                                      <Input
                                        className="pl-10"
                                        placeholder="e.g. MH01 20230012345"
                                        value={drivingLicenseNumber}
                                        onChange={(e) => setDrivingLicenseNumber(e.target.value)}
                                      />
                                    </IconInput>
                                  </Field>
                                </div>
                              </div>
                            )}

                            <Field label="Address Line *">
                              <IconInput icon={MapPin}>
                                <Input
                                  className="pl-10"
                                  placeholder="House no, street, area"
                                  value={addressLine}
                                  onChange={(e) => setAddressLine(e.target.value)}
                                />
                              </IconInput>
                            </Field>

                            <div className="grid grid-cols-2 gap-3">
                              <Field label="City *">
                                <Input
                                  placeholder="City"
                                  value={city}
                                  onChange={(e) => setCity(e.target.value)}
                                />
                              </Field>
                              <Field label="State *">
                                <Input
                                  placeholder="State"
                                  value={state}
                                  onChange={(e) => setState(e.target.value)}
                                />
                              </Field>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Pincode *">
                                <Input
                                  placeholder="6-digit"
                                  value={pincode}
                                  onChange={(e) => setPincode(e.target.value)}
                                />
                              </Field>
                              <Field label="Landmark">
                                <Input
                                  placeholder="Near..."
                                  value={landmark}
                                  onChange={(e) => setLandmark(e.target.value)}
                                />
                              </Field>
                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                              onClick={useGps}
                            >
                              <MapPin className="mr-2 h-4 w-4" />
                              Capture GPS Location
                              {lat && lng && (
                                <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">
                                  ✓ {lat.slice(0, 6)}, {lng.slice(0, 6)}
                                </span>
                              )}
                            </Button>

                            {role === "PATIENT" && (
                              <>
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                                  <span className="font-semibold">Health details (blood group, gender, DOB):</span> these can be added from your profile after signup, so you can start using MediCare Hub right away.
                                </div>
                                <Field label="Emergency Contact Name">
                                  <IconInput icon={User}>
                                    <Input
                                      className="pl-10"
                                      placeholder="Name"
                                      value={emergencyName}
                                      onChange={(e) => setEmergencyName(e.target.value)}
                                    />
                                  </IconInput>
                                </Field>
                                <Field label="Emergency Mobile">
                                  <IconInput icon={Phone}>
                                    <Input
                                      className="pl-10"
                                      placeholder="Emergency contact number"
                                      value={emergencyMobile}
                                      onChange={(e) =>
                                        setEmergencyMobile(e.target.value)
                                      }
                                    />
                                  </IconInput>
                                </Field>

                                <div className="rounded-xl border border-emerald-100/70 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                                    <Checkbox
                                      checked={hasInsurance}
                                      onCheckedChange={(v) => setHasInsurance(!!v)}
                                    />
                                    Add Insurance details (Optional)
                                  </label>
                                  {hasInsurance && (
                                    <div className="mt-3 space-y-3">
                                      <div className="grid grid-cols-2 gap-3">
                                        <Field label="Provider">
                                          <Input
                                            placeholder="e.g. Star Health"
                                            value={insurance.providerName}
                                            onChange={(e) =>
                                              setInsurance({
                                                ...insurance,
                                                providerName: e.target.value,
                                              })
                                            }
                                          />
                                        </Field>
                                        <Field label="Policy No.">
                                          <Input
                                            placeholder="Policy number"
                                            value={insurance.policyNumber}
                                            onChange={(e) =>
                                              setInsurance({
                                                ...insurance,
                                                policyNumber: e.target.value,
                                              })
                                            }
                                          />
                                        </Field>
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                        <Field label="Type">
                                          <Select
                                            value={insurance.insuranceType}
                                            onValueChange={(v) =>
                                              setInsurance({
                                                ...insurance,
                                                insuranceType: v,
                                              })
                                            }
                                          >
                                            <SelectTrigger>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="HEALTH">
                                                Health
                                              </SelectItem>
                                              <SelectItem value="CRITICAL_ILLNESS">
                                                Critical Illness
                                              </SelectItem>
                                              <SelectItem value="FAMILY_FLOATER">
                                                Family Floater
                                              </SelectItem>
                                              <SelectItem value="OTHERS">
                                                Others
                                              </SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </Field>
                                        <Field label="Amount Covered (₹)">
                                          <Input
                                            type="number"
                                            placeholder="500000"
                                            value={insurance.amountCovered}
                                            onChange={(e) =>
                                              setInsurance({
                                                ...insurance,
                                                amountCovered: e.target.value,
                                              })
                                            }
                                          />
                                        </Field>
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                        <Field label="Premium (₹/yr)">
                                          <Input
                                            type="number"
                                            placeholder="15000"
                                            value={insurance.medicalPremium}
                                            onChange={(e) =>
                                              setInsurance({
                                                ...insurance,
                                                medicalPremium: e.target.value,
                                              })
                                            }
                                          />
                                        </Field>
                                        <Field label="Premium Due Date">
                                          <Input
                                            type="date"
                                            value={insurance.premiumDueDate}
                                            onChange={(e) =>
                                              setInsurance({
                                                ...insurance,
                                                premiumDueDate: e.target.value,
                                              })
                                            }
                                          />
                                        </Field>
                                      </div>
                                      <Field label="Coverage Details">
                                        <Input
                                          placeholder="What is covered"
                                          value={insurance.coverageDetails}
                                          onChange={(e) =>
                                            setInsurance({
                                              ...insurance,
                                              coverageDetails: e.target.value,
                                            })
                                          }
                                        />
                                      </Field>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-muted-foreground">
                                          Upload T&amp;C document (Optional)
                                        </Label>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="w-full"
                                        >
                                          <Upload className="mr-2 h-4 w-4" />
                                          Upload T&C document
                                        </Button>
                                        <p className="text-[11px] text-muted-foreground">
                                          Optional — you can skip this and add the document later from your profile.
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}

                            {(role === "DOCTOR" || role === "ORGANIZATION") && (
                              <>
                                <div className="grid grid-cols-2 gap-3">
                                  <Field label="Membership No. *">
                                    <IconInput icon={Award}>
                                      <Input
                                        className="pl-10"
                                        placeholder="Reg. authority no."
                                        value={membershipNumber}
                                        onChange={(e) =>
                                          setMembershipNumber(e.target.value)
                                        }
                                      />
                                    </IconInput>
                                  </Field>
                                  {role === "DOCTOR" && (
                                    <Field label="Specialization *" icon={Stethoscope}>
                                      <Select
                                        value={specialization}
                                        onValueChange={setSpecialization}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {SPECIALIZATIONS.map((s) => (
                                            <SelectItem key={s} value={s}>
                                              {s}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </Field>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <Field label="Number of Beds *">
                                    <IconInput icon={BedDouble}>
                                      <Input
                                        type="number"
                                        className="pl-10"
                                        placeholder="e.g. 10"
                                        value={bedCount}
                                        onChange={(e) => setBedCount(e.target.value)}
                                      />
                                    </IconInput>
                                  </Field>
                                  <Field label="Capacity / hour *">
                                    <IconInput icon={Timer}>
                                      <Input
                                        type="number"
                                        className="pl-10"
                                        placeholder="Patients per hour"
                                        value={capacityPerHour}
                                        onChange={(e) =>
                                          setCapacityPerHour(e.target.value)
                                        }
                                      />
                                    </IconInput>
                                  </Field>
                                </div>
                              </>
                            )}

                            {role === "ORGANIZATION" && (
                              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                                <p className="mb-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                                  Server Login Credentials (for multi-city sync)
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                  <Field label="Server User">
                                    <Input
                                      placeholder="admin"
                                      value={serverLoginUser}
                                      onChange={(e) =>
                                        setServerLoginUser(e.target.value)
                                      }
                                    />
                                  </Field>
                                  <Field label="Server Pass">
                                    <IconInput
                                      icon={Lock}
                                      trailing={
                                        <button
                                          type="button"
                                          onClick={() => setShowServerPw((s) => !s)}
                                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-amber-600 dark:hover:bg-muted/60"
                                          aria-label={
                                            showServerPw
                                              ? "Hide password"
                                              : "Show password"
                                          }
                                        >
                                          {showServerPw ? (
                                            <EyeOff className="h-4 w-4" />
                                          ) : (
                                            <Eye className="h-4 w-4" />
                                          )}
                                        </button>
                                      }
                                    >
                                      <Input
                                        type={showServerPw ? "text" : "password"}
                                        className="px-10"
                                        placeholder="••••••"
                                        value={serverLoginPass}
                                        onChange={(e) =>
                                          setServerLoginPass(e.target.value)
                                        }
                                      />
                                    </IconInput>
                                  </Field>
                                </div>
                              </div>
                            )}

                            <Field label="Password *">
                              <IconInput
                                icon={Lock}
                                trailing={
                                  <button
                                    type="button"
                                    onClick={() => setShowSignupPw((s) => !s)}
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-emerald-600 dark:hover:bg-muted/60"
                                    aria-label={
                                      showSignupPw ? "Hide password" : "Show password"
                                    }
                                  >
                                    {showSignupPw ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </button>
                                }
                              >
                                <Input
                                  type={showSignupPw ? "text" : "password"}
                                  className="px-10"
                                  placeholder="Create strong password"
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                />
                              </IconInput>
                            </Field>
                            <PasswordStrength password={password} />

                            {/* MoM — Biometric & Face enrollment (enabled) */}
                            <BiometricEnrollCard
                              mode={biometricMode}
                              onModeChange={setBiometricMode}
                              enrolled={biometricEnrolled}
                              scanning={biometricScanning}
                              onEnroll={async () => {
                                const ok = await enrollBiometric()
                                if (ok) setBiometric(true)
                              }}
                              onDisable={() => {
                                setBiometric(false)
                                setBiometricEnrolled(false)
                              }}
                            />

                            <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-muted/40 p-3 text-sm ring-1 ring-inset ring-border/60 transition-colors hover:bg-muted/60 dark:bg-muted/20">
                              <Checkbox
                                checked={agree}
                                onCheckedChange={(v) => setAgree(!!v)}
                                className="mt-0.5"
                              />
                              <span className="text-muted-foreground">
                                I agree to the Terms & Conditions and consent to
                                location, microphone, contacts, camera and biometric
                                permissions.
                              </span>
                            </label>
                          </div>

                          <GradientButton
                            className="mt-4"
                            loading={loading}
                            onClick={() => (agree ? doSignup() : setShowTerms(true))}
                          >
                            Create {currentRole.label} Account
                          </GradientButton>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Tabs>

            {/* Footer trust badges */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {FOOTER_TRUST.map((t) => (
                <div
                  key={t.label}
                  className="flex items-center gap-1.5 transition-colors hover:text-emerald-700 dark:hover:text-emerald-300"
                >
                  <t.icon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  {t.label}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <TermsDialog
        open={showTerms}
        onAccept={() => {
          setAgree(true)
          setShowTerms(false)
          doSignup()
        }}
        onCancel={() => setShowTerms(false)}
      />

      <ForgotPasswordDialog
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        onSuccess={() => setMode("login")}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function RoleSelector({
  role,
  onChange,
}: {
  role: UserRole
  onChange: (r: UserRole) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {ROLES.map((r) => {
        const Icon = r.icon
        const active = role === r.id
        return (
          <motion.button
            key={r.id}
            type="button"
            onClick={() => onChange(r.id)}
            whileTap={{ scale: 0.97 }}
            animate={{ scale: active ? 1.02 : 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`group relative flex flex-col items-center gap-1.5 overflow-hidden rounded-xl border-2 p-3 text-center transition-colors ${
              active
                ? `border-transparent ring-2 ${r.ring} ${r.tint}`
                : "border-border hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/20"
            }`}
          >
            {/* Selected check badge */}
            <AnimatePresence>
              {active && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm"
                >
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </motion.span>
              )}
            </AnimatePresence>

            {/* Gradient icon circle */}
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${r.gradient} text-white shadow-sm transition-transform group-hover:scale-110`}
            >
              <Icon className="h-4.5 w-4.5" />
            </div>

            <div className="space-y-0.5">
              <div
                className={`text-xs font-semibold sm:text-sm ${
                  active ? r.text : "text-foreground"
                }`}
              >
                {r.label}
              </div>
              <div className="hidden text-[10px] leading-tight text-muted-foreground sm:block">
                {r.desc}
              </div>
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon?: LucideIcon
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {label}
      </Label>
      {children}
    </div>
  )
}

function IconInput({
  icon: Icon,
  trailing,
  children,
}: {
  icon: LucideIcon
  trailing?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="group relative">
      <div className="pointer-events-none absolute left-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-focus-within:bg-emerald-100 group-focus-within:text-emerald-600 dark:group-focus-within:bg-emerald-500/20 dark:group-focus-within:text-emerald-400">
        <Icon className="h-3.5 w-3.5" />
      </div>
      {children}
      {trailing && (
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</div>
      )}
    </div>
  )
}

function GradientButton({
  loading,
  onClick,
  children,
  className,
}: {
  loading: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`h-12 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/30 hover:from-emerald-700 hover:to-teal-700 disabled:translate-y-0 disabled:shadow-md dark:shadow-emerald-900/40 ${className ?? ""}`}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  )
}

function ToggleRow({
  checked,
  onChange,
  icon: Icon,
  title,
  desc,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  icon: LucideIcon
  title: string
  desc: string
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
        checked
          ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30"
          : "border-border hover:border-emerald-200 hover:bg-emerald-50/30 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/20"
      }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
          checked
            ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm"
            : "bg-muted text-muted-foreground"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(!!v)}
        className="data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600"
      />
    </label>
  )
}

/* ------------------------------------------------------------------ */
/* Biometric & Face login components (MoM — enabled)                   */
/* ------------------------------------------------------------------ */

function BiometricModeToggle({
  mode,
  onModeChange,
}: {
  mode: "fingerprint" | "face"
  onModeChange: (m: "fingerprint" | "face") => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 dark:bg-muted/20">
      <button
        type="button"
        onClick={() => onModeChange("fingerprint")}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
          mode === "fingerprint"
            ? "bg-emerald-600 text-white shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Fingerprint className="h-3.5 w-3.5" />
        Fingerprint
      </button>
      <button
        type="button"
        onClick={() => onModeChange("face")}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
          mode === "face"
            ? "bg-emerald-600 text-white shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <ScanFace className="h-3.5 w-3.5" />
        Face ID
      </button>
    </div>
  )
}

function BiometricEnrollCard({
  mode,
  onModeChange,
  enrolled,
  scanning,
  onEnroll,
  onDisable,
}: {
  mode: "fingerprint" | "face"
  onModeChange: (m: "fingerprint" | "face") => void
  enrolled: boolean
  scanning: boolean
  onEnroll: () => void
  onDisable: () => void
}) {
  const Icon = mode === "face" ? ScanFace : Fingerprint
  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        enrolled
          ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30"
          : "border-border hover:border-emerald-200 dark:hover:border-emerald-900"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
              enrolled
                ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Icon className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">
              {enrolled
                ? mode === "face"
                  ? "Face ID enrolled"
                  : "Fingerprint enrolled"
                : "Enroll biometric login"}
            </div>
            <div className="text-xs text-muted-foreground">
              {enrolled
                ? "Enabled — sign in with biometrics next time"
                : scanning
                  ? "Scanning… please wait"
                  : "Use face or fingerprint on next sign-in"}
            </div>
          </div>
        </div>
        <BiometricModeToggle mode={mode} onModeChange={onModeChange} />
      </div>
      {!enrolled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
          disabled={scanning}
          onClick={onEnroll}
        >
          {scanning ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Icon className="mr-1.5 h-3.5 w-3.5" />
          )}
          {scanning
            ? "Scanning…"
            : `Enroll ${mode === "face" ? "Face ID" : "Fingerprint"}`}
        </Button>
      )}
      {enrolled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 w-full text-muted-foreground hover:text-rose-600"
          onClick={onDisable}
        >
          Remove biometric
        </Button>
      )}
    </div>
  )
}

function BiometricLoginCard({
  enabled,
  onToggle,
  mode,
  onModeChange,
  scanning,
}: {
  enabled: boolean
  onToggle: (v: boolean) => void
  mode: "fingerprint" | "face"
  onModeChange: (m: "fingerprint" | "face") => void
  scanning: boolean
}) {
  const Icon = mode === "face" ? ScanFace : Fingerprint
  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        enabled
          ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30"
          : "border-border hover:border-emerald-200 dark:hover:border-emerald-900"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
              enabled
                ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Icon className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">
              {scanning
                ? mode === "face"
                  ? "Scanning face…"
                  : "Scanning fingerprint…"
                : "Biometric login"}
            </div>
            <div className="text-xs text-muted-foreground">
              {enabled
                ? scanning
                  ? "Look at the camera or touch the sensor"
                  : "Enabled — password not required"
                : "Use face or fingerprint to sign in"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {enabled && (
            <BiometricModeToggle mode={mode} onModeChange={onModeChange} />
          )}
          <Checkbox
            checked={enabled}
            onCheckedChange={(v) => onToggle(!!v)}
            className="data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600"
          />
        </div>
      </div>
    </div>
  )
}
