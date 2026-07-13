import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a doctor's display name, ensuring the "Dr." prefix is not doubled
 * (e.g. a user who signed up as "Dr. Sarah Smith" should not become "Dr. Dr. Sarah Smith").
 */
export function doctorName(name: string): string {
  if (!name) return "Doctor"
  const trimmed = name.trim()
  if (/^dr\.?\s/i.test(trimmed)) return trimmed
  return `Dr. ${trimmed}`
}

/**
 * Format a person's first name (single token) for friendly greetings.
 */
export function firstName(name: string): string {
  if (!name) return "there"
  return name.trim().split(/\s+/)[0]
}

/**
 * Produce initials from a full name (max 2 chars).
 */
export function initials(name: string): string {
  if (!name) return "?"
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

/**
 * Mask a sensitive identifier, showing only the last `show` characters.
 */
export function maskId(value: string, show = 4): string {
  if (!value) return "—"
  if (value.length <= show) return "•".repeat(value.length)
  return "•".repeat(Math.min(value.length - show, 8)) + value.slice(-show)
}
