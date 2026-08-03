const { query } = require("../db")
const { resolvePrices, getCustomerGroupIds } = require("../lib/pricing")
const { productToJson } = require("../lib/serialize")

/** Category ids of a category and all its descendants. */
const categoryTreeIds = async (categoryId) => {
  const { rows } = await query(
    `with recursive tree as (
       select id from categories where id = $1
       union all
       select c.id from categories c join tree t on c.parent_id = t.id
     )
     select id from tree`,
    [categoryId]
  )
  return rows.map((row) => row.id)
}

/**
 * Lists products with variants, categories and resolved prices.
 * filters: { q, categoryId (incl. descendants), handle, status, limit, offset, order }
 */
const listProducts = async (filters = {}) => {
  const where = []
  const params = []
  const add = (clause, value) => {
    params.push(value)
    where.push(clause.replace("?", `$${params.length}`))
  }

  add("p.status = ?", filters.status || "published")
  if (filters.handle) add("p.handle = ?", filters.handle)
  if (filters.q) {
    params.push(`%${filters.q}%`)
    const n = params.length
    where.push(
      `(p.title ilike $${n} or p.description ilike $${n} or p.brand ilike $${n}
        or exists (select 1 from unnest(p.tags) tag where tag ilike $${n}))`
    )
  }
  if (filters.categoryId) {
    const ids = await categoryTreeIds(filters.categoryId)
    params.push(ids)
    where.push(`p.category_id = any($${params.length}::uuid[])`)
  }
  // Explicit id lists, used by campaign catalogues.
  if (filters.categoryIds) {
    params.push(filters.categoryIds)
    where.push(`p.category_id = any($${params.length}::uuid[])`)
  }
  if (filters.productIds) {
    params.push(filters.productIds)
    where.push(`p.id = any($${params.length}::uuid[])`)
  }

  const order =
    filters.order === "-created_at" ? "p.created_at desc" :
    filters.order === "created_at" ? "p.created_at asc" :
    filters.order === "title" ? "p.title asc" : "p.created_at desc"

  const limit = Math.min(Number(filters.limit) || 100, 200)
  const offset = Number(filters.offset) || 0

  const whereSql = where.length ? `where ${where.join(" and ")}` : ""
  const { rows: countRows } = await query(`select count(*)::int as count from products p ${whereSql}`, params)
  const { rows: products } = await query(
    `select p.*, c.id as cat_id, c.name as cat_name, c.handle as cat_handle, c.metadata as cat_metadata,
            sm.name as shipping_method_name, sm.name_sq as shipping_method_name_sq,
            sm.price as shipping_method_price
       from products p
       left join categories c on c.id = p.category_id
       left join shipping_methods sm on sm.id = p.shipping_method_id
      ${whereSql}
      order by ${order}
      limit ${limit} offset ${offset}`,
    params
  )

  if (!products.length) return { products: [], count: countRows[0].count }

  const { rows: variants } = await query(
    "select * from variants where product_id = any($1::uuid[]) order by sort_order, created_at",
    [products.map((product) => product.id)]
  )
  // Prices are personal: a customer may sit in a group (or have their own
  // list) with negotiated pricing.
  const groupIds = filters.customerId ? await getCustomerGroupIds(filters.customerId) : []
  const prices = await resolvePrices(variants.map((variant) => variant.id), {
    customerId: filters.customerId || null,
    groupIds,
  })

  const variantsByProduct = new Map()
  for (const variant of variants) {
    if (!variantsByProduct.has(variant.product_id)) variantsByProduct.set(variant.product_id, [])
    variantsByProduct.get(variant.product_id).push(variant)
  }

  return {
    products: products.map((product) =>
      productToJson(
        product,
        variantsByProduct.get(product.id) || [],
        prices,
        product.cat_id
          ? {
              id: product.cat_id,
              name: product.cat_name,
              handle: product.cat_handle,
              metadata: product.cat_metadata || {},
            }
          : null
      )
    ),
    count: countRows[0].count,
  }
}

module.exports = { listProducts, categoryTreeIds }
