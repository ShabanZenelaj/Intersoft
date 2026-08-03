"use client"

import { RotateCcw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"
import { useCart } from "@/components/cart/cart-provider"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { reorder } from "@/lib/actions/auth"
import { getCart } from "@/lib/actions/cart"

export const ReorderButton = ({ orderId }) => {
  const { dict } = useI18n()
  const { setCart, openCart } = useCart()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const onClick = () => {
    startTransition(async () => {
      const result = await reorder(orderId)
      if (result.error) {
        toast.error(dict.order.reorder_failed)
        return
      }
      setCart(await getCart())
      toast.success(dict.order.reorder_done)
      openCart()
      router.refresh()
    })
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick} isLoading={pending}>
      <RotateCcw className="size-4" />
      {dict.order.reorder}
    </Button>
  )
}
