import "server-only"
import { getProductPrice } from "@/lib/utils"
import { getCategoryByHandle, listCategories } from "./categories"
import { listProducts } from "./products"

export const PAGE_SIZE = 12

const SORTERS = {
  newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
  price_asc: (a, b) => (getProductPrice(a).amount ?? Infinity) - (getProductPrice(b).amount ?? Infinity),
  price_desc: (a, b) => (getProductPrice(b).amount ?? -Infinity) - (getProductPrice(a).amount ?? -Infinity),
  title: (a, b) => a.title.localeCompare(b.title),
}

/**
 * Server-side catalog engine for the listing pages: fetches matching products
 * from Medusa (search + category scoping), then applies brand/price/stock
 * filters, sorting, facet counts and pagination in memory. Plenty fast at this
 * catalog size; swap for Meilisearch/Algolia when the catalog grows.
 *
 * params: { q, category (handle), categories: [handle], brands: [name],
 *           minPrice, maxPrice, inStock, sort, page }
 */
export const searchCatalog = async (params = {}) => {
  const { q, category: categoryHandle } = params

  let scopeCategory = null
  if (categoryHandle) {
    scopeCategory = await getCategoryByHandle(categoryHandle)
  }

  // The server includes descendant categories when filtering by category_id.
  const { products: allProducts } = await listProducts({ q, categoryId: scopeCategory?.id, limit: 200 })

  // Facets are computed before price/brand filtering so counts stay stable.
  const brandFacet = new Map()
  const categoryFacet = new Map()
  let priceMin = null
  let priceMax = null
  for (const product of allProducts) {
    const brand = product.metadata?.brand
    if (brand) brandFacet.set(brand, (brandFacet.get(brand) || 0) + 1)
    for (const category of product.categories || []) {
      categoryFacet.set(category.handle, (categoryFacet.get(category.handle) || 0) + 1)
    }
    const { amount } = getProductPrice(product)
    if (amount !== null) {
      priceMin = priceMin === null ? amount : Math.min(priceMin, amount)
      priceMax = priceMax === null ? amount : Math.max(priceMax, amount)
    }
  }

  const selectedCategories = params.categories || []
  const selectedBrands = params.brands || []
  const minPrice = params.minPrice !== undefined && params.minPrice !== "" ? Number(params.minPrice) : null
  const maxPrice = params.maxPrice !== undefined && params.maxPrice !== "" ? Number(params.maxPrice) : null

  let filtered = allProducts
  if (selectedCategories.length) {
    filtered = filtered.filter((product) =>
      (product.categories || []).some((category) => selectedCategories.includes(category.handle))
    )
  }
  if (selectedBrands.length) {
    filtered = filtered.filter((product) => selectedBrands.includes(product.metadata?.brand))
  }
  if (minPrice !== null && !Number.isNaN(minPrice)) {
    filtered = filtered.filter((product) => (getProductPrice(product).amount ?? 0) >= minPrice)
  }
  if (maxPrice !== null && !Number.isNaN(maxPrice)) {
    filtered = filtered.filter((product) => (getProductPrice(product).amount ?? Infinity) <= maxPrice)
  }
  if (params.inStock) {
    filtered = filtered.filter((product) =>
      (product.variants || []).some((variant) => !variant.manage_inventory || variant.inventory_quantity > 0)
    )
  }

  const sorter = SORTERS[params.sort] || null
  if (sorter) filtered = [...filtered].sort(sorter)

  const totalHits = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalHits / PAGE_SIZE))
  const page = Math.min(Math.max(1, Number(params.page) || 1), totalPages)
  const hits = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Category facet entries need names (and metadata, for Albanian names).
  const allCategories = await listCategories()
  const categoryByHandle = new Map(allCategories.map((category) => [category.handle, category]))

  return {
    scopeCategory,
    hits,
    totalHits,
    totalPages,
    page,
    facets: {
      brands: [...brandFacet.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count })),
      categories: [...categoryFacet.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([handle, count]) => {
          const category = categoryByHandle.get(handle)
          return { handle, name: category?.name || handle, metadata: category?.metadata || {}, count }
        }),
      priceMin,
      priceMax,
    },
  }
}
