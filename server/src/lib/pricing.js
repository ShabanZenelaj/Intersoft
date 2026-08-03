const { query } = require("../db")
const { money } = require("./util")

/**
 * Price resolution.
 *
 * Every variant has a base price. Price lists can beat it, and a list applies
 * to everyone, to one customer group, or to one specific customer. Each list
 * entry can require a minimum quantity, which gives volume tiers.
 *
 * When several lists match, the winner is:
 *   1. highest priority
 *   2. then the most specific target (customer > group > everyone)
 *   3. then the lowest price
 *
 * A "sale" list is shown as a discount from the base price; an "override"
 * list (typically a negotiated B2B price) becomes the price without pretending
 * anything is on sale.
 */

const SPECIFICITY = { customer: 3, group: 2, everyone: 1 }

/** The groups a customer belongs to. */
const getCustomerGroupIds = async (customerId) => {
  if (!customerId) return []
  const { rows } = await query("select group_id from customer_group_members where customer_id = $1", [customerId])
  return rows.map((row) => row.group_id)
}

/**
 * @param {string[]} variantIds
 * @param {object} context - { customerId, groupIds, quantities: Map(variantId -> qty) }
 * @returns Map(variantId -> { price, base, list, onSale, tiers })
 */
const resolvePrices = async (variantIds, context = {}) => {
  const result = new Map()
  if (!variantIds.length) return result

  const { customerId = null } = context
  const groupIds = context.groupIds || (await getCustomerGroupIds(customerId))
  const quantities = context.quantities || new Map()

  const { rows: variants } = await query("select id, price from variants where id = any($1::uuid[])", [variantIds])
  for (const variant of variants) {
    result.set(variant.id, {
      price: money(variant.price),
      base: money(variant.price),
      list: null,
      onSale: false,
      tiers: [],
    })
  }

  const { rows: candidates } = await query(
    `select plp.variant_id, plp.price, plp.min_quantity,
            pl.id as list_id, pl.name, pl.type, pl.priority,
            pl.customer_id, pl.customer_group_id
       from price_list_prices plp
       join price_lists pl on pl.id = plp.price_list_id
      where plp.variant_id = any($1::uuid[])
        and pl.is_active
        and (pl.starts_at is null or pl.starts_at <= now())
        and (pl.ends_at is null or pl.ends_at >= now())
        and (
          (pl.customer_id is null and pl.customer_group_id is null)
          or pl.customer_id = $2
          or pl.customer_group_id = any($3::uuid[])
        )`,
    [variantIds, customerId, groupIds]
  )

  for (const row of candidates) {
    const entry = result.get(row.variant_id)
    if (!entry) continue

    const target = row.customer_id ? "customer" : row.customer_group_id ? "group" : "everyone"
    const tier = {
      list_id: row.list_id,
      name: row.name,
      type: row.type,
      target,
      price: money(row.price),
      min_quantity: row.min_quantity,
      priority: row.priority,
    }
    entry.tiers.push(tier)

    // Only tiers the shopper actually qualifies for can set the price.
    const quantity = quantities.get(row.variant_id) ?? 1
    if (quantity < row.min_quantity) continue

    const current = entry.list
    const better =
      !current ||
      tier.priority > current.priority ||
      (tier.priority === current.priority && SPECIFICITY[tier.target] > SPECIFICITY[current.target]) ||
      (tier.priority === current.priority &&
        SPECIFICITY[tier.target] === SPECIFICITY[current.target] &&
        tier.price < entry.price)

    if (better) {
      entry.price = tier.price
      entry.list = tier
    }
  }

  for (const entry of result.values()) {
    entry.tiers.sort((a, b) => a.min_quantity - b.min_quantity)
    // A negotiated override is "your price", not a strike-through sale.
    entry.onSale = Boolean(entry.list && entry.list.type === "sale" && entry.price < entry.base)
  }

  return result
}

/** Next volume tier a shopper could unlock, for "buy N to pay X" hints. */
const nextTier = (entry, quantity) =>
  (entry?.tiers || [])
    .filter((tier) => tier.min_quantity > quantity && tier.price < entry.price)
    .sort((a, b) => a.min_quantity - b.min_quantity)[0] || null

module.exports = { resolvePrices, getCustomerGroupIds, nextTier }
