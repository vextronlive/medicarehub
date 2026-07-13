"use client"

import { useAuthStore } from "@/lib/auth-store"
import { AuthScreen } from "@/components/auth/auth-screen"
import { ErrorBoundary } from "@/components/error-boundary"
import { PatientDashboard } from "@/components/dashboard/patient/patient-dashboard"
import { DoctorDashboard } from "@/components/dashboard/doctor/doctor-dashboard"
import { OrgDashboard } from "@/components/dashboard/org/org-dashboard"

export default function Home() {
  const user = useAuthStore((s) => s.user)

  if (!user) return <AuthScreen />

  return (
    <ErrorBoundary>
      {user.role === "PATIENT" ? (
        <PatientDashboard />
      ) : user.role === "DOCTOR" ? (
        <DoctorDashboard />
      ) : user.role === "ORGANIZATION" ? (
        <OrgDashboard />
      ) : (
        <AuthScreen />
      )}
    </ErrorBoundary>
  )
}
