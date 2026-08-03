import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LoaderCircle, X } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useProgress } from '@/features/progress/hooks/useProgress'
import { getNavLinks } from '@/components/nav/nav-config'
import { useTimer } from '@/features/timer/TimerContext'
import { TimerProvider } from '@/features/timer/TimerContext'
import { MiniTimer } from '@/features/timer/MiniTimer'
import { cn } from '@/lib/utils'
import { TopNav } from './TopNav'
import { Sidebar } from './Sidebar'

function MiniTimerGate() {
  const timer = useTimer()
  if (!timer.isRunning && timer.timeLeft >= timer.totalDurationSeconds) return null
  return <MiniTimer />
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { data: progress } = useProgress()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoaderCircle className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <TimerProvider>
      <div className="min-h-screen bg-background text-foreground">
      <TopNav onOpenMobile={() => setMobileOpen(true)} />
      {isAuthenticated && <Sidebar />}
      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={cn('min-h-[calc(100vh-3.5rem)] pt-14', isAuthenticated && 'md:ml-60')}
      >
        {children}
      </motion.main>

      <MiniTimerGate />

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-50 w-64 border-l border-border bg-card p-4 md:hidden"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-heading text-sm font-semibold text-foreground">Menu</span>
                <button onClick={() => setMobileOpen(false)} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
                  <X className="size-5" />
                </button>
              </div>
              <nav className="flex flex-col gap-1">
                {isAuthenticated && (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3 mb-2">
                    <span className={cn('size-4', (progress?.currentStreak ?? 0) > 0 ? 'text-accent' : 'text-muted-foreground')}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="M12 2c0 0-8 10-8 18h16c0-8-8-18-8-18z"/></svg>
                    </span>
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
                {/* Links are rendered via the sidebar's link structure; for mobile we duplicate the essential nav */}
                <MobileNavLinks onNavigate={() => setMobileOpen(false)} />
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </div>
    </TimerProvider>
  )
}

function MobileNavLinks({ onNavigate }: { onNavigate: () => void }) {
  const { isAuthenticated, user, logout } = useAuth()
  const links = getNavLinks(user?.role === 'admin' ? 'admin' : user?.role === 'teacher' ? 'teacher' : 'student')

  return (
    <>
      {links.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <link.icon className="size-4" />
          {link.label}
        </Link>
      ))}
      {isAuthenticated && (
        <button
          onClick={() => {
            onNavigate()
            logout()
          }}
          className="mt-2 flex items-center rounded-md px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          Log out
        </button>
      )}
    </>
  )
}
