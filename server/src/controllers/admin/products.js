const { query } = require("../../db")
const { check, isUuid, money, pageParams } = require("../../lib/util")
const { listProducts } = require("../../services/catalog")
const { upsertProduct, getOrCreateSalePriceList } = require("../../services/products")

/**
 * The admin's view of a product: raw variants with their sale prices pulled
 * out of the sale price list, ready for the editor form. Responds 404 itself
 * and returns null when the product does not exist.
 */
const loadAdminProduct = async (id, res) => {
  check(isUuid(id), "Invalid product id.")
  const { rows: products } = await query("select * from products where id = $1", [id])
  if (!products.length) {
    res.status(404).json({ message: "Product not found." })
    return null
  }
  const product = products[0]
  const { rows: variants } = await query(
    "select * from variants where product_id = $1 order by sort_order, created_at",
    [id]
  )
  const salePriceListId = await getOrCreateSalePriceList()
  const { rows: salePrices } = await query(
    "select variant_id, price from price_list_prices where price_list_id = $1 and variant_id = any($2::uuid[])",
    [salePriceListId, variants.map((variant) => variant.id)]
  )
  const saleByVariant = new Map(salePrices.map((row) => [row.variant_id, money(row.price)]))
  return {
    ...product,
    images: product.images || [],
    variants: variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      options: variant.options,
      price: money(variant.price),
      sale_price: saleByVariant.get(variant.id) ?? null,
      stock: variant.stock,
      manage_stock: variant.manage_stock,
    })),
  }
}

const list = async (req, res) => {
  const { limit, offset } = pageParams(req)
  const result = await listProducts({
    q: req.query.q,
    status: req.query.status || undefined,
    categoryId: isUuid(req.query.category_id) ? req.query.category_id : undefined,
    order: req.query.order || "-created_at",
    limit,
    offset,
  })
  res.json(result)
}

const get = async (req, res) => {
  const product = await loadAdminProduct(req.params.id, res)
  if (product) res.json({ product })
}

const create = async (req, res) => {
  const id = await upsertProduct(req.body || {})
  const product = await loadAdminProduct(id, res)
  if (product) res.status(201).json({ product })
}

const update = async (req, res) => {
  await upsertProduct(req.body || {}, req.params.id)
  const product = await loadAdminProduct(req.params.id, res)
  if (product) res.json({ product })
}

const remove = async (req, res) => {
  await query("delete from products where id = $1", [req.params.id])
  res.json({ success: true })
}

module.exports = { list, get, create, update, remove }
