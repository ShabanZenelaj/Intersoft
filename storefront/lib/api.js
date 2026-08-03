import { headers as requestHeaders } from "next/headers"

export const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://127.0.0.1:9000"

/**
 * The shopper's address, passed along so the API can tell customers apart.
 *
 * These pages render on the server, so every call to the API leaves from this
 * machine. Without this the API would see one client for the whole shop and
 * its rate limits would apply to everyone at once.
 *
 * Returns null outside a request (during a build, say), where there is no
 * shopper to speak of.
 */
const shopperAddress = async () => {
  try {
    const incoming = await requestHeaders()
    const forwarded = incoming.get("x-forwarded-for")
    if (forwarded) return forwarded.split(",")[0].trim()
    return incoming.get("x-real-ip")
  } catch {
    return null
  }
}

/**
 * Minimal client for the Intersoft store API (server/src/routes/store.js).
 * Throws Error(message) on non-2xx responses.
 */
export const apiFetch = async (path, { method = "GET", body, headers = {}, query, ...init } = {}) => {
  const url = new URL(`/api/store${path}`, BACKEND_URL)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value)
    }
  }
  const address = await shopperAddress()
  const response = await fetch(url, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(address ? { "x-shopper-address": address } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    ...init,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`)
  }
  return data
}
