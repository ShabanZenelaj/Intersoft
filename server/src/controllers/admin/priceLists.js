const { query } = require("../../db")
const { check, money } = require("../../lib/util")

/**
 * Maps a validated body onto the row shape. Name, target exclusivity and the
 * rest are enforced by validation/admin/price-lists.js before this runs.
 */
const priceListInput = (body) => {
  const name = String(body.name || "").trim()
  const type = body.type === "override" ? "override" : "sale"
  const customerGroupId = body.customer_group_id || null
  const customerId = body.customer_id || null
  return {
    name,
    description: String(body?.description || ""),
    type,
    customer_group_id: customerGroupId,
    customer_id: customerId,
    priority: Number.isFinite(Number(body?.priority)) ? Math.floor(Number(body.priority)) : 0,
    is_active: body?.is_active !== false,
    starts_at: body?.starts_at || null,
    ends_at: body?.ends_at || null,
  }
}

const list = async (_req, res) => {
  const { rows } = await query(
    `select pl.*, g.name as group_name, c.email as customer_email,
            (select count(*)::int from price_list_prices p where p.price_list_id = pl.id) as price_count
       from price_lists pl
       left join customer_groups g on g.id = pl.customer_group_id
       left join customers c on c.id = pl.customer_id
      order by pl.priority desc, pl.name`
  )
  res.json({ price_lists: rows })
}

const get = async (req, res) => {
  const { rows } = await query(
    `select pl.*, g.name as group_name, c.email as customer_email
       from price_lists pl
       left join customer_groups g on g.id = pl.customer_group_id
       left join customers c on c.id = pl.customer_id
      where pl.id = $1`,
    [req.params.id]
  )
  check(rows.length, "Price list not found.")
  const { rows: prices } = await query(
    `select plp.variant_id, plp.price, plp.min_quantity,
            v.title as variant_title, v.sku, v.price as base_price,
            p.id as product_id, p.title as product_title
       from price_list_prices plp
       join variants v on v.id = plp.variant_id
       join products p on p.id = v.product_id
      where plp.price_list_id = $1
      order by p.title, v.sort_order, plp.min_quantity`,
    [req.params.id]
  )
  res.json({
    price_list: rows[0],
    prices: prices.map((row) => ({ ...row, price: money(row.price), base_price: money(row.base_price) })),
  })
}

const create = async (req, res) => {
  const input = priceListInput(req.body)
  const { rows } = await query(
    `insert into price_lists (name, description, type, customer_group_id, customer_id, priority,
                              is_active, starts_at, ends_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [
      input.name,
      input.description,
      input.type,
      input.customer_group_id,
      input.customer_id,
      input.priority,
      input.is_active,
      input.starts_at,
      input.ends_at,
    ]
  )
  res.status(201).json({ price_list: rows[0] })
}

const update = async (req, res) => {
  const input = priceListInput(req.body)
  const { rows } = await query(
    `update price_lists set name=$1, description=$2, type=$3, customer_group_id=$4, customer_id=$5,
            priority=$6, is_active=$7, starts_at=$8, ends_at=$9 where id=$10 returning *`,
    [
      input.name,
      input.description,
      input.type,
      input.customer_group_id,
      input.customer_id,
      input.priority,
      input.is_active,
      input.starts_at,
      input.ends_at,
      req.params.id,
    ]
  )
  check(rows.length, "Price list not found.")
  res.json({ price_list: rows[0] })
}

const remove = async (req, res) => {
  await query("delete from price_lists where id = $1", [req.params.id])
  res.json({ success: true })
}

/** Adds/updates one price (optionally a quantity tier) in a list. */
const setPrice = async (req, res) => {
  const { variant_id, price, min_quantity = 1 } = req.body
  const amount = money(price)
  const quantity = min_quantity

  await query(
    `insert into price_list_prices (price_list_id, variant_id, price, min_quantity)
     values ($1,$2,$3,$4)
     on conflict (price_list_id, variant_id, min_quantity) do update set price = $3`,
    [req.params.id, variant_id, amount, quantity]
  )
  res.json({ success: true })
}

/**
 * Bulk fill: apply a percentage off the base price to every variant in a
 * category (or the whole catalog) — how a manager builds a B2B list quickly.
 */
const bulkFill = async (req, res) => {
  const { percent_off: percent, min_quantity: quantity = 1, category_id: categoryId = null } = req.body

  const params = [req.params.id, percent / 100, quantity]
  let scope = ""
  if (categoryId) {
    params.push(categoryId)
    scope = `and p.category_id in (
      with recursive tree as (
        select id from categories where id = $4
        union all select c.id from categories c join tree t on c.parent_id = t.id
      ) select id from tree)`
  }

  const { rowCount } = await query(
    `insert into price_list_prices (price_list_id, variant_id, price, min_quantity)
     select $1, v.id, round(v.price * (1 - $2::numeric), 2), $3
       from variants v join products p on p.id = v.product_id
      where p.status = 'published' ${scope}
     on conflict (price_list_id, variant_id, min_quantity)
     do update set price = excluded.price`,
    params
  )
  res.json({ updated: rowCount })
}

const removePrice = async (req, res) => {
  const { variant_id, min_quantity = 1 } = req.body
  await query("delete from price_list_prices where price_list_id = $1 and variant_id = $2 and min_quantity = $3", [
    req.params.id,
    variant_id,
    min_quantity,
  ])
  res.json({ success: true })
}

/** Variant search used by the price-list editor. */
const searchVariants = async (req, res) => {
  const search = `%${String(req.query.q || "")}%`
  const { rows } = await query(
    `select v.id, v.title as variant_title, v.sku, v.price,
            p.title as product_title, p.id as product_id
       from variants v join products p on p.id = v.product_id
      where p.title ilike $1 or v.sku ilike $1
      order by p.title, v.sort_order limit 25`,
    [search]
  )
  res.json({ variants: rows.map((row) => ({ ...row, price: money(row.price) })) })
}

module.exports = { list, get, create, update, remove, setPrice, bulkFill, removePrice, searchVariants }
