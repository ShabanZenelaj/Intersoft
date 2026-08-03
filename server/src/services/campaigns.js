const { query } = require("../db")
const { money } = require("../lib/util")

/**
 * Campaign engine.
 *
 * A campaign is a discount plus conditions. Conditions are checked against
 * the cart (subtotal, quantity, who the customer is, how often the code has
 * been used) and the discount is applied to whatever the campaign targets:
 * the whole order, the lines in given categories, given products, or shipping.
 *
 * Automatic campaigns need no code and apply on their own; a customer may
 * additionally enter one code. Everything that applies is summed, and the
 * total can never exceed the value it discounts.
 */

const loadCampaign = async (where, params) => {
  const { rows } = await query(`select * from campaigns where ${where} limit 1`, params)
  return rows[0] || null
}

const withinWindow = (campaign) => {
  const now = new Date()
  if (campaign.starts_at && new Date(campaign.starts_at) > now) return false
  if (campaign.ends_at && new Date(campaign.ends_at) < now) return false
  return true
}

/**
 * Choosing a category means its subcategories too — picking "Components"
 * has to cover "Graphics Cards", which is where the products actually sit.
 */
const expandCategories = async (categoryIds) => {
  if (!categoryIds?.length) return []
  const { rows } = await query(
    `with recursive tree as (
       select id from categories where id = any($1::uuid[])
       union all
       select c.id from categories c join tree t on c.parent_id = t.id
     )
     select distinct id from tree`,
    [categoryIds]
  )
  return rows.map((row) => row.id)
}

/** Lines a campaign applies to, given its scope. */
const matchingLines = async (campaign, lines) => {
  if (campaign.applies_to === "category") {
    const categories = await expandCategories(campaign.category_ids)
    return lines.filter((line) => categories.includes(line.category_id))
  }
  if (campaign.applies_to === "product") {
    const products = campaign.product_ids || []
    return lines.filter((line) => products.includes(line.product_id))
  }
  return lines
}

/**
 * Checks every condition. Returns { ok: true, discount, lines } or
 * { ok: false, reason } where reason is a translatable key.
 */
const evaluate = async (campaign, cart, options = {}) => {
  if (!campaign.is_active) return { ok: false, reason: "invalid_code" }
  if (!withinWindow(campaign)) return { ok: false, reason: "expired" }

  if (campaign.usage_limit !== null && campaign.used_count >= campaign.usage_limit) {
    return { ok: false, reason: "usage_limit_reached" }
  }

  if (campaign.customer_group_id) {
    const groupIds = options.groupIds || []
    if (!groupIds.includes(campaign.customer_group_id)) return { ok: false, reason: "not_eligible" }
  }

  if (campaign.usage_limit_per_customer !== null && (cart.customer_id || cart.email)) {
    const { rows } = await query(
      `select count(*)::int as count from campaign_redemptions
        where campaign_id = $1 and (customer_id = $2 or lower(email) = lower($3))`,
      [campaign.id, cart.customer_id, cart.email || ""]
    )
    if (rows[0].count >= campaign.usage_limit_per_customer) {
      return { ok: false, reason: "already_used" }
    }
  }

  const lines = await matchingLines(campaign, cart.lines || [])
  if (!lines.length) return { ok: false, reason: "no_matching_items" }

  const scopeTotal = money(lines.reduce((sum, line) => sum + line.total, 0))
  const scopeQuantity = lines.reduce((sum, line) => sum + line.quantity, 0)

  if (money(campaign.min_subtotal) > 0 && scopeTotal < money(campaign.min_subtotal)) {
    return { ok: false, reason: "min_subtotal", min: money(campaign.min_subtotal) }
  }
  if (campaign.min_quantity > 0 && scopeQuantity < campaign.min_quantity) {
    return { ok: false, reason: "min_quantity", min: campaign.min_quantity }
  }

  let discount = 0
  if (campaign.type === "free_shipping" || campaign.applies_to === "shipping") {
    discount = money(options.shippingTotal || 0)
  } else if (campaign.type === "percentage") {
    discount = money((scopeTotal * money(campaign.value)) / 100)
  } else {
    discount = money(Math.min(money(campaign.value), scopeTotal))
  }

  if (discount <= 0) return { ok: false, reason: "no_matching_items" }
  return { ok: true, discount, scopeTotal, lines }
}

/** Validates a code against the cart, for the "apply code" endpoint. */
const checkCode = async (code, cart, options = {}) => {
  const campaign = await loadCampaign("lower(code) = lower($1)", [String(code || "")])
  if (!campaign) return { error: "invalid_code" }
  const result = await evaluate(campaign, cart, options)
  if (!result.ok) return { error: result.reason, min: result.min }
  return { campaign, ...result }
}

/**
 * All discounts for a cart: every automatic campaign that qualifies, plus the
 * entered code. Returns { discounts: [...], total, shippingDiscount }.
 */
const collectDiscounts = async (cart, options = {}) => {
  const { rows: automatic } = await query("select * from campaigns where is_automatic and is_active order by id")

  const applied = []
  let shippingDiscount = 0

  for (const campaign of automatic) {
    const result = await evaluate(campaign, cart, options)
    if (!result.ok) continue
    applied.push({ campaign, discount: result.discount })
  }

  if (cart.promo_code) {
    const result = await checkCode(cart.promo_code, cart, options)
    if (!result.error) applied.push({ campaign: result.campaign, discount: result.discount })
  }

  const discounts = []
  let itemsDiscount = 0
  const itemsTotal = money((cart.lines || []).reduce((sum, line) => sum + line.total, 0))

  for (const entry of applied) {
    const isShipping = entry.campaign.type === "free_shipping" || entry.campaign.applies_to === "shipping"
    if (isShipping) {
      const amount = money(Math.min(entry.discount, money(options.shippingTotal || 0) - shippingDiscount))
      if (amount <= 0) continue
      shippingDiscount = money(shippingDiscount + amount)
      discounts.push(describe(entry.campaign, amount, true))
    } else {
      const amount = money(Math.min(entry.discount, itemsTotal - itemsDiscount))
      if (amount <= 0) continue
      itemsDiscount = money(itemsDiscount + amount)
      discounts.push(describe(entry.campaign, amount, false))
    }
  }

  return { discounts, total: money(itemsDiscount + shippingDiscount), itemsDiscount, shippingDiscount }
}

const describe = (campaign, amount, isShipping) => ({
  id: campaign.id,
  code: campaign.code,
  name: campaign.name || campaign.code,
  type: campaign.type,
  applies_to: campaign.applies_to,
  is_automatic: campaign.is_automatic,
  amount,
  is_shipping: isShipping,
})

/** Records usage once an order is placed (inside the order transaction). */
const recordRedemptions = async (client, { discounts, orderId, customerId, email }) => {
  for (const discount of discounts) {
    await client.query(
      `insert into campaign_redemptions (campaign_id, order_id, customer_id, email, amount)
       values ($1, $2, $3, $4, $5)`,
      [discount.id, orderId, customerId, email, discount.amount]
    )
    await client.query("update campaigns set used_count = used_count + 1 where id = $1", [discount.id])
  }
}

// ------------------------------------------------------------------ storefront

/**
 * Campaigns a shopper is allowed to see. A campaign restricted to a customer
 * group is invisible — and unreachable — to everyone outside that group.
 */
const visibleCampaigns = async ({ groupIds = [], onlyHomeBanners = false } = {}) => {
  const conditions = [
    "is_active",
    "(starts_at is null or starts_at <= now())",
    "(ends_at is null or ends_at >= now())",
    "(customer_group_id is null or customer_group_id = any($1::uuid[]))",
    "handle is not null",
  ]
  if (onlyHomeBanners) conditions.push("show_on_home", "banner_image is not null")

  const { rows } = await query(
    `select * from campaigns where ${conditions.join(" and ")} order by created_at desc nulls last, id`,
    [groupIds]
  )
  return rows
}

const findVisibleCampaign = async (handle, { groupIds = [] } = {}) => {
  const { rows } = await query(
    `select * from campaigns
      where handle = $1 and is_active
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at >= now())
        and (customer_group_id is null or customer_group_id = any($2::uuid[]))`,
    [String(handle || ""), groupIds]
  )
  return rows[0] || null
}

/**
 * Which products a campaign covers: the products in its categories (including
 * subcategories), the products it names, or — for an order-wide or shipping
 * campaign — the whole catalogue.
 */
const campaignScope = async (campaign) => {
  if (campaign.applies_to === "product") {
    return { productIds: campaign.product_ids || [], categoryIds: null, wholeCatalogue: false }
  }
  if (campaign.applies_to === "category") {
    return { productIds: null, categoryIds: await expandCategories(campaign.category_ids), wholeCatalogue: false }
  }
  return { productIds: null, categoryIds: null, wholeCatalogue: true }
}

/** Public shape of a campaign (no usage counters or internal limits). */
const toPublicJson = (campaign) => ({
  id: campaign.id,
  handle: campaign.handle,
  name: campaign.name || campaign.code,
  code: campaign.is_automatic ? null : campaign.code,
  type: campaign.type,
  value: Number(campaign.value),
  applies_to: campaign.applies_to,
  is_automatic: campaign.is_automatic,
  min_subtotal: Number(campaign.min_subtotal),
  min_quantity: campaign.min_quantity,
  ends_at: campaign.ends_at,
  banner: campaign.banner_image
    ? {
        image: campaign.banner_image,
        title: campaign.banner_title,
        title_sq: campaign.banner_title_sq,
        subtitle: campaign.banner_subtitle,
        subtitle_sq: campaign.banner_subtitle_sq,
      }
    : null,
})

module.exports = {
  evaluate,
  checkCode,
  collectDiscounts,
  recordRedemptions,
  visibleCampaigns,
  findVisibleCampaign,
  campaignScope,
  toPublicJson,
}
