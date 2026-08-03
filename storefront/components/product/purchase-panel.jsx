"use client"

import { Minus, Plus } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { useCart } from "@/components/cart/cart-provider"
import { useI18n } from "@/components/i18n-provider"
import { Price } from "@/components/price"
import { Button } from "@/components/ui/button"
import { addToCart } from "@/lib/actions/cart"
import { cn, formatPrice, getVariantPrice } from "@/lib/utils"

const optionsMatch = (variant, selected) =>
  (variant.options || []).every((value) => selected[value.option?.title || value.option_id] === value.value)

/**
 * Variant options + quantity + price + add-to-cart. Client-side so the price
 * follows the selected variant instantly (template's variant UX).
 */
export const PurchasePanel = ({ product }) => {
  const { locale, dict } = useI18n()
  const { setCart, openCart } = useCart()
  const [pending, startTransition] = useTransition()
  const [quantity, setQuantity] = useState(1)

  const options = (product.options || []).filter((option) => option.title !== "Default")

  const [selected, setSelected] = useState(() =>
    Object.fromEntries(
      (product.options || []).map((option) => [option.title, option.values?.[0]?.value])
    )
  )

  const variant = useMemo(() => {
    const variants = product.variants || []
    if (variants.length === 1) return variants[0]
    return variants.find((candidate) => optionsMatch(candidate, selected)) || null
  }, [product.variants, selected])

  const { amount, originalAmount, onSale, tiers } = getVariantPrice(variant || product.variants?.[0])
  const inStock = variant ? !variant.manage_inventory || variant.inventory_quantity > 0 : false
  // Tiers the shopper hasn't reached yet, so we can nudge "buy N, pay X".
  const upcomingTiers = (tiers || []).filter((tier) => tier.min_quantity > quantity && tier.price < amount)

  const submit = () => {
    if (!variant) return
    startTransition(async () => {
      const result = await addToCart({ variantId: variant.id, quantity })
      if (result.error) {
        toast.error(result.error)
        return
      }
      setCart(result.cart)
      toast.success(dict.pdp.added)
      openCart()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        {/* Just the price. How it was arrived at (price list, group) is internal. */}
        <Price amount={amount} originalAmount={originalAmount} onSale={onSale} locale={locale} size="lg" />
        {upcomingTiers.length > 0 && (
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {upcomingTiers.map((tier) => (
              <li key={tier.min_quantity}>
                {dict.pdp.tier_hint
                  .replace("{qty}", tier.min_quantity)
                  .replace("{price}", formatPrice(tier.price, locale))}
              </li>
            ))}
          </ul>
        )}
      </div>

      {options.map((option) => (
        <div key={option.id} className="flex flex-col gap-2">
          <span className="text-sm font-medium">{option.title}</span>
          <div className="flex flex-wrap gap-2">
            {(option.values || []).map((value) => {
              const isActive = selected[option.title] === value.value
              return (
                <button
                  key={value.id || value.value}
                  onClick={() => setSelected((prev) => ({ ...prev, [option.title]: value.value }))}
                  className={cn(
                    "rounded-md border px-4 py-2 text-sm transition-colors",
                    isActive ? "border-black bg-black text-white" : "border-input hover:border-black"
                  )}
                >
                  {value.value}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-4">
        <div className="flex items-center rounded-md border">
          <button
            className="p-2.5 hover:bg-accent disabled:opacity-50"
            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
            disabled={quantity <= 1}
            aria-label="Decrease quantity"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-10 text-center text-sm font-medium tabular-nums">{quantity}</span>
          <button
            className="p-2.5 hover:bg-accent"
            onClick={() => setQuantity((current) => current + 1)}
            aria-label="Increase quantity"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <span className={cn("text-sm", inStock ? "text-green-700" : "text-destructive")}>
          {inStock ? dict.pdp.in_stock : dict.pdp.out_of_stock}
        </span>
      </div>

      <Button size="lg" className="w-full" onClick={submit} disabled={!variant || !inStock} isLoading={pending}>
        {pending ? dict.pdp.adding : dict.pdp.add_to_cart}
      </Button>
    </div>
  )
}
