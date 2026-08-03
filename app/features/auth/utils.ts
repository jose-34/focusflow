import { getCookie } from '@tanstack/react-start/server'
import { authService } from './services/auth.service'

export async function requireUser() {
  const token = getCookie('session_token')
  const validated = await authService.validateSession(token ?? '')
  if (!validated) {
    throw new Error('Not authenticated')
  }
  return validated.user
}

export async function requireAdmin() {
  const user = await requireUser()
  if (user.role !== 'admin') {
    throw new Error('Admin access required')
  }
  return user
}
