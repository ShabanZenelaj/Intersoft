import "server-only"
import { cache } from "react"
import { apiFetch } from "@/lib/api"

/** All active categories, flat. */
export const listCategories = cache(async () => {
  const { categories } = await apiFetch("/categories", {
    cache: "force-cache",
    next: { revalidate: 120 },
  })
  return categories || []
})

/** Top-level categories, each with a `children` array — for the nav and home page. */
export const getCategoryTree = cache(async () => {
  const categories = await listCategories()
  const byParent = new Map()
  for (const category of categories) {
    const key = category.parent_category_id || "root"
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(category)
  }
  return (byParent.get("root") || []).map((category) => ({
    ...category,
    children: byParent.get(category.id) || [],
  }))
})

export const getCategoryByHandle = cache(async (handle) => {
  const categories = await listCategories()
  return categories.find((category) => category.handle === handle) || null
})
