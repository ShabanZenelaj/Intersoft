const { query } = require("../../db")
const { check, isUuid, money, slugify } = require("../../lib/util")

/**
 * Turns a validated request body into the row shape. The rules — code format,
 * positive value, scope not empty, banner needed for the home page — are
 * enforced by validation/admin/campaigns.js before this runs; what is left
 * here is filling defaults and deriving the handle.
 */
const campaignInput = (body) => {
  const isAutomatic = Boolean(body.is_automatic)
  const code = String(body.code || "").trim().toUpperCase()
  const type = ["fixed", "free_shipping"].includes(body.type) ? body.type : "percentage"
  const appliesTo = ["category", "product", "shipping"].includes(body.applies_to) ? body.applies_to : "order"
  const value = type === "free_shipping" ? 100 : money(body.value)
  const name = String(body.name || "").trim() || code
  const bannerImage = String(body.banner_image || "").trim() || null
  const showOnHome = Boolean(body.show_on_home)

  return {
    name,
    handle: slugify(body.handle || name || code),
    code: isAutomatic && !code ? null : code || null,
    type,
    value,
    applies_to: appliesTo,
    category_ids: (body.category_ids || []).filter(isUuid),
    product_ids: (body.product_ids || []).filter(isUuid),
    customer_group_id: body.customer_group_id || null,
    min_subtotal: money(body.min_subtotal) || 0,
    min_quantity: Math.max(0, Math.floor(Number(body.min_quantity) || 0)),
    is_active: body.is_active !== false,
    is_automatic: isAutomatic,
    starts_at: body.starts_at || null,
    ends_at: body.ends_at || null,
    usage_limit: body.usage_limit ? Math.floor(Number(body.usage_limit)) : null,
    usage_limit_per_customer: body.usage_limit_per_customer
      ? Math.floor(Number(body.usage_limit_per_customer))
      : null,
    banner_image: bannerImage,
    banner_title: String(body.banner_title || "").slice(0, 120),
    banner_title_sq: String(body.banner_title_sq || "").slice(0, 120),
    banner_subtitle: String(body.banner_subtitle || "").slice(0, 200),
    banner_subtitle_sq: String(body.banner_subtitle_sq || "").slice(0, 200),
    show_on_home: showOnHome,
  }
}

/** Keeps campaign handles unique (they are public URLs). */
const uniqueCampaignHandle = async (handle, id = null) => {
  const { rows } = await query("select 1 from campaigns where handle = $1 and id is distinct from $2", [handle, id])
  return rows.length ? `${handle}-${Date.now().toString(36)}` : handle
}

const campaignColumns = `name, handle, code, type, value, applies_to, category_ids, product_ids, customer_group_id,
                      min_subtotal, min_quantity, is_active, is_automatic, starts_at, ends_at,
                      usage_limit, usage_limit_per_customer, banner_image, banner_title, banner_title_sq,
                      banner_subtitle, banner_subtitle_sq, show_on_home`

const campaignValues = (input) => [
  input.name,
  input.handle,
  input.code,
  input.type,
  input.value,
  input.applies_to,
  input.category_ids,
  input.product_ids,
  input.customer_group_id,
  input.min_subtotal,
  input.min_quantity,
  input.is_active,
  input.is_automatic,
  input.starts_at,
  input.ends_at,
  input.usage_limit,
  input.usage_limit_per_customer,
  input.banner_image,
  input.banner_title,
  input.banner_title_sq,
  input.banner_subtitle,
  input.banner_subtitle_sq,
  input.show_on_home,
]

const list = async (_req, res) => {
  const { rows } = await query(
    `select p.*, g.name as group_name,
            (select count(*)::int from campaign_redemptions r where r.campaign_id = p.id) as redemptions
       from campaigns p
       left join customer_groups g on g.id = p.customer_group_id
      order by p.is_automatic desc, p.code nulls last, p.name`
  )
  res.json({
    campaigns: rows.map((row) => ({
      ...row,
      value: money(row.value),
      min_subtotal: money(row.min_subtotal),
    })),
  })
}

const create = async (req, res) => {
  const input = campaignInput(req.body)
  input.handle = await uniqueCampaignHandle(input.handle)
  const { rows } = await query(
    `insert into campaigns (${campaignColumns})
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) returning *`,
    campaignValues(input)
  )
  res.status(201).json({ campaign: rows[0] })
}

const update = async (req, res) => {
  const input = campaignInput(req.body)
  input.handle = await uniqueCampaignHandle(input.handle, req.params.id)
  const { rows } = await query(
    `update campaigns set name=$1, handle=$2, code=$3, type=$4, value=$5, applies_to=$6, category_ids=$7,
            product_ids=$8, customer_group_id=$9, min_subtotal=$10, min_quantity=$11, is_active=$12,
            is_automatic=$13, starts_at=$14, ends_at=$15, usage_limit=$16, usage_limit_per_customer=$17,
            banner_image=$18, banner_title=$19, banner_title_sq=$20, banner_subtitle=$21,
            banner_subtitle_sq=$22, show_on_home=$23
      where id=$24 returning *`,
    [...campaignValues(input), req.params.id]
  )
  check(rows.length, "Campaign not found.")
  res.json({ campaign: rows[0] })
}

const remove = async (req, res) => {
  await query("delete from campaigns where id = $1", [req.params.id])
  res.json({ success: true })
}

module.exports = { list, create, update, remove }
