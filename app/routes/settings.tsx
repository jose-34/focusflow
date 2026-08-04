import { createFileRoute, redirect } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { LoaderCircle } from 'lucide-react'
import { getCurrentUserFn, useAuth } from '@/features/auth/hooks/useAuth'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { updatePasswordSchema, updateProfileSchema, type UpdatePasswordInput, type UpdateProfileInput } from '@/features/auth/validators'
import { SUPPORTED_LANGUAGES, useTranslation } from '@/features/i18n/I18nContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export const Route = createFileRoute('/settings')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
  },
  component: SettingsPage,
})

function SettingsPage() {
  const { user } = useAuth()
  const { updateProfile, isUpdatingProfile, updatePassword, isUpdatingPassword } = useSettings()
  const { language, setLanguage } = useTranslation()

  const profileForm = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { firstName: user?.firstName ?? '', lastName: user?.lastName ?? '' },
  })

  const passwordForm = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  })

  async function onUpdateProfile(values: UpdateProfileInput) {
    try {
      await updateProfile(values)
      toast.success('Profile updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile')
    }
  }

  async function onUpdatePassword(values: UpdatePasswordInput) {
    try {
      await updatePassword(values)
      toast.success('Password updated')
      passwordForm.reset({ currentPassword: '', newPassword: '' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update password')
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 font-heading text-2xl font-semibold text-foreground">Settings</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-heading text-base text-foreground">Profile</CardTitle>
          <CardDescription>Update your display name</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onUpdateProfile)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={profileForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={isUpdatingProfile} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                {isUpdatingProfile && <LoaderCircle className="size-4 animate-spin" />}
                Save Profile
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {user?.role === 'student' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-heading text-base text-foreground">Play Language</CardTitle>
            <CardDescription>Language used for live games and quiz-taking screens</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={language} onValueChange={(v) => setLanguage(v as 'en' | 'sw')}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base text-foreground">Password</CardTitle>
          <CardDescription>Change your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onUpdatePassword)} className="space-y-4">
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isUpdatingPassword} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                {isUpdatingPassword && <LoaderCircle className="size-4 animate-spin" />}
                Update Password
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
