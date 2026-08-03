import "server-only"
import { cache } from "react"
import { apiFetch } from "@/lib/api"
import { getAuthHeaders } from "./cookies"

/**
 * Prices are personal: a signed-in customer may belong to a group (or have
 * their own price list), so catalog requests carry their token.
 */
const withCustomer = async (options = {}) => {
  const headers = await getAuthHeaders()
  if (!headers.authorization) return options
  return { ...options, headers: { ...(options.headers || {}), ...headers }, cache: "no-store" }
}

export const listProducts = cache(async ({ q, categoryId, limit = 100, offset = 0, order } = {}) => {
  const { products, count } = await apiFetch(
    "/products",
    await withCustomer({ query: { q, category_id: categoryId, limit, offset, order } })
  )
  return { products: products || [], count: count || 0 }
})

export const getProductByHandle = cache(async (handle) => {
  const { products } = await apiFetch("/products", await withCustomer({ query: { handle, limit: 1 } }))
  return products?.[0] || null
})

/** Products flagged with metadata.featured = "true", for the home page. */
export const getFeaturedProducts = cache(async (max = 8) => {
  const { products } = await listProducts({ limit: 100 })
  const featured = products.filter((product) => product.metadata?.featured === "true")
  const picked = featured.length >= 4 ? featured : products
  return picked.slice(0, max)
})

export const getNewestProducts = cache(async (max = 8) => {
  const { products } = await listProducts({ limit: max, order: "-created_at" })
  return products
})

export const getSimilarProducts = cache(async (product, max = 4) => {
  const categoryId = product.categories?.[0]?.id
  if (!categoryId) return []
  const { products } = await listProducts({ categoryId, limit: max + 1 })
  return products.filter((p) => p.id !== product.id).slice(0, max)
})
