/**
 * Password validation utility.
 * Rules (as required by the product spec):
 *  - Minimum 8 characters total
 *  - At least 5 alphabetic characters
 *  - At least 2 numeric digits
 *  - At least 1 special character
 *  - Alphanumeric + special characters only
 */
export interface PasswordCheck {
  valid: boolean
  errors: string[]
  score: number // 0-4 strength score
}

export function validatePassword(password: string): PasswordCheck {
  const errors: string[] = []

  const letters = (password.match(/[a-zA-Z]/g) || []).length
  const numbers = (password.match(/[0-9]/g) || []).length
  const specials = (password.match(/[^a-zA-Z0-9]/g) || []).length

  if (password.length < 8) errors.push("At least 8 characters")
  if (letters < 5) errors.push("At least 5 alphabetic characters")
  if (numbers < 2) errors.push("At least 2 numbers")
  if (specials < 1) errors.push("At least 1 special character")

  // strength score
  let score = 0
  if (password.length >= 8) score++
  if (letters >= 5) score++
  if (numbers >= 2) score++
  if (specials >= 1) score++
  if (password.length >= 12 && letters >= 6 && numbers >= 3 && specials >= 2) score = 4

  return { valid: errors.length === 0, errors, score }
}

export function passwordStrengthLabel(score: number): {
  label: string
  color: string
} {
  switch (score) {
    case 0:
    case 1:
      return { label: "Weak", color: "bg-red-500" }
    case 2:
      return { label: "Fair", color: "bg-orange-500" }
    case 3:
      return { label: "Good", color: "bg-yellow-500" }
    case 4:
      return { label: "Strong", color: "bg-emerald-500" }
    default:
      return { label: "Weak", color: "bg-red-500" }
  }
}
