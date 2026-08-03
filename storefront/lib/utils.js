import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export const cn = (...inputs) => twMerge(clsx(inputs))

/**
 * Deterministic EUR formatting (identical on server and client — Intl output
 * can differ between Node and the browser and cause hydration mismatches).
 * en: €1,299.00 · sq: 1.299,00 €
 */
export const formatPrice = (amount, locale = "sq") => {
  if (amount === null || amount === undefined) return ""
  const [int, dec] = Number(amount).toFixed(2).split(".")
  if (locale === "sq") {
    return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec} €`
  }
  return `€${int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${dec}`
}

/**
 * Price shown for a variant. The API sends the resolved amount only — how it
 * was arrived at (price list, customer group) stays on the server. `tiers`
 * lists the volume breaks the shopper can still unlock.
 */
export const getVariantPrice = (variant) => {
  const calculated = variant?.calculated_price
  if (!calculated) return { amount: null, originalAmount: null, onSale: false, tiers: [] }
  const amount = calculated.calculated_amount
  const originalAmount = calculated.original_amount
  return {
    amount,
    originalAmount,
    onSale: calculated.on_sale ?? (originalAmount !== null && amount !== null && amount < originalAmount),
    tiers: calculated.tiers || [],
  }
}

/** Cheapest variant price of a product. */
export const getProductPrice = (product) => {
  const prices = (product?.variants || []).map(getVariantPrice).filter((price) => price.amount !== null)
  if (!prices.length) return { amount: null, originalAmount: null, onSale: false, tiers: [] }
  return prices.reduce((min, price) => (price.amount < min.amount ? price : min), prices[0])
}

/**
 * Applies Albanian product content (title_sq / description_sq from metadata)
 * when the shopper is browsing in Albanian, falling back to the base fields.
 */
export const translateProduct = (product, locale) => {
  if (!product || locale !== "sq") return product
  const metadata = product.metadata || {}
  return {
    ...product,
    title: metadata.title_sq || product.title,
    description: metadata.description_sq || product.description,
  }
}

/** Albanian category name (metadata.name_sq) with an English fallback. */
export const translateCategory = (category, locale) => {
  if (!category || locale !== "sq") return category
  const metadata = category.metadata || {}
  return {
    ...category,
    name: metadata.name_sq || category.name,
    description: metadata.description_sq || category.description,
    children: category.children?.map((child) => translateCategory(child, locale)),
  }
}

/**
 * Deterministic dates (sq: 25.07.2026, en: 25/07/2026). Intl output differs
 * between Node and the browser, which would desync server and client render.
 */
export const formatDate = (value, locale = "sq") => {
  const date = new Date(value)
  const pad = (number) => String(number).padStart(2, "0")
  const parts = [pad(date.getDate()), pad(date.getMonth() + 1), date.getFullYear()]
  return locale === "en" ? parts.join("/") : parts.join(".")
}

export const formatDateTime = (value, locale = "sq") => {
  const date = new Date(value)
  const pad = (number) => String(number).padStart(2, "0")
  return `${formatDate(value, locale)}, ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Shipment/shipping-method label in the shopper's language. */
export const shipmentName = (shipment, locale) =>
  (locale === "sq" && shipment?.name_sq) || shipment?.name || ""

export const shipmentDescription = (shipment, locale) =>
  (locale === "sq" && shipment?.description_sq) || shipment?.description || ""

export const productImage = (product) =>
  product?.thumbnail || product?.images?.[0]?.url || "/default-product-image.svg"

/** "1 item" / "3 items" — both dictionaries carry the singular and plural. */
export const itemCount = (count, dict) => `${count} ${count === 1 ? dict.cart.item : dict.cart.items}`
