import { ChartColumn, Gamepad2, GraduationCap, Heart, LayoutDashboard, ListTodo, Map, Settings, Timer, Trophy } from 'lucide-react'

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

export function getNavLinks(isTeacher: boolean): Array<NavLink> {
  return isTeacher ? teacherNavLinks : studentNavLinks
}
