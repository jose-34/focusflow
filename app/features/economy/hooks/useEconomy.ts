import { createServerFn } from '@tanstack/react-start'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { withRlsContext, type Tx } from '@/db'
import { currencyLedger, userEquippedItems, userOwnedItems } from '@/db/schema'
import { requireUser } from '@/features/auth/utils'

// Mirrors the reasoning already established for XP: append-only ledger,
// balance computed on demand — no running-total column anywhere to drift
// out of sync with reality.
export async function getCoinBalance(tx: Tx, userId: string): Promise<number> {
  const [row] = await tx
    .select({ total: sql<number>`coalesce(sum(${currencyLedger.amount}), 0)` })
    .from(currencyLedger)
    .where(eq(currencyLedger.userId, userId))
  return row?.total ?? 0
}

// Shared by every coin-earning call site (quiz submission, game scoring/
// completion, achievement unlocks) — same shape as the existing xpLedger
// inserts elsewhere, just its own table.
export async function awardCoins(tx: Tx, userId: string, amount: number, source: string, metadata?: Record<string, unknown>): Promise<void> {
  if (amount <= 0) return
  await tx.insert(currencyLedger).values({ userId, amount, source, metadata })
}

export interface ShopItemSummary {
  id: string
  category: 'helmet' | 'outfit' | 'accessory' | 'background'
  name: string
  priceCoins: number
  spriteKey: string
  isDefault: boolean
  owned: boolean
  equipped: boolean
}

export interface EconomyState {
  balance: number
  items: Array<ShopItemSummary>
}

export const getEconomyStateFn = createServerFn({ method: 'GET' }).handler(async (): Promise<EconomyState> => {
  const user = await requireUser()
  return withRlsContext(user.id, async (tx) => {
    const [balance, catalog, owned, equipped] = await Promise.all([
      getCoinBalance(tx, user.id),
      tx.query.shopItems.findMany({ orderBy: (i, { asc }) => [asc(i.category), asc(i.priceCoins)] }),
      tx.query.userOwnedItems.findMany({ where: (o, { eq: eqOp }) => eqOp(o.userId, user.id) }),
      tx.query.userEquippedItems.findMany({ where: (e, { eq: eqOp }) => eqOp(e.userId, user.id) }),
    ])

    const ownedIds = new Set(owned.map((o) => o.itemId))
    const equippedIds = new Set(equipped.map((e) => e.itemId))

    return {
      balance,
      items: catalog.map((item) => ({
        id: item.id,
        category: item.category,
        name: item.name,
        priceCoins: item.priceCoins,
        spriteKey: item.spriteKey,
        isDefault: item.isDefault,
        owned: item.isDefault || ownedIds.has(item.id),
        equipped: equippedIds.has(item.id),
      })),
    }
  })
})

const purchaseItemSchema = z.object({ itemId: z.string().uuid() })

export const purchaseItemFn = createServerFn({ method: 'POST' })
  .validator(purchaseItemSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    return withRlsContext(user.id, async (tx) => {
      const item = await tx.query.shopItems.findFirst({ where: (i, { eq: eqOp }) => eqOp(i.id, data.itemId) })
      if (!item) throw new Error('Item not found')
      if (item.isDefault) throw new Error('This item is already free')

      const existing = await tx.query.userOwnedItems.findFirst({
        where: (o, { eq: eqOp, and: andOp }) => andOp(eqOp(o.userId, user.id), eqOp(o.itemId, item.id)),
      })
      if (existing) throw new Error('You already own this item')

      const balance = await getCoinBalance(tx, user.id)
      if (balance < item.priceCoins) throw new Error('Not enough coins')

      await tx.insert(currencyLedger).values({ userId: user.id, amount: -item.priceCoins, source: 'shop_purchase', metadata: { itemId: item.id } })
      await tx.insert(userOwnedItems).values({ userId: user.id, itemId: item.id })

      return { success: true }
    })
  })

const equipItemSchema = z.object({ itemId: z.string().uuid() })

export const equipItemFn = createServerFn({ method: 'POST' })
  .validator(equipItemSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    return withRlsContext(user.id, async (tx) => {
      const item = await tx.query.shopItems.findFirst({ where: (i, { eq: eqOp }) => eqOp(i.id, data.itemId) })
      if (!item) throw new Error('Item not found')

      if (!item.isDefault) {
        const owned = await tx.query.userOwnedItems.findFirst({
          where: (o, { eq: eqOp, and: andOp }) => andOp(eqOp(o.userId, user.id), eqOp(o.itemId, item.id)),
        })
        if (!owned) throw new Error("You don't own this item yet")
      }

      await tx
        .insert(userEquippedItems)
        .values({ userId: user.id, category: item.category, itemId: item.id })
        .onConflictDoUpdate({ target: [userEquippedItems.userId, userEquippedItems.category], set: { itemId: item.id } })

      return { success: true }
    })
  })

export function useEconomy() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['economy'],
    queryFn: () => getEconomyStateFn(),
  })

  const purchaseMutation = useMutation({
    mutationFn: (itemId: string) => purchaseItemFn({ data: { itemId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['economy'] }),
  })

  const equipMutation = useMutation({
    mutationFn: (itemId: string) => equipItemFn({ data: { itemId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['economy'] }),
  })

  return {
    economy: query.data,
    isLoading: query.isLoading,
    purchase: purchaseMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    equip: equipMutation.mutateAsync,
    isEquipping: equipMutation.isPending,
  }
}

// Used by AvatarDisplay call sites that just need a user's currently
// equipped sprites (dashboard greeting, live-game tiles) without the full
// shop catalog.
export async function getEquippedSprites(tx: Tx, userId: string): Promise<Record<string, string>> {
  const equipped = await tx.query.userEquippedItems.findMany({
    where: (e, { eq: eqOp }) => eqOp(e.userId, userId),
    with: { item: true },
  })
  const result: Record<string, string> = {}
  for (const row of equipped) {
    result[row.category] = row.item.spriteKey
  }
  return result
}

// Used by the live-game state functions to render every participant's
// avatar in one query instead of N+1 — relies on
// user_equipped_items_visible_to_co_participants (RLS) to only surface
// rows for students who actually share an active session with the caller.
export async function getBulkEquippedSprites(tx: Tx, userIds: Array<string>): Promise<Record<string, Record<string, string>>> {
  if (userIds.length === 0) return {}
  const rows = await tx.query.userEquippedItems.findMany({
    where: (e, { inArray }) => inArray(e.userId, userIds),
    with: { item: true },
  })
  const result: Record<string, Record<string, string>> = {}
  for (const row of rows) {
    result[row.userId] ??= {}
    result[row.userId][row.category] = row.item.spriteKey
  }
  return result
}

export const getMyEquippedSpritesFn = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser()
  return withRlsContext(user.id, async (tx) => getEquippedSprites(tx, user.id))
})

export function useMyEquippedSprites() {
  return useQuery({
    queryKey: ['economy', 'equipped', 'me'],
    queryFn: () => getMyEquippedSpritesFn(),
    staleTime: 60 * 1000,
  })
}
