export type GameplayThemeKey = 'forest' | 'bridge' | 'robot' | 'reading' | 'lab'

export interface GameplayTheme {
  key: GameplayThemeKey
  label: string
  description: string
  character: string
  stumbleCharacter: string
  stepIcon: string
  destinationIcon: string
  gradient: string
  accent: string
}

// Five reskins of one honest mechanic (correct answer -> visible advance,
// wrong answer -> a small stumble, never a dead-end) rather than five
// separate bespoke gameplay implementations — see GameplayWorld.tsx. Maps
// onto the master build prompt's five suggested environments/mechanics.
export const GAMEPLAY_THEMES: Record<GameplayThemeKey, GameplayTheme> = {
  forest: {
    key: 'forest',
    label: 'Forest Path',
    description: 'Walk the trail through Fraction Forest',
    character: '🏃',
    stumbleCharacter: '😵',
    stepIcon: '🌲',
    destinationIcon: '🏕️',
    gradient: 'linear-gradient(180deg, #eaf5e8 0%, #d3ead0 100%)',
    accent: '#3f7d3a',
  },
  bridge: {
    key: 'bridge',
    label: 'Math Bridge',
    description: 'Build the bridge plank by plank',
    character: '🚶',
    stumbleCharacter: '💦',
    stepIcon: '🪵',
    destinationIcon: '🏰',
    gradient: 'linear-gradient(180deg, #e6f2fb 0%, #cfe7f9 100%)',
    accent: '#2d6ea3',
  },
  robot: {
    key: 'robot',
    label: 'Code Robot',
    description: 'Guide the robot through the circuit',
    character: '🤖',
    stumbleCharacter: '⚠️',
    stepIcon: '🔷',
    destinationIcon: '🏁',
    gradient: 'linear-gradient(180deg, #eef0fb 0%, #dbe0f7 100%)',
    accent: '#4b4fa8',
  },
  reading: {
    key: 'reading',
    label: 'Reading Trail',
    description: 'Turn the pages toward the story’s end',
    character: '🧭',
    stumbleCharacter: '❓',
    stepIcon: '📖',
    destinationIcon: '📚',
    gradient: 'linear-gradient(180deg, #fbf3e6 0%, #f5e6cc 100%)',
    accent: '#a3762d',
  },
  lab: {
    key: 'lab',
    label: 'Science Lab',
    description: 'Power up the experiment',
    character: '🧑‍🔬',
    stumbleCharacter: '💥',
    stepIcon: '🧪',
    destinationIcon: '⚗️',
    gradient: 'linear-gradient(180deg, #eafaf6 0%, #cdf0e6 100%)',
    accent: '#1f8f74',
  },
}

export const GAMEPLAY_THEME_LIST = Object.values(GAMEPLAY_THEMES)

const STORAGE_KEY = 'focusflow.gameplayTheme'

export function getStoredGameplayTheme(): GameplayThemeKey {
  if (typeof window === 'undefined') return 'forest'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored && stored in GAMEPLAY_THEMES ? (stored as GameplayThemeKey) : 'forest'
}

export function setStoredGameplayTheme(theme: GameplayThemeKey) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, theme)
}
