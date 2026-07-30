import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'

export const Route = createFileRoute('/classes/$classId')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
  },
  component: () => <Outlet />,
})
