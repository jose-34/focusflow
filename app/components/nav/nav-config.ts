import { Activity, BarChart3, BookOpen, Building2, CalendarClock, ChartColumn, ClipboardList, Cog, Coins, Gamepad2, GraduationCap, Heart, LayoutDashboard, Library, ListTodo, Map, Settings, Timer, Trophy, Users } from 'lucide-react'

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

export const teacherNavLinks: Array<NavLink> = [
  ...sharedLinks,
  { to: '/reports', label: 'Reports', icon: ClipboardList },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export const studentNavLinks: Array<NavLink> = [
  ...sharedLinks,
  { to: '/library', label: 'Library', icon: Library },
  { to: '/game/join', label: 'Play', icon: Gamepad2 },
  { to: '/shop', label: 'Shop', icon: Coins },
  { to: '/settings', label: 'Settings', icon: Settings },
]

// Deliberately its own short list, not `sharedLinks` — an admin doesn't
// have tasks/focus sessions/wellness of their own to manage here. This is
// a platform-operations console (users, institutions, system activity),
// distinct in structure from the teacher/student nav, not a relabeled copy.
export const adminNavLinks: Array<NavLink> = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/institutions', label: 'Institutions', icon: Building2 },
  { to: '/admin/sessions', label: 'Sessions', icon: CalendarClock },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/activity', label: 'System Activity', icon: Activity },
  { to: '/admin/content', label: 'Content Library', icon: BookOpen },
  { to: '/admin/settings', label: 'System Settings', icon: Cog },
  { to: '/settings', label: 'My Account', icon: Settings },
]

export function getNavLinks(role: 'student' | 'teacher' | 'admin'): Array<NavLink> {
  if (role === 'admin') return adminNavLinks
  return role === 'teacher' ? teacherNavLinks : studentNavLinks
}
