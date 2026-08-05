import { Link } from '@tanstack/react-router'
import { Flame } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useProgress } from '@/features/progress/hooks/useProgress'
import { getNavLinks } from '@/components/nav/nav-config'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const { isAuthenticated, user } = useAuth()
  const { data: progress } = useProgress()
  const links = getNavLinks(user?.role === 'admin' ? 'admin' : user?.role === 'teacher' ? 'teacher' : 'student')

  return (
    <aside className="fixed top-14 left-0 z-40 hidden h-[calc(100vh-3.5rem)] w-60 flex-col border-r border-border bg-card p-3 md:flex">
      <nav className="flex flex-1 flex-col gap-1">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={cn(
              'flex items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
              '[&.active]:border-accent/20 [&.active]:bg-accent/15 [&.active]:text-accent-foreground',
            )}
            activeProps={{ className: 'active' }}
          >
            <link.icon className="size-4" />
            {link.label}
          </Link>
        ))}
      </nav>

      {isAuthenticated && user?.role === 'student' && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
          <Flame className={cn('size-4', (progress?.currentStreak ?? 0) > 0 ? 'text-accent' : 'text-muted-foreground')} />
          <div className="text-xs text-muted-foreground">
            {progress ? (
              <>
                <span className="font-semibold text-foreground">{progress.currentStreak}-day</span> streak
                {progress.longestStreak > 0 && (
                  <span className="ml-1 text-[10px] text-muted-foreground/70">· best {progress.longestStreak}d</span>
                )}
              </>
            ) : (
              'Loading streak…'
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
