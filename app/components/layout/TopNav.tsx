import { Menu } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { LayoutDashboard, LogOut, Moon, Sun } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useTheme } from '@/features/theme/ThemeContext'
import { LogoBadge } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface TopNavProps {
  onOpenMobile?: () => void
}

export function TopNav({ onOpenMobile }: TopNavProps) {
  const { user, isAuthenticated, logout } = useAuth()
  const { theme, toggle } = useTheme()

  const initials = user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() : ''

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center border-b border-border bg-card/90 px-4 backdrop-blur-xl">
      <div className="flex flex-1 items-center gap-4">
        {onOpenMobile && (
          <Button variant="ghost" size="icon" onClick={onOpenMobile} className="md:hidden" aria-label="Open menu">
            <Menu className="size-5" />
          </Button>
        )}
        <Link to="/" className="flex items-center gap-2">
          <LogoBadge className="h-8 w-8 shrink-0" />
          <span className="font-heading text-sm font-semibold text-foreground">FocusFlow</span>
        </Link>

        {isAuthenticated && (
          <nav className="hidden items-center gap-1 md:flex">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-accent/15 [&.active]:text-accent-foreground"
              activeProps={{ className: 'active' }}
            >
              <LayoutDashboard className="size-4" />
              Dashboard
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              className="size-9"
            >
              {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </Button>
          </nav>
        )}
      </div>

      {isAuthenticated && user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2">
              <Avatar size="sm">
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm text-foreground sm:inline">{user.firstName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  {user.firstName} {user.lastName}
                </span>
                <span className="text-xs text-muted-foreground">{user.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => logout()} className="cursor-pointer">
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link to="/login">Log In</Link>
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
            <Link to="/register">Get Started</Link>
          </Button>
        </div>
      )}
    </header>
  )
}
