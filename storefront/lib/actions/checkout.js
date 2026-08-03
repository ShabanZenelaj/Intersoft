"use server"

import { revalidatePath } from "next/cache"
import { apiFetch } from "@/lib/api"
import { getAuthHeaders, getCartId, getLocale, removeCartId } from "@/lib/data/cookies"

/** Step 1: email + shipping address. The locale is stored so emails match it. */
export const setCheckoutDetails = async ({ email, address }) => {
  try {
    const cartId = await getCartId()
    const [locale, headers] = await Promise.all([getLocale(), getAuthHeaders()])
    const { cart } = await apiFetch(`/carts/${cartId}/details`, {
      method: "POST",
      headers,
      body: { email, address, locale },
    })
    revalidatePath("/checkout")
    return { cart }
  } catch (error) {
    return { error: error.message }
  }
}

/** Guest order tracking by order number + email. */
export const trackOrder = async (_state, formData) => {
  const displayId = String(formData.get("display_id") || "").replace(/\D/g, "")
  const email = String(formData.get("email") || "").trim()
  if (!displayId || !email) return { error: "missing_fields" }

  try {
    const { order } = await apiFetch("/orders/lookup", {
      method: "POST",
      body: { display_id: Number(displayId), email },
    })
    return { order }
  } catch {
    return { error: "not_found" }
  }
}

/**
 * Step 2: payment method (cod | pos | card). Shipping needs no step — it comes
 * from the products in the cart.
 */
export const initiatePayment = async (method) => {
  try {
    const cartId = await getCartId()
    await apiFetch(`/carts/${cartId}/payment`, { method: "POST", body: { method } })
    revalidatePath("/checkout")
    return { success: true }
  } catch (error) {
    return { error: error.message }
  }
}

/**
 * Step 3: place the order.
 *
 * Cash and POS orders are finished here. A card order is placed but not yet
 * paid — the API answers with the RaiAccept payment window to send the shopper
 * to, and the order is settled when the bank reports back.
 */
export const placeOrder = async () => {
  try {
    const cartId = await getCartId()
    const result = await apiFetch(`/carts/${cartId}/complete`, { method: "POST" })

    if (result.type === "payment_required") {
      // The cart is spent either way: the order exists from this point on.
      await removeCartId()
      revalidatePath("/", "layout")
      return { paymentUrl: result.payment_url, order: result.order }
    }

    if (result.type === "order") {
      await removeCartId()
      revalidatePath("/", "layout")
      return { order: result.order }
    }
    return { error: "Could not complete the order." }
  } catch (error) {
    return { error: error.message }
  }
}

/**
 * Asks our API whether the card payment has settled. The API in turn asks
 * RaiAccept, because the redirect the shopper arrived on proves nothing.
 */
export const checkPaymentStatus = async (orderId) => {
  try {
    return await apiFetch(`/payments/orders/${orderId}/status`)
  } catch {
    return { paid: false }
  }
}
