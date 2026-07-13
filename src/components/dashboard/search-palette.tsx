"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import {
  Search,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface SearchItem {
  id: string
  label: string
  subtitle?: string
  icon: LucideIcon
  group: string
  keywords?: string
  onSelect: () => void
}

interface SearchPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: SearchItem[]
}

export function SearchPalette({ open, onOpenChange, items }: SearchPaletteProps) {
  // Group items by their `group` field, preserving first-seen order
  const groups = React.useMemo(() => {
    const map = new Map<string, SearchItem[]>()
    for (const item of items) {
      const arr = map.get(item.group) ?? []
      arr.push(item)
      map.set(item.group, arr)
    }
    return Array.from(map.entries())
  }, [items])

  // Only mount the interactive command primitive when open. This prevents the
  // auto-focused search input from stealing focus on every page load (the
  // palette is always rendered in the DOM for the fade/scale transition, but
  // the focusable input must only exist while open).
  return (
    <SearchPaletteInner
      open={open}
      onOpenChange={onOpenChange}
      groups={groups}
    />
  )
}

function SearchPaletteInner({
  open,
  onOpenChange,
  groups,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  groups: [string, SearchItem[]][]
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-start justify-center",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
    >
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={() => onOpenChange(false)}
      />

      {/* Command panel */}
      <div
        className={cn(
          "relative z-10 mt-[12vh] w-full max-w-xl px-4 transition-all duration-200",
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "-translate-y-4 scale-95 opacity-0"
        )}
      >
        {open && (
        <CommandPrimitive
          className={cn(
            "overflow-hidden rounded-2xl border bg-popover shadow-2xl",
            "ring-1 ring-border/50"
          )}
          label="Command Menu"
        >
          {/* Search input */}
          <div className="flex items-center gap-3 border-b px-4">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <CommandPrimitive.Input
              autoFocus
              placeholder="Search pages, actions, people…"
              className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <CommandPrimitive.List className="max-h-[420px] overflow-y-auto overscroll-contain p-2">
            <CommandPrimitive.Empty>
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Search className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No results found</p>
                <p className="text-xs text-muted-foreground">
                  Try a different search term
                </p>
              </div>
            </CommandPrimitive.Empty>

            {groups.map(([group, groupItems]) => (
              <CommandPrimitive.Group
                key={group}
                heading={group}
                className={cn(
                  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5",
                  "[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold",
                  "[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider",
                  "[&_[cmdk-group-heading]]:text-muted-foreground"
                )}
              >
                {groupItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <CommandPrimitive.Item
                      key={item.id}
                      value={`${item.label} ${item.subtitle ?? ""} ${item.keywords ?? ""}`}
                      onSelect={() => {
                        item.onSelect()
                        onOpenChange(false)
                      }}
                      className={cn(
                        "group relative flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm",
                        "outline-none data-[selected=true]:bg-emerald-50 data-[selected=true]:text-emerald-900",
                        "dark:data-[selected=true]:bg-emerald-500/10 dark:data-[selected=true]:text-emerald-100",
                        "transition-colors"
                      )}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors group-data-[selected=true]:border-emerald-200 group-data-[selected=true]:bg-emerald-100 group-data-[selected=true]:text-emerald-700 dark:group-data-[selected=true]:border-emerald-800 dark:group-data-[selected=true]:bg-emerald-900/40">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{item.label}</div>
                        {item.subtitle && (
                          <div className="truncate text-xs text-muted-foreground">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-data-[selected=true]:opacity-100" />
                    </CommandPrimitive.Item>
                  )
                })}
              </CommandPrimitive.Group>
            ))}
          </CommandPrimitive.List>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-background px-1 py-0.5 font-medium">
                  <ArrowUp className="inline h-2.5 w-2.5" />
                </kbd>
                <kbd className="rounded border bg-background px-1 py-0.5 font-medium">
                  <ArrowDown className="inline h-2.5 w-2.5" />
                </kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-background px-1 py-0.5 font-medium">
                  <CornerDownLeft className="inline h-2.5 w-2.5" />
                </kbd>
                select
              </span>
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">
              MediCare Hub
            </span>
          </div>
        </CommandPrimitive>
        )}
      </div>
    </div>
  )
}
