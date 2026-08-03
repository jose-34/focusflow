import { BookOpen, ChartColumn, Gamepad2, GraduationCap, Heart, LayoutDashboard, ListTodo, Map, Settings, Timer, Trophy } from 'lucide-react'

export interface NavLink {
  to: string
  label: string
  icon: typeof LayoutDashboard
}

const sharedLinks: Array<NavLink> = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/tasks', label: 'Tasks', icon: ListTodo },
  { to: '/focus', label: 'Focus Timer', icon: Timer },
  { to: '/progress', label: 'Progress', icon: ChartColumn },
  { to: '/wellness', label: 'Wellness', icon: Heart },
  { to: '/achievements', label: 'Achievements', icon: Trophy },
  { to: '/journey', label: 'Journey', icon: Map },
  { to: '/classes', label: 'My Classes', icon: GraduationCap },
]

export const teacherNavLinks: Array<NavLink> = [...sharedLinks, { to: '/settings', label: 'Settings', icon: Settings }]

export const studentNavLinks: Array<NavLink> = [
  ...sharedLinks,
  { to: '/game/join', label: 'Play', icon: Gamepad2 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

// Deliberately its own short list, not `sharedLinks` — an admin doesn't
// have tasks/focus sessions/wellness of their own to manage here.
export const adminNavLinks: Array<NavLink> = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/content', label: 'Content Library', icon: BookOpen },
]

export function getNavLinks(role: 'student' | 'teacher' | 'admin'): Array<NavLink> {
  if (role === 'admin') return adminNavLinks
  return role === 'teacher' ? teacherNavLinks : studentNavLinks
}
