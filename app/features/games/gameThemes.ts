// Visual presets scoped to the live-game screen only — deliberately
// separate from the site-wide light/dark ThemeContext (app/features/theme),
// which stays a binary toggle. Applied via a `data-game-theme` attribute on
// the game route's own root div, with matching CSS custom-property
// overrides in app/styles/globals.css — never touches `.dark` on <html>.
export const GAME_THEMES = [
  { key: 'classic', label: 'Classic' },
  { key: 'synthwave', label: 'Synthwave' },
  { key: 'dogsville', label: 'Dogsville' },
  { key: 'cosmic', label: 'Cosmic' },
  { key: 'touchdown', label: 'Touchdown' },
] as const

export type GameThemeKey = (typeof GAME_THEMES)[number]['key']

const STORAGE_KEY = 'focusflow-game-theme'

export function getStoredGameTheme(): GameThemeKey {
  if (typeof window === 'undefined') return 'classic'
  const stored = localStorage.getItem(STORAGE_KEY)
  return (GAME_THEMES.find((t) => t.key === stored)?.key ?? 'classic') as GameThemeKey
}

export function setStoredGameTheme(theme: GameThemeKey) {
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, theme)
}
