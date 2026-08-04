import { ACCESSORY_SPRITES, BACKGROUND_SPRITES, faceEmoji, HELMET_SPRITES, OUTFIT_SPRITES } from '../avatarSprites'

export interface EquippedSprites {
  helmet?: string | null
  outfit?: string | null
  accessory?: string | null
  background?: string | null
}

const SIZE_CLASSES = {
  sm: 'size-8 text-base',
  md: 'size-12 text-2xl',
  lg: 'size-20 text-4xl',
} as const

// Layered emoji composable — no art pipeline in this codebase, so this is
// the deliberate substitute for custom character art (see
// app/features/economy/avatarSprites.tsx). Renders correctly with zero
// equipped items (just the base face on the default background).
export function AvatarDisplay({ sprites, size = 'md' }: { sprites: EquippedSprites; size?: 'sm' | 'md' | 'lg' }) {
  const background = (sprites.background && BACKGROUND_SPRITES[sprites.background]) || BACKGROUND_SPRITES.background_default
  const helmet = sprites.helmet ? HELMET_SPRITES[sprites.helmet] : ''
  const outfit = sprites.outfit ? OUTFIT_SPRITES[sprites.outfit] : ''
  const accessory = sprites.accessory ? ACCESSORY_SPRITES[sprites.accessory] : ''

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border ${SIZE_CLASSES[size]}`}
      style={{ background }}
    >
      <span aria-hidden>{outfit || faceEmoji()}</span>
      {helmet && <span className="absolute -top-0.5 text-[0.7em]" aria-hidden>{helmet}</span>}
      {accessory && <span className="absolute -right-0.5 -bottom-0.5 text-[0.55em]" aria-hidden>{accessory}</span>}
    </div>
  )
}
