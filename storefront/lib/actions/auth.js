"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { getAuthHeaders, getCartId, getLocale, removeAuthToken, setAuthToken } from "@/lib/data/cookies"

const transferCartToCustomer = async () => {
  try {
    const cartId = await getCartId()
    if (!cartId) return
    const headers = await getAuthHeaders()
    await apiFetch(`/carts/${cartId}/customer`, { method: "POST", headers })
  } catch {
    // Non-fatal: the guest cart simply stays a guest cart.
  }
}

/** Only allow in-app redirects, never an absolute URL from the query string. */
const safeNext = (value, fallback = "/account") => {
  const next = String(value || "")
  return next.startsWith("/") && !next.startsWith("//") ? next : fallback
}

export const register = async (_state, formData) => {
  const email = String(formData.get("email") || "").trim()
  const password = String(formData.get("password") || "")
  const firstName = String(formData.get("first_name") || "").trim()
  const lastName = String(formData.get("last_name") || "").trim()
  const phone = String(formData.get("phone") || "").trim()
  const claimOrderId = String(formData.get("claim_order_id") || "").trim()
  const next = safeNext(formData.get("next"))

  if (!email || !password || !firstName || !lastName) {
    return { error: "missing_fields" }
  }
  if (password.length < 8) {
    return { error: "password_too_short" }
  }

  try {
    const locale = await getLocale()
    const { token } = await apiFetch("/auth/register", {
      method: "POST",
      body: { email, password, first_name: firstName, last_name: lastName, phone: phone || undefined, locale },
    })
    await setAuthToken(token)
    await transferCartToCustomer()

    // Came from an order confirmation page: attach that order too (it may
    // have been placed with a different email than the account).
    if (claimOrderId) {
      const headers = await getAuthHeaders()
      await apiFetch(`/orders/${claimOrderId}/claim`, { method: "POST", headers }).catch(() => {})
    }
  } catch {
    return { error: "registration_failed" }
  }

  revalidatePath("/", "layout")
  redirect(next)
}

export const login = async (_state, formData) => {
  const email = String(formData.get("email") || "").trim()
  const password = String(formData.get("password") || "")
  const next = safeNext(formData.get("next"))

  try {
    const { token } = await apiFetch("/auth/login", { method: "POST", body: { email, password } })
    await setAuthToken(token)
    await transferCartToCustomer()
  } catch {
    return { error: "invalid_credentials" }
  }

  revalidatePath("/", "layout")
  redirect(next)
}

export const requestPasswordReset = async (_state, formData) => {
  const email = String(formData.get("email") || "").trim()
  if (!email) return { error: "missing_fields" }
  try {
    const locale = await getLocale()
    await apiFetch("/auth/forgot-password", { method: "POST", body: { email, locale } })
  } catch {
    // The endpoint always succeeds; treat transport errors as sent too so the
    // form never reveals whether an account exists.
  }
  return { success: true }
}

export const resetPassword = async (_state, formData) => {
  const token = String(formData.get("token") || "")
  const password = String(formData.get("password") || "")
  const confirm = String(formData.get("confirm_password") || "")

  if (password.length < 8) return { error: "password_too_short" }
  if (password !== confirm) return { error: "passwords_mismatch" }

  try {
    const { token: authToken } = await apiFetch("/auth/reset-password", {
      method: "POST",
      body: { token, password },
    })
    await setAuthToken(authToken)
  } catch {
    return { error: "reset_link_invalid" }
  }

  revalidatePath("/", "layout")
  redirect("/account")
}

export const logout = async () => {
  await removeAuthToken()
  revalidatePath("/", "layout")
  redirect("/")
}

export const updateProfile = async (_state, formData) => {
  const headers = await getAuthHeaders()
  if (!headers.authorization) return { error: "not_authenticated" }

  const address = {
    first_name: String(formData.get("address_first_name") || "").trim(),
    last_name: String(formData.get("address_last_name") || "").trim(),
    address_1: String(formData.get("address_1") || "").trim(),
    city: String(formData.get("city") || "").trim(),
    postal_code: String(formData.get("postal_code") || "").trim(),
    country_code: String(formData.get("country_code") || "al").trim(),
    phone: String(formData.get("address_phone") || "").trim(),
  }
  const hasAddress = address.address_1 && address.city

  try {
    await apiFetch("/customers/me", {
      method: "PATCH",
      headers,
      body: {
        first_name: String(formData.get("first_name") || "").trim(),
        last_name: String(formData.get("last_name") || "").trim(),
        phone: String(formData.get("phone") || "").trim() || null,
        default_address: hasAddress ? address : undefined,
      },
    })
    revalidatePath("/account")
    return { success: true }
  } catch (error) {
    return { error: error.message }
  }
}

/** Puts every line of a past order back in the cart. */
export const reorder = async (orderId) => {
  const headers = await getAuthHeaders()
  try {
    const { order } = await apiFetch(`/orders/${orderId}`, { headers })
    const { addToCart } = await import("./cart")
    let added = 0
    for (const item of order.items || []) {
      const result = await addToCart({ variantId: item.variant_id, quantity: item.quantity })
      if (!result.error) added++
    }
    if (!added) return { error: "unavailable" }
    revalidatePath("/", "layout")
    return { added, total: (order.items || []).length }
  } catch (error) {
    return { error: error.message }
  }
}

export const updatePassword = async (_state, formData) => {
  const headers = await getAuthHeaders()
  if (!headers.authorization) return { error: "not_authenticated" }

  const password = String(formData.get("password") || "")
  const confirm = String(formData.get("confirm_password") || "")
  if (password.length < 8) return { error: "password_too_short" }
  if (password !== confirm) return { error: "passwords_mismatch" }

  try {
    await apiFetch("/customers/me/password", { method: "POST", headers, body: { password } })
    return { success: true }
  } catch (error) {
    return { error: error.message }
  }
}
