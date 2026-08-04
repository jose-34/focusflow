import { sql } from 'drizzle-orm'
import { index, jsonb, pgEnum, pgPolicy, pgTable, primaryKey, text, timestamp, uuid, integer, boolean, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from './users'

// Exact mirror of xp_ledger's shape and reasoning — append-only, balance is
// SUM(amount) computed on demand, no running-total column on users (same
// rationale as the deleted users.xp column: a write-only counter is a
// single-source-of-truth risk). See docs/12_Gamification_Framework.md §8's
// 2026-08-04 note: this currency is strictly cosmetic (avatar shop only),
// a narrow, deliberate exception to that doc's general no-currency rule.
export const currencyLedger = pgTable(
  'currency_ledger',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(), // negative for spends
    source: text('source').notNull(), // 'quiz_attempt' | 'game_session' | 'achievement' | 'shop_purchase' | ...
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('currency_ledger_user_id_idx').on(table.userId),
    pgPolicy('currency_ledger_self_access', {
      for: 'all',
      using: sql`nullif(current_setting('app.user_id', true), '')::uuid = ${table.userId}`,
      withCheck: sql`nullif(current_setting('app.user_id', true), '')::uuid = ${table.userId}`,
    }),
  ],
).enableRLS()

export const shopItemCategoryEnum = pgEnum('shop_item_category', ['helmet', 'outfit', 'accessory', 'background'])

// World-readable catalog (like curricula/subjects) — admin-seeded only, no
// insert/update/delete policy (default-deny at the RLS layer).
export const shopItems = pgTable(
  'shop_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    category: shopItemCategoryEnum('category').notNull(),
    name: text('name').notNull(),
    priceCoins: integer('price_coins').notNull(),
    // The token AvatarDisplay switches on to render this item — there's no
    // art/media pipeline in this codebase, so items are composed from a
    // fixed lookup of emoji/inline-SVG pieces, not stored image URLs.
    spriteKey: text('sprite_key').notNull(),
    isDefault: boolean('is_default').notNull().default(false), // free starter items, granted at signup
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  () => [pgPolicy('shop_items_select', { for: 'select', using: sql`true` })],
).enableRLS()

export const userOwnedItems = pgTable(
  'user_owned_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id').notNull().references(() => shopItems.id, { onDelete: 'cascade' }),
    acquiredAt: timestamp('acquired_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_owned_items_user_item_idx').on(table.userId, table.itemId),
    index('user_owned_items_user_id_idx').on(table.userId),
    pgPolicy('user_owned_items_self_access', {
      for: 'all',
      using: sql`nullif(current_setting('app.user_id', true), '')::uuid = ${table.userId}`,
      withCheck: sql`nullif(current_setting('app.user_id', true), '')::uuid = ${table.userId}`,
    }),
  ],
).enableRLS()

// One row per (user, category) — equipping a new helmet replaces the old
// one via ON CONFLICT upsert, rather than needing a separate "currently
// equipped" boolean column on user_owned_items that'd need clearing on
// every re-equip.
export const userEquippedItems = pgTable(
  'user_equipped_items',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    category: shopItemCategoryEnum('category').notNull(),
    itemId: uuid('item_id').notNull().references(() => shopItems.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.category] }),
    // Self-access covers viewing/equipping your own avatar; a second,
    // additive policy (applied in apply-rls.ts, needs a SECURITY DEFINER
    // helper since it crosses users) lets fellow live-game participants see
    // what you're wearing on the lobby/leaderboard tiles.
    pgPolicy('user_equipped_items_self_access', {
      for: 'all',
      using: sql`nullif(current_setting('app.user_id', true), '')::uuid = ${table.userId}`,
      withCheck: sql`nullif(current_setting('app.user_id', true), '')::uuid = ${table.userId}`,
    }),
  ],
).enableRLS()

export type CurrencyLedgerEntry = typeof currencyLedger.$inferSelect
export type NewCurrencyLedgerEntry = typeof currencyLedger.$inferInsert
export type ShopItem = typeof shopItems.$inferSelect
export type NewShopItem = typeof shopItems.$inferInsert
export type UserOwnedItem = typeof userOwnedItems.$inferSelect
export type UserEquippedItem = typeof userEquippedItems.$inferSelect
