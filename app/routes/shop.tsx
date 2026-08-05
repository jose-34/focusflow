import { useMemo, useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Check, Coins, LoaderCircle } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { useEconomy, type ShopItemSummary } from '@/features/economy/hooks/useEconomy'
import { AvatarDisplay } from '@/features/economy/components/AvatarDisplay'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export const Route = createFileRoute('/shop')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (user.role !== 'student') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: ShopPage,
})

const CATEGORY_LABELS: Record<ShopItemSummary['category'], string> = {
  helmet: 'Helmets',
  outfit: 'Outfits',
  accessory: 'Accessories',
  background: 'Backgrounds',
}

function ItemCard({ item, onBuy, onEquip, isPurchasing, isEquipping, balance }: {
  item: ShopItemSummary
  onBuy: () => void
  onEquip: () => void
  isPurchasing: boolean
  isEquipping: boolean
  balance: number
}) {
  return (
    <Card className={item.equipped ? 'border-accent' : undefined}>
      <CardContent className="flex flex-col items-center gap-3 py-5 text-center">
        <AvatarDisplay sprites={{ [item.category]: item.spriteKey }} size="lg" />
        <div>
          <p className="text-sm font-medium text-foreground">{item.name}</p>
          {!item.isDefault && (
            <p className="mt-0.5 flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Coins className="size-3" />
              {item.priceCoins}
            </p>
          )}
        </div>
        {item.equipped ? (
          <Badge className="gap-1">
            <Check className="size-3" />
            Equipped
          </Badge>
        ) : item.owned ? (
          <Button size="sm" variant="outline" onClick={onEquip} disabled={isEquipping} className="w-full">
            {isEquipping && <LoaderCircle className="size-3.5 animate-spin" />}
            Equip
          </Button>
        ) : (
          <Button size="sm" onClick={onBuy} disabled={isPurchasing || balance < item.priceCoins} className="w-full gap-1 bg-accent text-accent-foreground hover:bg-accent/90">
            {isPurchasing && <LoaderCircle className="size-3.5 animate-spin" />}
            Buy
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function ShopPage() {
  const { economy, isLoading, purchase, isPurchasing, equip, isEquipping } = useEconomy()
  const [activeTab, setActiveTab] = useState<ShopItemSummary['category']>('helmet')
  const [pendingItemId, setPendingItemId] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const groups: Record<ShopItemSummary['category'], Array<ShopItemSummary>> = { helmet: [], outfit: [], accessory: [], background: [] }
    for (const item of economy?.items ?? []) groups[item.category].push(item)
    return groups
  }, [economy])

  const equippedSprites = useMemo(() => {
    const result: Record<string, string> = {}
    for (const item of economy?.items ?? []) {
      if (item.equipped) result[item.category] = item.spriteKey
    }
    return result
  }, [economy])

  async function handleBuy(item: ShopItemSummary) {
    setPendingItemId(item.id)
    try {
      await purchase(item.id)
      toast.success(`Bought ${item.name}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to buy item')
    } finally {
      setPendingItemId(null)
    }
  }

  async function handleEquip(item: ShopItemSummary) {
    setPendingItemId(item.id)
    try {
      await equip(item.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to equip item')
    } finally {
      setPendingItemId(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-4">
          <AvatarDisplay sprites={equippedSprites} size="lg" />
          <div>
            <h1 className="font-heading text-xl font-semibold text-foreground">Avatar Shop</h1>
            <p className="text-sm text-muted-foreground">Cosmetic only. Never affects scores or grading.</p>
          </div>
        </div>
        <Badge variant="secondary" className="gap-1.5 self-center px-3 py-1.5 text-sm">
          <Coins className="size-4 text-accent" />
          {isLoading ? '—' : (economy?.balance ?? 0).toLocaleString()} coins
        </Badge>
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-lg bg-secondary" />
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ShopItemSummary['category'])}>
          <TabsList className="mb-6 h-auto flex-wrap">
            {(Object.keys(CATEGORY_LABELS) as Array<ShopItemSummary['category']>).map((category) => (
              <TabsTrigger key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </TabsTrigger>
            ))}
          </TabsList>
          {(Object.keys(CATEGORY_LABELS) as Array<ShopItemSummary['category']>).map((category) => (
            <TabsContent key={category} value={category}>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {grouped[category].map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onBuy={() => handleBuy(item)}
                    onEquip={() => handleEquip(item)}
                    isPurchasing={isPurchasing && pendingItemId === item.id}
                    isEquipping={isEquipping && pendingItemId === item.id}
                    balance={economy?.balance ?? 0}
                  />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
