import "server-only"
import { apiFetch } from "@/lib/api"
import { getAuthHeaders } from "./cookies"

export const getCustomer = async () => {
  const headers = await getAuthHeaders()
  if (!headers.authorization) return null
  try {
    const { customer } = await apiFetch("/customers/me", { headers, cache: "no-store" })
    return customer
  } catch {
    return null
  }
}

export const listOrders = async ({ limit = 10, offset = 0, status } = {}) => {
  const headers = await getAuthHeaders()
  if (!headers.authorization) return { orders: [], count: 0 }
  try {
    const { orders, count } = await apiFetch("/orders", {
      query: { limit, offset, ...(status ? { status } : {}) },
      headers,
      cache: "no-store",
    })
    return { orders: orders || [], count: count || 0 }
  } catch {
    return { orders: [], count: 0 }
  }
}

/** Totals across every order, for the account overview tiles. */
export const getOrderSummary = async () => {
  const headers = await getAuthHeaders()
  if (!headers.authorization) return { orders_count: 0, active_count: 0, total_spent: 0 }
  try {
    return await apiFetch("/customers/me/summary", { headers, cache: "no-store" })
  } catch {
    return { orders_count: 0, active_count: 0, total_spent: 0 }
  }
}

export const getOrder = async (id) => {
  try {
    const { order } = await apiFetch(`/orders/${id}`, { cache: "no-store" })
    return order
  } catch {
    return null
  }
}
