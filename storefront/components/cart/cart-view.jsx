"use client"

import Image from "next/image"
import Link from "next/link"
import { Minus, Plus, Trash2, X } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { useCart } from "./cart-provider"
import { useI18n } from "@/components/i18n-provider"
import { Price } from "@/components/price"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { applyPromoCode, removeLineItem, removePromoCode, updateLineItem } from "@/lib/actions/cart"
import { formatPrice } from "@/lib/utils"

const PromoCodeForm = () => {
  const { cart, setCart } = useCart()
  const { dict } = useI18n()
  const [code, setCode] = useState("")
  const [pending, startTransition] = useTransition()

  const promotions = cart?.promotions || []

  const apply = (event) => {
    event.preventDefault()
    if (!code.trim()) return
    startTransition(async () => {
      const result = await applyPromoCode(code.trim())
      if (result.cart) setCart(result.cart)
      if (result.error) {
        // The server returns a reason key (expired, min_subtotal, not_eligible…).
        toast.error(dict.cart[`promo_${result.error}`] || dict.cart.promo_invalid)
      } else {
        toast.success(dict.cart.promo_applied)
        setCode("")
      }
    })
  }

  const remove = (promoCode) => {
    startTransition(async () => {
      const result = await removePromoCode(promoCode)
      if (result.cart) setCart(result.cart)
    })
  }

  return (
    <div className="space-y-2">
      <form onSubmit={apply} className="flex gap-2">
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder={dict.cart.promo_placeholder}
          aria-label={dict.cart.promo_placeholder}
        />
        <Button type="submit" variant="outline" isLoading={pending}>
          {dict.cart.promo_apply}
        </Button>
      </form>
      {promotions.map((promotion) => (
        <div key={promotion.id} className="flex items-center justify-between rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          <span className="font-medium uppercase">{promotion.code}</span>
          <button onClick={() => remove(promotion.code)} aria-label="Remove code" disabled={pending}>
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

export const CartView = () => {
  const { cart, setCart } = useCart()
  const { locale, dict } = useI18n()
  const [pending, startTransition] = useTransition()

  const items = cart?.items || []

  if (!items.length) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-muted-foreground">{dict.cart.empty}</p>
        <Link href="/search" className={buttonVariants()}>
          {dict.cart.empty_cta}
        </Link>
      </div>
    )
  }

  const changeQuantity = (item, quantity) => {
    startTransition(async () => {
      const result =
        quantity <= 0 ? await removeLineItem({ lineId: item.id }) : await updateLineItem({ lineId: item.id, quantity })
      if (result.cart !== undefined) setCart(result.cart)
      if (result.error) toast.error(result.error)
    })
  }

  return (
    <div className="grid gap-10 lg:grid-cols-3">
      <div className="divide-y lg:col-span-2">
        {items.map((item) => (
          <div key={item.id} className="flex gap-4 py-5">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-md bg-secondary/30">
              {item.thumbnail && (
                <Image src={item.thumbnail} alt={item.product_title || ""} fill sizes="96px" className="object-cover" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <Link href={`/product/${item.product_handle}`} className="font-medium hover:underline">
                {item.product_title}
              </Link>
              {item.variant_title && item.variant_title !== "Default" && (
                <span className="text-sm text-muted-foreground">{item.variant_title}</span>
              )}
              <div className="mt-auto flex items-center justify-between">
                <div className="flex items-center rounded-md border">
                  <button
                    className="p-2 hover:bg-accent disabled:opacity-50"
                    disabled={pending}
                    onClick={() => changeQuantity(item, item.quantity - 1)}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span>
                  <button
                    className="p-2 hover:bg-accent disabled:opacity-50"
                    disabled={pending}
                    onClick={() => changeQuantity(item, item.quantity + 1)}
                    aria-label="Increase quantity"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <span className="font-semibold">{formatPrice(item.total, locale)}</span>
              </div>
            </div>
            <button
              className="self-start p-1 text-muted-foreground hover:text-destructive"
              onClick={() => changeQuantity(item, 0)}
              disabled={pending}
              aria-label={dict.cart.remove}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <aside className="h-fit space-y-4 rounded-lg border p-6">
        <PromoCodeForm />
        <div className="space-y-2 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{dict.cart.subtotal}</span>
            <span>{formatPrice(cart.item_total, locale)}</span>
          </div>
          {(cart.discounts || []).map((discount) => (
            <div key={discount.id} className="flex justify-between text-green-700">
              <span>
                {discount.is_shipping ? dict.cart.free_shipping : discount.name}
                {discount.is_automatic && (
                  <span className="ml-1 text-xs text-muted-foreground">({dict.cart.automatic_discount})</span>
                )}
              </span>
              <span>-{formatPrice(discount.amount, locale)}</span>
            </div>
          ))}
          {cart.shipping_total > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{dict.cart.shipping}</span>
              <span>{formatPrice(cart.shipping_total, locale)}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between border-t pt-4 text-lg font-semibold">
          <span>{dict.cart.total}</span>
          <Price amount={cart.total} locale={locale} />
        </div>
        <Link href="/checkout" className={buttonVariants({ size: "lg", className: "w-full" })}>
          {dict.cart.checkout}
        </Link>
        <Link href="/search" className="block text-center text-sm text-muted-foreground hover:underline">
          {dict.cart.continue_shopping}
        </Link>
      </aside>
    </div>
  )
}
