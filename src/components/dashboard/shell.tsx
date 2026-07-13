"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useAuthStore } from "@/lib/auth-store"
import { cn, initials as getInitials } from "@/lib/utils"
import { NotificationsBell } from "./notifications-bell"
import { ThemeToggle } from "./theme-toggle"
import { SearchPalette, type SearchItem } from "./search-palette"
import {
  HeartPulse,
  Stethoscope,
  Hospital,
  LogOut,
  Menu,
  Search,
} from "lucide-react"

export interface NavItem {
  id: string
  label: string
  icon: typeof HeartPulse
}

interface Props {
  navItems: NavItem[]
  activeTab: string
  onTabChange: (id: string) => void
  children: ReactNode
  searchItems?: SearchItem[]
}

interface SidebarProps {
  navItems: NavItem[]
  activeTab: string
  onTabChange: (id: string) => void
  onNavigate: () => void
  userName: string
  userEmail: string
  roleColor: string
  roleLabel: string
  initials: string
  onLogout: () => void
}

const ROLE_META = {
  PATIENT: { label: "Patient", icon: HeartPulse, color: "bg-rose-500" },
  DOCTOR: { label: "Doctor", icon: Stethoscope, color: "bg-emerald-500" },
  ORGANIZATION: { label: "Hospital", icon: Hospital, color: "bg-teal-500" },
} as const

export function DashboardShell({
  navItems,
  activeTab,
  onTabChange,
  children,
  searchItems = [],
}: Props) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  // Keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  if (!user) return null
  const meta = ROLE_META[user.role]
  const RoleIcon = meta.icon
  const userInitials = getInitials(user.name)

  const sidebarProps: SidebarProps = {
    navItems,
    activeTab,
    onTabChange,
    onNavigate: () => setMobileOpen(false),
    userName: user.name,
    userEmail: user.email,
    roleColor: meta.color,
    roleLabel: meta.label,
    initials: userInitials,
    onLogout: logout,
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-card lg:block">
        <Sidebar {...sidebarProps} />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar {...sidebarProps} />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md text-white shadow-sm",
                meta.color
              )}
            >
              <RoleIcon className="h-4 w-4" />
            </div>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {meta.label} Account
            </Badge>
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              className="hidden h-9 items-center gap-2 rounded-full px-3 text-sm text-muted-foreground md:inline-flex"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-[18px] w-[18px]" />
              <span className="hidden lg:inline">Search…</span>
              <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium lg:inline">
                ⌘K
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full md:hidden"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-[18px] w-[18px]" />
            </Button>
            <NotificationsBell />
            <ThemeToggle />
            <div className="ml-1 hidden items-center gap-2 border-l pl-3 sm:flex">
              <Avatar className="h-8 w-8 ring-2 ring-background">
                <AvatarFallback className={cn("text-xs text-white", meta.color)}>
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-[120px] truncate text-sm font-medium">
                {user.name.split(" ")[0]}
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>

      {/* Global Search Palette */}
      <SearchPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        items={searchItems}
      />
    </div>
  )
}

function Sidebar({
  navItems,
  activeTab,
  onTabChange,
  onNavigate,
  userName,
  userEmail,
  roleColor,
  roleLabel,
  initials,
  onLogout,
}: SidebarProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
          <HeartPulse className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold leading-tight">
            MediCare Hub
          </div>
          <div className="text-[10px] text-muted-foreground">
            Healthcare Platform
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Menu
        </p>
        {navItems.map((item) => {
          const Icon = item.icon
          const active = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id)
                onNavigate()
              }}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-emerald-50 text-emerald-700 shadow-sm dark:bg-emerald-500/10"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {/* Left accent bar for active item */}
              {active && (
                <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-emerald-500 to-teal-600" />
              )}
              <Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-transform duration-200",
                  active
                    ? "text-emerald-600 scale-110"
                    : "text-muted-foreground group-hover:text-foreground group-hover:scale-105"
                )}
              />
              <span className="truncate">{item.label}</span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              )}
            </button>
          )
        })}
      </nav>

      <div className="border-t p-3">
        <div className="flex items-center gap-3 rounded-lg p-2">
          <Avatar className="h-9 w-9 ring-2 ring-background">
            <AvatarFallback className={cn("text-xs text-white", roleColor)}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{userName}</div>
            <div className="flex items-center gap-1">
              <span className="truncate text-xs text-muted-foreground">
                {userEmail}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            title="Logout"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-rose-600"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
