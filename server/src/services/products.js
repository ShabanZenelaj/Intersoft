const { query, tx } = require("../db")
const { slugify, money, check } = require("../lib/util")

/** The single "Sale" price list that powers storefront sale prices. */
const getOrCreateSalePriceList = async () => {
  const { rows } = await query("select id from price_lists where type = 'sale' order by starts_at nulls first limit 1")
  if (rows.length) return rows[0].id
  const { rows: created } = await query(
    "insert into price_lists (name, type) values ('Sale', 'sale') returning id"
  )
  return created[0].id
}

const normalizeVariantInput = (variant) => ({
  id: variant.id || null,
  title: String(variant.title || "Default").slice(0, 200),
  sku: variant.sku ? String(variant.sku).slice(0, 100) : null,
  options: variant.options && typeof variant.options === "object" ? variant.options : {},
  price: money(variant.price),
  sale_price:
    variant.sale_price === null || variant.sale_price === undefined || variant.sale_price === ""
      ? null
      : money(variant.sale_price),
  stock: Math.max(0, Math.floor(Number(variant.stock) || 0)),
  manage_stock: variant.manage_stock !== false,
})

/**
 * A product ships with exactly one option. Priority: what the form sent →
 * the supplier's default → the cheapest active method.
 */
const resolveShippingMethodId = async (input) => {
  if (input.shipping_method_id) return input.shipping_method_id
  if (input.supplier_id) {
    const { rows } = await query("select shipping_method_id from suppliers where id = $1", [input.supplier_id])
    if (rows[0]?.shipping_method_id) return rows[0].shipping_method_id
  }
  const { rows } = await query("select id from shipping_methods where is_active order by sort_order, price limit 1")
  return rows[0]?.id || null
}

const validateProductInput = (input) => {
  check(input.title && String(input.title).trim(), "Title is required.")
  const variants = (input.variants || []).map(normalizeVariantInput)
  check(variants.length, "At least one variant is required.")
  for (const variant of variants) {
    check(Number.isFinite(variant.price) && variant.price >= 0, `Variant "${variant.title}": invalid price.`)
    if (variant.sale_price !== null) {
      check(variant.sale_price < variant.price, `Variant "${variant.title}": sale price must be below the price.`)
    }
  }
  return variants
}

/**
 * Creates or updates a product with its variants and sale prices in one
 * transaction. `input` mirrors the admin UI form. Pass productId to update.
 */
const upsertProduct = async (input, productId = null) => {
  const variants = validateProductInput(input)
  const salePriceListId = await getOrCreateSalePriceList()

  // The handle is the product's public URL. Renaming a product must not
  // silently break links that already exist, so an existing handle is only
  // replaced when one is explicitly supplied.
  let handle = null
  if (productId) {
    const { rows } = await query("select handle from products where id = $1", [productId])
    check(rows.length, "Product not found.")
    handle = input.handle ? slugify(input.handle) : rows[0].handle
  } else {
    handle = slugify(input.handle || input.title)
  }
  check(handle, "Could not build a web address for this product.")

  const { rows: clash } = await query("select id from products where handle = $1 and id is distinct from $2", [
    handle,
    productId,
  ])
  if (clash.length) handle = `${handle}-${Date.now().toString(36)}`

  const images = Array.isArray(input.images) ? input.images.filter(Boolean) : []
  const shippingMethodId = await resolveShippingMethodId(input)
  const fields = [
    String(input.title).trim(),
    handle,
    String(input.description || ""),
    String(input.brand || ""),
    input.status === "draft" ? "draft" : "published",
    input.category_id || null,
    input.supplier_id || null,
    Array.isArray(input.tags) ? input.tags.map((tag) => String(tag).toLowerCase().trim()).filter(Boolean) : [],
    JSON.stringify(images),
    input.thumbnail || images[0] || null,
    JSON.stringify(Array.isArray(input.options) ? input.options : []),
    input.weight ? Math.floor(Number(input.weight)) : null,
    JSON.stringify(input.metadata && typeof input.metadata === "object" ? input.metadata : {}),
    shippingMethodId,
  ]

  return tx(async (client) => {
    let id = productId
    if (id) {
      const { rows } = await client.query(
        `update products set title=$1, handle=$2, description=$3, brand=$4, status=$5, category_id=$6,
                supplier_id=$7, tags=$8, images=$9, thumbnail=$10, options=$11, weight=$12, metadata=$13,
                shipping_method_id=$14, updated_at=now()
          where id=$15 returning id`,
        [...fields, id]
      )
      check(rows.length, "Product not found.")
    } else {
      const { rows } = await client.query(
        `insert into products (title, handle, description, brand, status, category_id, supplier_id,
                               tags, images, thumbnail, options, weight, metadata, shipping_method_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id`,
        fields
      )
      id = rows[0].id
    }

    // Sync variants: update existing by id, insert new, delete removed.
    const { rows: existingVariants } = await client.query("select id from variants where product_id = $1", [id])
    const keptIds = new Set()

    for (const [index, variant] of variants.entries()) {
      if (variant.id && existingVariants.some((row) => row.id === variant.id)) {
        await client.query(
          `update variants set title=$1, sku=$2, options=$3, price=$4, stock=$5, manage_stock=$6, sort_order=$7
            where id=$8 and product_id=$9`,
          [variant.title, variant.sku, JSON.stringify(variant.options), variant.price, variant.stock,
           variant.manage_stock, index, variant.id, id]
        )
        keptIds.add(variant.id)
      } else {
        const { rows } = await client.query(
          `insert into variants (product_id, title, sku, options, price, stock, manage_stock, sort_order)
           values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
          [id, variant.title, variant.sku, JSON.stringify(variant.options), variant.price, variant.stock,
           variant.manage_stock, index]
        )
        variant.id = rows[0].id
        keptIds.add(rows[0].id)
      }

      if (variant.sale_price !== null) {
        await client.query(
          `insert into price_list_prices (price_list_id, variant_id, price) values ($1, $2, $3)
           on conflict (price_list_id, variant_id) do update set price = $3`,
          [salePriceListId, variant.id, variant.sale_price]
        )
      } else {
        await client.query("delete from price_list_prices where price_list_id = $1 and variant_id = $2", [
          salePriceListId,
          variant.id,
        ])
      }
    }

    const removed = existingVariants.filter((row) => !keptIds.has(row.id))
    if (removed.length) {
      await client.query("delete from variants where id = any($1::uuid[])", [removed.map((row) => row.id)])
    }

    return id
  })
}

module.exports = { getOrCreateSalePriceList, upsertProduct }
