"use server"

import { revalidatePath } from "next/cache"
import { apiFetch } from "@/lib/api"
import { retrieveCart } from "@/lib/data/cart"
import { getAuthHeaders, getCartId, removeCartId, setCartId } from "@/lib/data/cookies"

const refreshCartPaths = () => {
  revalidatePath("/", "layout")
}

const getOrCreateCartId = async () => {
  const existing = await getCartId()
  if (existing) {
    const cart = await retrieveCart()
    if (cart) return cart.id
  }
  const headers = await getAuthHeaders()
  const { cart } = await apiFetch("/carts", { method: "POST", headers })
  await setCartId(cart.id)
  return cart.id
}

export const addToCart = async ({ variantId, quantity = 1 }) => {
  try {
    const cartId = await getOrCreateCartId()
    const { cart } = await apiFetch(`/carts/${cartId}/items`, {
      method: "POST",
      body: { variant_id: variantId, quantity },
    })
    refreshCartPaths()
    return { cart }
  } catch (error) {
    return { error: error.message }
  }
}

export const updateLineItem = async ({ lineId, quantity }) => {
  try {
    const cartId = await getCartId()
    const { cart } = await apiFetch(`/carts/${cartId}/items/${lineId}`, {
      method: "PATCH",
      body: { quantity },
    })
    refreshCartPaths()
    return { cart }
  } catch (error) {
    return { error: error.message }
  }
}

export const removeLineItem = async ({ lineId }) => {
  try {
    const cartId = await getCartId()
    const { cart } = await apiFetch(`/carts/${cartId}/items/${lineId}`, { method: "DELETE" })
    refreshCartPaths()
    return { cart }
  } catch (error) {
    return { error: error.message }
  }
}

export const applyPromoCode = async (code) => {
  try {
    const cartId = await getCartId()
    const { cart } = await apiFetch(`/carts/${cartId}/promotions`, {
      method: "POST",
      body: { code },
    })
    refreshCartPaths()
    return { cart }
  } catch (error) {
    return { error: error.message, cart: await retrieveCart() }
  }
}

export const removePromoCode = async () => {
  try {
    const cartId = await getCartId()
    const { cart } = await apiFetch(`/carts/${cartId}/promotions`, { method: "DELETE" })
    refreshCartPaths()
    return { cart }
  } catch (error) {
    return { error: error.message }
  }
}

export const getCart = async () => {
  return retrieveCart()
}

export const clearCartCookie = async () => {
  await removeCartId()
}
