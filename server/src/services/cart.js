const { query } = require("../db")
const { resolvePrices, getCustomerGroupIds, nextTier } = require("../lib/pricing")
const { money } = require("../lib/util")
const campaigns = require("./campaigns")

/** Fallback used when a product has no shipping option assigned. */
const defaultShippingMethod = async () => {
  const { rows } = await query(
    `select id, name, name_sq, description, description_sq, price from shipping_methods
      where is_active order by sort_order, price limit 1`
  )
  return rows[0] || null
}

/**
 * Shipping is a property of the product (set from its supplier), not a
 * customer choice. Each distinct shipping option in the cart is charged once —
 * one shipment per supplier — so mixing a same-day item with a slow one costs
 * both fees, which is what actually happens when reselling.
 */
const buildShipments = async (items) => {
  if (!items.length) return { shipments: [], total: 0 }

  const methodIds = [...new Set(items.map((item) => item.shipping_method_id).filter(Boolean))]
  const { rows: methods } = methodIds.length
    ? await query(
        "select id, name, name_sq, description, description_sq, price from shipping_methods where id = any($1::uuid[])",
        [methodIds]
      )
    : { rows: [] }
  const methodById = new Map(methods.map((method) => [method.id, method]))

  let fallback = null
  if (items.some((item) => !item.shipping_method_id || !methodById.has(item.shipping_method_id))) {
    fallback = await defaultShippingMethod()
  }

  const byMethod = new Map()
  for (const item of items) {
    const method = methodById.get(item.shipping_method_id) || fallback
    if (!method) continue
    if (!byMethod.has(method.id)) {
      byMethod.set(method.id, {
        shipping_method_id: method.id,
        name: method.name,
        name_sq: method.name_sq || "",
        description: method.description || "",
        description_sq: method.description_sq || "",
        amount: money(method.price),
        products: [],
      })
    }
    byMethod.get(method.id).products.push(item.product_title)
  }

  const shipments = [...byMethod.values()]
  return { shipments, total: money(shipments.reduce((sum, shipment) => sum + shipment.amount, 0)) }
}

/**
 * Loads a cart with customer-aware prices, shipments, campaigns and totals.
 * The JSON shape matches what the storefront cart UI consumes.
 */
const getCart = async (cartId) => {
  const { rows: carts } = await query("select * from carts where id = $1", [cartId])
  const cart = carts[0]
  if (!cart) return null

  const { rows: items } = await query(
    `select ci.id, ci.variant_id, ci.quantity,
            v.title as variant_title, v.sku, v.stock, v.manage_stock,
            p.id as product_id, p.title as product_title, p.handle as product_handle,
            p.category_id, p.thumbnail, p.images, p.shipping_method_id
       from cart_items ci
       join variants v on v.id = ci.variant_id
       join products p on p.id = v.product_id
      where ci.cart_id = $1
      order by ci.id`,
    [cartId]
  )

  // Prices depend on who is shopping and how many they take.
  const groupIds = await getCustomerGroupIds(cart.customer_id)
  const quantities = new Map(items.map((item) => [item.variant_id, item.quantity]))
  const prices = await resolvePrices(
    items.map((item) => item.variant_id),
    { customerId: cart.customer_id, groupIds, quantities }
  )

  let subtotal = 0
  const jsonItems = items.map((item) => {
    const price = prices.get(item.variant_id) || { price: 0, base: 0, list: null, onSale: false, tiers: [] }
    const total = money(price.price * item.quantity)
    subtotal = money(subtotal + total)
    const upcoming = nextTier(price, item.quantity)
    return {
      id: item.id,
      variant_id: item.variant_id,
      product_id: item.product_id,
      category_id: item.category_id,
      product_title: item.product_title,
      product_handle: item.product_handle,
      variant_title: item.variant_title,
      sku: item.sku,
      thumbnail: item.thumbnail || (item.images || [])[0] || null,
      unit_price: price.price,
      original_unit_price: price.base,
      on_sale: price.onSale,
      next_tier: upcoming ? { min_quantity: upcoming.min_quantity, price: upcoming.price } : null,
      quantity: item.quantity,
      stock: item.manage_stock ? item.stock : null,
      total,
    }
  })

  const { shipments, total: shippingTotal } = await buildShipments(items)

  const context = {
    customer_id: cart.customer_id,
    email: cart.email,
    promo_code: cart.promo_code,
    lines: jsonItems.map((item) => ({
      product_id: item.product_id,
      category_id: item.category_id,
      quantity: item.quantity,
      total: item.total,
    })),
  }
  const { discounts, total: discountTotal, shippingDiscount } = await campaigns.collectDiscounts(context, {
    groupIds,
    shippingTotal,
  })

  return {
    id: cart.id,
    customer_id: cart.customer_id,
    email: cart.email,
    status: cart.status,
    locale: cart.locale,
    currency_code: "eur",
    items: jsonItems,
    item_total: subtotal,
    subtotal,
    discount_total: discountTotal,
    discounts,
    promotions: discounts.filter((discount) => discount.code).map((discount) => ({ id: discount.id, code: discount.code })),
    promo_code: cart.promo_code,
    shipping_address: cart.shipping_address,
    shipping_methods: shipments,
    shipping_total: shippingTotal,
    shipping_discount: shippingDiscount,
    payment_method: cart.payment_method,
    tax_total: 0,
    total: money(Math.max(0, subtotal - discountTotal + shippingTotal)),
  }
}

/** Cart context used by the campaign engine before a cart row exists. */
const cartContext = (cart) => ({
  customer_id: cart.customer_id,
  email: cart.email,
  promo_code: cart.promo_code,
  lines: (cart.items || []).map((item) => ({
    product_id: item.product_id,
    category_id: item.category_id,
    quantity: item.quantity,
    total: item.total,
  })),
})

module.exports = { getCart, buildShipments, cartContext }
