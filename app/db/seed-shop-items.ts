import { eq } from 'drizzle-orm'
import { adminDb } from './admin'
import { shopItems } from './schema'

/**
 * Idempotent — safe to re-run (skips any spriteKey already present).
 * Reference data only, so this is the sole writer (shop_items has no
 * insert/update/delete RLS policy for any application role).
 */
const ITEMS: Array<{ category: 'helmet' | 'outfit' | 'accessory' | 'background'; name: string; priceCoins: number; spriteKey: string; isDefault?: boolean }> = [
  { category: 'helmet', name: 'None', priceCoins: 0, spriteKey: 'helmet_none', isDefault: true },
  { category: 'helmet', name: 'Cap', priceCoins: 50, spriteKey: 'helmet_cap' },
  { category: 'helmet', name: 'Top Hat', priceCoins: 150, spriteKey: 'helmet_tophat' },
  { category: 'helmet', name: 'Crown', priceCoins: 300, spriteKey: 'helmet_crown' },
  { category: 'helmet', name: 'Headphones', priceCoins: 100, spriteKey: 'helmet_headband' },

  { category: 'outfit', name: 'Classic', priceCoins: 0, spriteKey: 'outfit_default', isDefault: true },
  { category: 'outfit', name: 'Hero', priceCoins: 200, spriteKey: 'outfit_hero' },
  { category: 'outfit', name: 'Lab Coat', priceCoins: 150, spriteKey: 'outfit_labcoat' },
  { category: 'outfit', name: 'Jersey', priceCoins: 120, spriteKey: 'outfit_jersey' },

  { category: 'accessory', name: 'None', priceCoins: 0, spriteKey: 'accessory_none', isDefault: true },
  { category: 'accessory', name: 'Sunglasses', priceCoins: 80, spriteKey: 'accessory_sunglasses' },
  { category: 'accessory', name: 'Star Pin', priceCoins: 60, spriteKey: 'accessory_star' },
  { category: 'accessory', name: 'Bow Tie', priceCoins: 70, spriteKey: 'accessory_bowtie' },

  { category: 'background', name: 'Default', priceCoins: 0, spriteKey: 'background_default', isDefault: true },
  { category: 'background', name: 'Ocean', priceCoins: 100, spriteKey: 'background_ocean' },
  { category: 'background', name: 'Sunset', priceCoins: 100, spriteKey: 'background_sunset' },
  { category: 'background', name: 'Night', priceCoins: 100, spriteKey: 'background_night' },
]

async function main() {
  let created = 0
  for (const item of ITEMS) {
    const existing = await adminDb.query.shopItems.findFirst({ where: eq(shopItems.spriteKey, item.spriteKey) })
    if (existing) continue
    await adminDb.insert(shopItems).values(item)
    created++
  }
  console.log(`Seeded ${created} new shop items (${ITEMS.length - created} already existed).`)
}

main().then(() => console.log('DONE'))
