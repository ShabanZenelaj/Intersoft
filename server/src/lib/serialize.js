const { money } = require("./util")

/**
 * JSON shapes intentionally mirror what the storefront's data layer already
 * consumes (originally modeled on Medusa's store API), so swapping backends
 * required no page/component changes.
 */

const categoryToJson = (category) => ({
  id: category.id,
  name: category.name,
  handle: category.handle,
  description: category.description,
  parent_category_id: category.parent_id,
  sort_order: category.sort_order,
  is_active: category.is_active,
  metadata: { ...category.metadata, image: category.image_url || category.metadata?.image },
})

const variantToJson = (variant, priceEntry) => ({
  id: variant.id,
  title: variant.title,
  sku: variant.sku,
  manage_inventory: variant.manage_stock,
  inventory_quantity: variant.stock,
  options: Object.entries(variant.options || {}).map(([title, value]) => ({ option: { title }, value })),
  // Only the resulting price is public. Which price list or customer group
  // produced it is internal and deliberately never leaves the server.
  calculated_price: priceEntry
    ? {
        calculated_amount: priceEntry.price,
        original_amount: priceEntry.base,
        currency_code: "eur",
        on_sale: priceEntry.onSale,
        // Volume tiers a shopper can unlock by buying more.
        tiers: (priceEntry.tiers || [])
          .filter((tier) => tier.min_quantity > 1)
          .map((tier) => ({ min_quantity: tier.min_quantity, price: tier.price })),
      }
    : null,
})

const productToJson = (product, variants, prices, category) => ({
  id: product.id,
  title: product.title,
  handle: product.handle,
  description: product.description,
  thumbnail: product.thumbnail || (product.images || [])[0] || null,
  images: (product.images || []).map((url, index) => ({ id: `${product.id}-${index}`, url })),
  options: (product.options || []).map((option) => ({
    id: `${product.id}-${option.title}`,
    title: option.title,
    values: (option.values || []).map((value) => ({ value })),
  })),
  tags: (product.tags || []).map((value) => ({ value })),
  categories: category
    ? [{ id: category.id, name: category.name, handle: category.handle, metadata: category.metadata || {} }]
    : [],
  metadata: { ...product.metadata, brand: product.brand || product.metadata?.brand },
  status: product.status,
  brand: product.brand,
  weight: product.weight,
  supplier_id: product.supplier_id,
  category_id: product.category_id,
  shipping_method_id: product.shipping_method_id,
  shipping_method: product.shipping_method_name
    ? {
        id: product.shipping_method_id,
        name: product.shipping_method_name,
        name_sq: product.shipping_method_name_sq || "",
        price: money(product.shipping_method_price),
      }
    : null,
  created_at: product.created_at,
  updated_at: product.updated_at,
  variants: variants.map((variant) => variantToJson(variant, prices.get(variant.id))),
})

const orderToJson = (order, events = null) => ({
  id: order.id,
  display_id: order.display_id,
  email: order.email,
  customer_id: order.customer_id,
  status: order.status,
  fulfillment_status: order.status,
  payment_status: order.payment_status,
  payment_method: order.payment_method,
  currency_code: "eur",
  items: (order.items || []).map((item, index) => ({ id: `${order.id}-${index}`, ...item })),
  shipping_address: order.shipping_address,
  // Snapshot holds one entry per shipment (one per distinct shipping option).
  shipping_methods: (Array.isArray(order.shipping_method)
    ? order.shipping_method
    : [order.shipping_method].filter(Boolean)
  ).map((shipment) => ({
    name: shipment.name,
    name_sq: shipment.name_sq || "",
    amount: money(shipment.price || 0),
    products: shipment.products || [],
  })),
  subtotal: money(order.subtotal),
  item_total: money(order.subtotal),
  discount_total: money(order.discount_total),
  discounts: order.discounts || [],
  promo_code: order.promo_code,
  shipping_total: money(order.shipping_total),
  refunded_total: money(order.refunded_total),
  total: money(order.total),
  created_at: order.created_at,
  updated_at: order.updated_at,
  ...(events ? { events } : {}),
})

module.exports = { categoryToJson, variantToJson, productToJson, orderToJson }
