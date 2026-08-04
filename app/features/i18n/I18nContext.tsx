import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { updatePreferredLanguageFn } from '@/features/settings/hooks/useSettings'
import en, { type TranslationKey } from './translations/en'
import sw from './translations/sw'

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sw', label: 'Kiswahili' },
] as const

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']

const DICTIONARIES: Record<LanguageCode, Record<TranslationKey, string>> = { en, sw }

function isSupportedLanguage(value: string | null | undefined): value is LanguageCode {
  return value === 'en' || value === 'sw'
}

interface I18nContextValue {
  language: LanguageCode
  setLanguage: (language: LanguageCode) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

// Scoped to the student play experience only (live game + async quiz
// taking) — everything else in the app stays English-only by design, so
// this provider is mounted app-wide but most components simply never call
// useTranslation(). See app/features/quizzes/questionTypes.ts's sibling
// doc comment on why: AI-generated question *content* language (a
// separate axis, set per-generation) is not part of this static-string
// layer.
export function I18nProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    if (typeof window === 'undefined') return 'en'
    const stored = localStorage.getItem('focusflow-language')
    if (isSupportedLanguage(stored)) return stored
    const browserLang = window.navigator.language.slice(0, 2)
    return isSupportedLanguage(browserLang) ? browserLang : 'en'
  })

  // A signed-in student's saved preference wins once it loads, so their
  // choice follows them across devices — but only overrides the local
  // guess once, not on every render (a student actively switching
  // languages this session shouldn't get stomped back by a stale fetch).
  useEffect(() => {
    if (isSupportedLanguage(user?.preferredLanguage)) {
      setLanguageState(user.preferredLanguage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    localStorage.setItem('focusflow-language', language)
  }, [language])

  const setLanguage = useCallback(
    (next: LanguageCode) => {
      setLanguageState(next)
      if (user) {
        void updatePreferredLanguageFn({ data: { preferredLanguage: next } }).catch(() => {
          // Best-effort sync — localStorage already has it for this
          // browser, so a failed server write isn't worth surfacing.
        })
      }
    },
    [user],
  )

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const template = DICTIONARIES[language][key] ?? DICTIONARIES.en[key]
      if (!vars) return template
      return Object.entries(vars).reduce((str, [name, value]) => str.replaceAll(`{${name}}`, String(value)), template)
    },
    [language],
  )

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useTranslation() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useTranslation must be used within an I18nProvider')
  }
  return ctx
}
