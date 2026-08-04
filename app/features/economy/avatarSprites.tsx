// No art/media pipeline exists in this codebase — avatars are composed
// from a fixed lookup of emoji/CSS pieces per category, not stored image
// URLs. Each shop_items.spriteKey maps to an entry here.
export const HELMET_SPRITES: Record<string, string> = {
  helmet_none: '',
  helmet_cap: '🧢',
  helmet_tophat: '🎩',
  helmet_crown: '👑',
  helmet_headband: '🎧',
}

export const OUTFIT_SPRITES: Record<string, string> = {
  outfit_default: '👕',
  outfit_hero: '🦸',
  outfit_labcoat: '🥼',
  outfit_jersey: '🎽',
}

export const ACCESSORY_SPRITES: Record<string, string> = {
  accessory_none: '',
  accessory_sunglasses: '🕶️',
  accessory_star: '⭐',
  accessory_bowtie: '🎀',
}

// CSS gradients, not emoji — a background is the avatar tile's own
// backdrop, not an overlay glyph.
export const BACKGROUND_SPRITES: Record<string, string> = {
  background_default: 'linear-gradient(135deg, var(--color-secondary), var(--color-background))',
  background_ocean: 'linear-gradient(135deg, #1E7D4F, #3DBE7A)',
  background_sunset: 'linear-gradient(135deg, #F2B134, #E0763C)',
  background_night: 'linear-gradient(135deg, #0D3B34, #1E7D4F)',
}

export function faceEmoji(): string {
  return '🙂'
}
