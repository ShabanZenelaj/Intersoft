import "server-only"
import { cookies } from "next/headers"

const AUTH_COOKIE = "_intersoft_jwt"
const CART_COOKIE = "_intersoft_cart_id"
const LOCALE_COOKIE = "_intersoft_locale"

export const getAuthHeaders = async () => {
  const store = await cookies()
  const token = store.get(AUTH_COOKIE)?.value
  return token ? { authorization: `Bearer ${token}` } : {}
}

export const setAuthToken = async (token) => {
  const store = await cookies()
  store.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  })
}

export const removeAuthToken = async () => {
  const store = await cookies()
  store.set(AUTH_COOKIE, "", { maxAge: -1 })
}

export const getCartId = async () => {
  const store = await cookies()
  return store.get(CART_COOKIE)?.value
}

export const setCartId = async (cartId) => {
  const store = await cookies()
  store.set(CART_COOKIE, cartId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  })
}

export const removeCartId = async () => {
  const store = await cookies()
  store.set(CART_COOKIE, "", { maxAge: -1 })
}

/** Albanian is the store's primary language; English is the alternative. */
export const getLocale = async () => {
  const store = await cookies()
  const locale = store.get(LOCALE_COOKIE)?.value
  return locale === "en" ? "en" : "sq"
}

export const LOCALE_COOKIE_NAME = LOCALE_COOKIE
