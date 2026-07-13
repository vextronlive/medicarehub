"use client"

import { validatePassword, passwordStrengthLabel } from "@/lib/password"
import { Check, X } from "lucide-react"

interface Props {
  password: string
}

export function PasswordStrength({ password }: Props) {
  const check = validatePassword(password)
  const { label, color } = passwordStrengthLabel(check.score)

  const rules = [
    { ok: password.length >= 8, label: "Min 8 characters" },
    { ok: (password.match(/[a-zA-Z]/g) || []).length >= 5, label: "Min 5 alphabets" },
    { ok: (password.match(/[0-9]/g) || []).length >= 2, label: "Min 2 numbers" },
    { ok: (password.match(/[^a-zA-Z0-9]/g) || []).length >= 1, label: "Min 1 special char" },
  ]

  return (
    <div className="space-y-2">
      {password && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Strength</span>
            <span className="font-medium">{label}</span>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  i < check.score ? color : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-1">
        {rules.map((r) => (
          <div
            key={r.label}
            className={`flex items-center gap-1 text-xs ${
              r.ok ? "text-emerald-600" : "text-muted-foreground"
            }`}
          >
            {r.ok ? (
              <Check className="h-3 w-3" />
            ) : (
              <X className="h-3 w-3" />
            )}
            {r.label}
          </div>
        ))}
      </div>
    </div>
  )
}
