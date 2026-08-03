import "server-only"
import { apiFetch } from "@/lib/api"
import { getAuthHeaders } from "./cookies"

/**
 * Campaigns are personal: one limited to a customer group is invisible to
 * everyone else, so every request carries the shopper's token.
 */
const withCustomer = async (options = {}) => {
  const headers = await getAuthHeaders()
  return {
    ...options,
    headers: { ...(options.headers || {}), ...headers },
    cache: "no-store",
  }
}

/** Banners the shopper may see on the home page. */
export const listHomeBanners = async () => {
  try {
    const { campaigns } = await apiFetch("/campaigns", await withCustomer({ query: { banners: "true" } }))
    return campaigns || []
  } catch {
    return []
  }
}

/** A campaign and the products it covers; null when it isn't visible. */
export const getCampaign = async (handle) => {
  try {
    return await apiFetch(`/campaigns/${encodeURIComponent(handle)}`, await withCustomer())
  } catch {
    return null
  }
}
