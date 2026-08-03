const { query } = require("../../db")
const { isUuid, money, pageParams } = require("../../lib/util")
const { categoryToJson } = require("../../lib/serialize")
const { listProducts } = require("../../services/catalog")

const list = async (req, res) => {
  const { limit, offset } = pageParams(req, 100, 200)
  const result = await listProducts({
    q: req.query.q,
    handle: req.query.handle,
    categoryId: isUuid(req.query.category_id) ? req.query.category_id : undefined,
    order: req.query.order,
    customerId: req.customer?.id || null,
    limit,
    offset,
  })
  // Personalized prices must never land in a shared cache.
  if (req.customer) res.setHeader("Cache-Control", "private, no-store")
  res.json(result)
}

const listCategories = async (_req, res) => {
  const { rows } = await query("select * from categories where is_active order by sort_order, name")
  res.json({ categories: rows.map(categoryToJson) })
}

const listShippingMethods = async (_req, res) => {
  const { rows } = await query(
    `select id, name, name_sq, description, description_sq, price from shipping_methods
      where is_active order by sort_order, price`
  )
  res.json({
    shipping_options: rows.map((method) => ({
      id: method.id,
      name: method.name,
      name_sq: method.name_sq,
      amount: money(method.price),
      type: { description: method.description, description_sq: method.description_sq },
    })),
  })
}

module.exports = { list, listCategories, listShippingMethods }
