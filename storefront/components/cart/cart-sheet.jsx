"use client"

import Image from "next/image"
import Link from "next/link"
import { Minus, Plus, Trash2, X } from "lucide-react"
import { useTransition } from "react"
import { useCart } from "./cart-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import { Price } from "@/components/price"
import { useI18n } from "@/components/i18n-provider"
import { removeLineItem, updateLineItem } from "@/lib/actions/cart"
import { formatPrice } from "@/lib/utils"

const CartLine = ({ item, locale, dict }) => {
  const { setCart } = useCart()
  const [pending, startTransition] = useTransition()

  const changeQuantity = (quantity) => {
    startTransition(async () => {
      const result =
        quantity <= 0 ? await removeLineItem({ lineId: item.id }) : await updateLineItem({ lineId: item.id, quantity })
      if (result.cart !== undefined) setCart(result.cart)
    })
  }

  return (
    <div className="flex gap-4 py-4">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-secondary/30">
        {item.thumbnail && <Image src={item.thumbnail} alt={item.product_title || ""} fill className="object-cover" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link href={`/product/${item.product_handle}`} className="line-clamp-1 text-sm font-medium hover:underline">
          {item.product_title}
        </Link>
        {item.variant_title && item.variant_title !== "Default" && (
          <span className="text-xs text-muted-foreground">{item.variant_title}</span>
        )}
        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-md border">
            <button
              className="p-1.5 hover:bg-accent disabled:opacity-50"
              disabled={pending}
              onClick={() => changeQuantity(item.quantity - 1)}
              aria-label="Decrease quantity"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
            <button
              className="p-1.5 hover:bg-accent disabled:opacity-50"
              disabled={pending}
              onClick={() => changeQuantity(item.quantity + 1)}
              aria-label="Increase quantity"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <span className="text-sm font-semibold">{formatPrice(item.total, locale)}</span>
        </div>
      </div>
      <button
        className="self-start p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
        disabled={pending}
        onClick={() => changeQuantity(0)}
        aria-label={dict.cart.remove}
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  )
}

export const CartSheet = () => {
  const { cart, isOpen, closeCart, itemCount } = useCart()
  const { locale, dict } = useI18n()

  if (!isOpen) return null

  const items = cart?.items || []

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/40 animate-enter" onClick={closeCart} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-background shadow-2xl animate-slideInRight">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">
            {dict.cart.title} {itemCount > 0 && <span className="text-muted-foreground">({itemCount})</span>}
          </h2>
          <button onClick={closeCart} aria-label="Close cart" className="p-1 hover:bg-accent rounded-md">
            <X className="size-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-muted-foreground">{dict.cart.empty}</p>
            <Button onClick={closeCart}>{dict.cart.empty_cta}</Button>
          </div>
        ) : (
          <>
            <div className="flex-1 divide-y overflow-y-auto px-4">
              {items.map((item) => (
                <CartLine key={item.id} item={item} locale={locale} dict={dict} />
              ))}
            </div>
            <div className="space-y-3 border-t p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{dict.cart.subtotal}</span>
                <span className="font-medium">{formatPrice(cart?.item_total, locale)}</span>
              </div>
              {cart?.discount_total > 0 && (
                <div className="flex items-center justify-between text-sm text-green-700">
                  <span>{dict.cart.discount}</span>
                  <span>-{formatPrice(cart.discount_total, locale)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-base font-semibold">
                <span>{dict.cart.total}</span>
                <Price amount={cart?.total} locale={locale} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/cart"
                  onClick={closeCart}
                  className={buttonVariants({ variant: "outline", className: "w-full" })}
                >
                  {dict.cart.view_cart}
                </Link>
                <Link href="/checkout" onClick={closeCart} className={buttonVariants({ className: "w-full" })}>
                  {dict.cart.checkout}
                </Link>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
