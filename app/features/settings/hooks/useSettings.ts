import { createServerFn } from '@tanstack/react-start'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { withRlsContext } from '@/db'
import { users } from '@/db/schema'
import { requireUser } from '@/features/auth/utils'
import { authService } from '@/features/auth/services/auth.service'
import { updateProfileSchema, updatePasswordSchema } from '@/features/auth/validators'

const updatePreferredLanguageSchema = z.object({
  preferredLanguage: z.enum(['en', 'sw']),
})

export const updateProfileFn = createServerFn({ method: 'POST' })
  .validator(updateProfileSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    return withRlsContext(user.id, async (tx) => {
      const [updated] = await tx
        .update(users)
        .set({ firstName: data.firstName.trim(), lastName: data.lastName.trim(), updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning()
      return authService.sanitizeUser(updated)
    })
  })

export const updatePasswordFn = createServerFn({ method: 'POST' })
  .validator(updatePasswordSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    return withRlsContext(user.id, async (tx) => {
      const current = await tx.query.users.findFirst({ where: (u, { eq: eqOp }) => eqOp(u.id, user.id) })
      if (!current) throw new Error('User not found')

      const isValid = await authService.comparePassword(data.currentPassword, current.passwordHash)
      if (!isValid) throw new Error('Current password is incorrect')

      const newHash = await authService.hashPassword(data.newPassword)
      await tx.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, user.id))
      return { success: true }
    })
  })

// Called directly from I18nContext (not through useSettings) since it
// fires opportunistically whenever a signed-in student switches language
// mid-session, not from a settings-page form submit.
export const updatePreferredLanguageFn = createServerFn({ method: 'POST' })
  .validator(updatePreferredLanguageSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    return withRlsContext(user.id, async (tx) => {
      await tx.update(users).set({ preferredLanguage: data.preferredLanguage, updatedAt: new Date() }).where(eq(users.id, user.id))
      return { success: true }
    })
  })

export function useSettings() {
  const queryClient = useQueryClient()

  const updateProfileMutation = useMutation({
    mutationFn: (input: { firstName: string; lastName: string }) => updateProfileFn({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
    },
  })

  const updatePasswordMutation = useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) => updatePasswordFn({ data: input }),
  })

  return {
    updateProfile: updateProfileMutation.mutateAsync,
    isUpdatingProfile: updateProfileMutation.isPending,
    updatePassword: updatePasswordMutation.mutateAsync,
    isUpdatingPassword: updatePasswordMutation.isPending,
  }
}
