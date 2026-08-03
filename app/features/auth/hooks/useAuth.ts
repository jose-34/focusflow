import { createServerFn } from '@tanstack/react-start'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '../schemas'
import { authService, type SanitizedUser } from '../services/auth.service'
import { rateLimit } from '@/lib/rateLimit'

const SESSION_COOKIE_NAME = 'session_token'
const SESSION_COOKIE_MAX_AGE = 604800

function setSessionCookie(token: string) {
  setCookie(SESSION_COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_COOKIE_MAX_AGE,
  })
}

export const loginFn = createServerFn({ method: 'POST' })
  .validator(loginSchema)
  .handler(async ({ data }): Promise<{ user: SanitizedUser }> => {
    // Password brute-forcing is the classic abuse case for a login
    // endpoint — 10 attempts/minute per IP is generous for a real user
    // (including fat-fingered passwords) but blunts an automated guesser.
    rateLimit('login', { max: 10, windowMs: 60_000 })
    const { user, session } = await authService.login(data.email, data.password)
    setSessionCookie(session.token)
    return { user }
  })

export const registerFn = createServerFn({ method: 'POST' })
  .validator(registerSchema)
  .handler(async ({ data }): Promise<{ user: SanitizedUser }> => {
    // Mainly to stop scripted mass-account creation, not real signups.
    rateLimit('register', { max: 5, windowMs: 60_000 })
    const { confirmPassword: _confirmPassword, gradeLevel, role, firstName, lastName, email, password } = data
    const { user, session } = await authService.register({
      firstName,
      lastName,
      email,
      password,
      role,
      gradeLevel: gradeLevel ? Number(gradeLevel) : undefined,
    })
    setSessionCookie(session.token)
    return { user }
  })

export const logoutFn = createServerFn({ method: 'POST' }).handler(async (): Promise<{ success: true }> => {
  const token = getCookie(SESSION_COOKIE_NAME)
  if (token) {
    await authService.logout(token)
  }
  deleteCookie(SESSION_COOKIE_NAME, { path: '/' })
  return { success: true }
})

export const getCurrentUserFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SanitizedUser | null> => {
    const token = getCookie(SESSION_COOKIE_NAME)
    if (!token) return null
    const validated = await authService.validateSession(token)
    return validated?.user ?? null
  },
)

export function useAuth() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => getCurrentUserFn(),
    staleTime: 1000 * 60 * 5,
  })

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) => loginFn({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
    },
  })

  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) => registerFn({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
    },
  })

  const logoutMutation = useMutation({
    mutationFn: () => logoutFn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      navigate({ to: '/' })
    },
  })

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    isTeacher: user?.role === 'teacher',
    isStudent: user?.role === 'student',
    isAdmin: user?.role === 'admin',
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  }
}
