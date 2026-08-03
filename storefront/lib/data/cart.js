import "server-only"
import { apiFetch } from "@/lib/api"
import { getCartId } from "./cookies"

export const retrieveCart = async () => {
  const cartId = await getCartId()
  if (!cartId) return null
  try {
    const { cart } = await apiFetch(`/carts/${cartId}`, { cache: "no-store" })
    return cart
  } catch {
    return null
  }
}

export const listShippingOptions = async () => {
  const { shipping_options } = await apiFetch("/shipping-methods", { cache: "no-store" })
  return shipping_options || []
}

/** Payment methods offered at checkout (implemented server-side). */
export const PAYMENT_METHODS = ["cod", "pos", "card"]
