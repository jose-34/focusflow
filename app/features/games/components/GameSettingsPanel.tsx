import { useState } from 'react'
import { Settings, Square, SquareCheck, Volume2, Music, Speech } from 'lucide-react'
import { isMusicEnabled, isSoundMuted, setMusicEnabled, setSoundMuted } from '@/lib/sound'
import { SUPPORTED_LANGUAGES, useTranslation, type LanguageCode } from '@/features/i18n/I18nContext'
import { GAME_THEMES, getStoredGameTheme, setStoredGameTheme, type GameThemeKey } from '../gameThemes'
import { GAMEPLAY_THEME_LIST, getStoredGameplayTheme, setStoredGameplayTheme, type GameplayThemeKey } from '@/features/gameplay/gameplayThemes'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function ToggleRow({ icon: Icon, label, value, onChange }: { icon: typeof Volume2; label: string; value: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2.5 text-sm"
    >
      <span className="flex items-center gap-2 text-foreground">
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </span>
      {value ? <SquareCheck className="size-5 text-primary" /> : <Square className="size-5 text-muted-foreground" />}
    </button>
  )
}

// Read-text-aloud speaks the given text via the browser's native
// SpeechSynthesis API — zero dependencies, no licensing, and respects the
// current play-language for voice selection where the browser supports it.
export function speakText(text: string, language: LanguageCode) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = language === 'sw' ? 'sw-KE' : 'en-US'
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

export function GameSettingsPanel({ onThemeChange, onGameplayThemeChange, readAloudEnabled, onReadAloudChange }: {
  onThemeChange?: (theme: GameThemeKey) => void
  onGameplayThemeChange?: (theme: GameplayThemeKey) => void
  readAloudEnabled: boolean
  onReadAloudChange: (next: boolean) => void
}) {
  const { language, setLanguage } = useTranslation()
  const [soundOn, setSoundOn] = useState(() => !isSoundMuted())
  const [musicOn, setMusicOn] = useState(() => isMusicEnabled())
  const [theme, setTheme] = useState<GameThemeKey>(() => getStoredGameTheme())
  const [gameplayTheme, setGameplayTheme] = useState<GameplayThemeKey>(() => getStoredGameplayTheme())

  function handleThemeChange(next: GameThemeKey) {
    setTheme(next)
    setStoredGameTheme(next)
    onThemeChange?.(next)
  }

  function handleGameplayThemeChange(next: GameplayThemeKey) {
    setGameplayTheme(next)
    setStoredGameplayTheme(next)
    onGameplayThemeChange?.(next)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Game settings">
          <Settings className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-foreground">Game Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <ToggleRow
            icon={Volume2}
            label="Sound effects"
            value={soundOn}
            onChange={(next) => {
              setSoundOn(next)
              setSoundMuted(!next)
            }}
          />
          <ToggleRow
            icon={Music}
            label="Music (ambient)"
            value={musicOn}
            onChange={(next) => {
              setMusicOn(next)
              setMusicEnabled(next)
            }}
          />
          <ToggleRow icon={Speech} label="Read questions aloud" value={readAloudEnabled} onChange={onReadAloudChange} />

          <div className="space-y-1.5 pt-1">
            <p className="text-xs font-medium text-muted-foreground">Theme</p>
            <div className="flex flex-wrap gap-1.5">
              {GAME_THEMES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => handleThemeChange(t.key)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    theme === t.key ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-background text-muted-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <p className="text-xs font-medium text-muted-foreground">World</p>
            <div className="flex flex-wrap gap-1.5">
              {GAMEPLAY_THEME_LIST.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => handleGameplayThemeChange(t.key)}
                  title={t.description}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    gameplayTheme === t.key ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-background text-muted-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <p className="text-xs font-medium text-muted-foreground">Language</p>
            <Select value={language} onValueChange={(v) => setLanguage(v as LanguageCode)}>
              <SelectTrigger className="w-full">
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
