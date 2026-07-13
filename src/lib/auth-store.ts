"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type UserRole = "PATIENT" | "DOCTOR" | "ORGANIZATION"

export interface SessionUser {
  id: string
  email: string
  mobile: string
  role: UserRole
  name: string
  city?: string
  state?: string
  specialization?: string
  bloodGroup?: string
  biometricEnrolled?: boolean
  // MoM additions
  pincode?: string
  addressLine?: string
  landmark?: string
  upiId?: string
  gender?: string
  dateOfBirth?: string | null
  panVerified?: boolean
  aadhaarVerified?: boolean
  membershipVerified?: boolean
  abdmId?: string
  emergencyName?: string
  emergencyMobile?: string
  membershipNumber?: string
  bedCount?: number
  capacityPerHour?: number
  // MoM — Aadhaar & Driving License (doctors/hospitals)
  aadhaarNumber?: string
  drivingLicenseNumber?: string
}

interface AuthState {
  user: SessionUser | null
  token: string | null
  setUser: (user: SessionUser, token: string) => void
  logout: () => void
  updateUser: (patch: Partial<SessionUser>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setUser: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
      updateUser: (patch) =>
        set({ user: { ...(get().user as SessionUser), ...patch } }),
    }),
    { name: "health-auth" }
  )
)
