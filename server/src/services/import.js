const ExcelJS = require("exceljs")
const { query, tx } = require("../db")
const { slugify, money } = require("../lib/util")
const { getOrCreateSalePriceList } = require("./products")

const COLUMNS = [
  { key: "title", header: "title", example: "GeForce RTX 4070 12GB" },
  { key: "handle", header: "handle", example: "geforce-rtx-4070" },
  { key: "sku", header: "sku", example: "GPU-RTX4070" },
  { key: "description", header: "description", example: "Powerful graphics card for 1440p gaming." },
  { key: "category", header: "category", example: "Components > Graphics Cards" },
  { key: "price", header: "price", example: 599.99 },
  { key: "sale_price", header: "sale_price", example: 549.99 },
  { key: "stock", header: "stock", example: 25 },
  { key: "images", header: "images", example: "https://example.com/rtx4070.jpg" },
  { key: "tags", header: "tags", example: "gpu, nvidia, gaming" },
  { key: "brand", header: "brand", example: "NVIDIA" },
  { key: "supplier", header: "supplier", example: "TechnoTrade Sh.p.k." },
  { key: "shipping_method", header: "shipping_method", example: "Standard Delivery" },
  { key: "weight", header: "weight", example: 1200 },
]

const cellText = (cell) => {
  if (!cell || cell.value === null || cell.value === undefined) return ""
  const value = cell.value
  if (typeof value === "object") {
    if (value.richText) return value.richText.map((part) => part.text).join("")
    if (value.text) return String(value.text)
    if (value.result !== undefined) return String(value.result)
    if (value.hyperlink) return String(value.hyperlink)
    return String(cell.text || "")
  }
  return String(value)
}

const parseNumber = (raw) => {
  if (raw === "" || raw === null || raw === undefined) return null
  const num = Number(String(raw).replace(",", "."))
  return Number.isFinite(num) ? num : NaN
}

/** Finds or creates a category path like "Components > Graphics Cards". Returns the leaf id. */
const resolveCategoryPath = async (path, cache) => {
  const parts = String(path || "")
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean)
  if (!parts.length) return null

  const cacheKey = parts.join(">").toLowerCase()
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  let parentId = null
  let categoryId = null
  for (const name of parts) {
    const { rows } = await query(
      "select id from categories where lower(name) = lower($1) and parent_id is not distinct from $2",
      [name, parentId]
    )
    if (rows.length) {
      categoryId = rows[0].id
    } else {
      let handle = slugify(name)
      const { rows: clash } = await query("select 1 from categories where handle = $1", [handle])
      if (clash.length) handle = `${handle}-${Date.now().toString(36)}`
      const { rows: created } = await query(
        "insert into categories (name, handle, parent_id) values ($1, $2, $3) returning id",
        [name, handle, parentId]
      )
      categoryId = created[0].id
    }
    parentId = categoryId
  }
  cache.set(cacheKey, categoryId)
  return categoryId
}

/** Finds a supplier by name, creating it when it is new to the catalog. */
const resolveSupplier = async (name, cache) => {
  const clean = String(name || "").trim()
  if (!clean) return null
  const key = clean.toLowerCase()
  if (cache.has(key)) return cache.get(key)

  const { rows } = await query("select id from suppliers where lower(name) = lower($1)", [clean])
  let id = rows[0]?.id
  if (!id) {
    const { rows: created } = await query("insert into suppliers (name) values ($1) returning id", [clean])
    id = created[0].id
  }
  cache.set(key, id)
  return id
}

/** Matches a shipping option by name. Returns null when the name is unknown. */
const resolveShippingMethod = async (name, cache) => {
  const clean = String(name || "").trim()
  if (!clean) return null
  const key = clean.toLowerCase()
  if (cache.has(key)) return cache.get(key)

  const { rows } = await query("select id from shipping_methods where lower(name) = lower($1)", [clean])
  const id = rows[0]?.id || null
  cache.set(key, id)
  return id
}

/** Imports products from an .xlsx buffer. Rows are matched by handle (create or update). */
const importXlsx = async (buffer) => {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(buffer)
  } catch {
    const error = new Error("The uploaded file is not a valid .xlsx workbook.")
    error.status = 400
    throw error
  }
  const sheet = workbook.worksheets[0]
  if (!sheet) {
    const error = new Error("The workbook has no worksheets.")
    error.status = 400
    throw error
  }

  const headerIndex = {}
  sheet.getRow(1).eachCell((cell, col) => {
    const name = cellText(cell).trim().toLowerCase().replace(/\s+/g, "_")
    if (name) headerIndex[name] = col
  })
  if (!headerIndex.title) {
    const error = new Error("Missing required 'title' column. Download the template for the expected format.")
    error.status = 400
    throw error
  }

  const errors = []
  const warnings = []
  const rows = []

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const get = (key) => (headerIndex[key] ? cellText(row.getCell(headerIndex[key])).trim() : "")
    if (COLUMNS.every((col) => !get(col.key))) return

    const title = get("title")
    if (!title) {
      errors.push({ row: rowNumber, message: "Missing title." })
      return
    }
    const price = parseNumber(get("price"))
    if (price === null || Number.isNaN(price) || price <= 0) {
      errors.push({ row: rowNumber, message: `Invalid or missing price "${get("price")}".` })
      return
    }
    let salePrice = parseNumber(get("sale_price"))
    if (Number.isNaN(salePrice) || (salePrice !== null && salePrice >= price)) {
      warnings.push({ row: rowNumber, message: `Ignored invalid sale_price "${get("sale_price")}".` })
      salePrice = null
    }
    let stock = parseNumber(get("stock"))
    if (Number.isNaN(stock) || (stock !== null && stock < 0)) {
      warnings.push({ row: rowNumber, message: `Ignored invalid stock "${get("stock")}".` })
      stock = null
    }
    const weight = parseNumber(get("weight"))

    rows.push({
      rowNumber,
      title,
      handle: slugify(get("handle") || title),
      sku: get("sku") || null,
      description: get("description"),
      category: get("category"),
      price: money(price),
      salePrice: salePrice === null ? null : money(salePrice),
      stock: stock === null ? null : Math.floor(stock),
      images: get("images")
        .split(/[,|]/)
        .map((url) => url.trim())
        .filter((url) => /^https?:\/\//.test(url) || url.startsWith("/")),
      tags: get("tags")
        .split(/[,|]/)
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
      brand: get("brand"),
      supplier: get("supplier"),
      shippingMethod: get("shipping_method"),
      weight: Number.isFinite(weight) ? Math.floor(weight) : null,
    })
  })

  if (!rows.length) {
    return { created: 0, updated: 0, failed: errors.length, errors, warnings }
  }

  const categoryCache = new Map()
  const supplierCache = new Map()
  const shippingCache = new Map()
  const salePriceListId = await getOrCreateSalePriceList()

  // Shipping falls back to the supplier's default, then the cheapest method.
  const { rows: defaultMethods } = await query(
    "select id from shipping_methods where is_active order by sort_order, price limit 1"
  )
  const fallbackShippingId = defaultMethods[0]?.id || null

  let created = 0
  let updated = 0

  for (const row of rows) {
    try {
      const categoryId = row.category ? await resolveCategoryPath(row.category, categoryCache) : null
      const supplierId = await resolveSupplier(row.supplier, supplierCache)

      let shippingId = await resolveShippingMethod(row.shippingMethod, shippingCache)
      if (row.shippingMethod && !shippingId) {
        warnings.push({
          row: row.rowNumber,
          message: `Unknown shipping option "${row.shippingMethod}" — used the supplier/default option instead.`,
        })
      }
      if (!shippingId && supplierId) {
        const { rows: supplierRows } = await query("select shipping_method_id from suppliers where id = $1", [supplierId])
        shippingId = supplierRows[0]?.shipping_method_id || null
      }
      if (!shippingId) shippingId = fallbackShippingId

      await tx(async (client) => {
        const { rows: existing } = await client.query("select id from products where handle = $1", [row.handle])
        let productId
        let variantId

        if (existing.length) {
          productId = existing[0].id
          await client.query(
            `update products set title = $1, description = coalesce(nullif($2, ''), description),
                    brand = coalesce(nullif($3, ''), brand),
                    category_id = coalesce($4, category_id),
                    tags = case when cardinality($5::text[]) > 0 then $5::text[] else tags end,
                    images = case when jsonb_array_length($6::jsonb) > 0 then $6::jsonb else images end,
                    thumbnail = coalesce($7, thumbnail),
                    weight = coalesce($8, weight),
                    supplier_id = coalesce($9, supplier_id),
                    shipping_method_id = coalesce($10, shipping_method_id),
                    updated_at = now()
              where id = $11`,
            [row.title, row.description, row.brand, categoryId, row.tags, JSON.stringify(row.images),
             row.images[0] || null, row.weight, supplierId, shippingId, productId]
          )
          const { rows: variantRows } = await client.query(
            "select id from variants where product_id = $1 order by sort_order, created_at limit 1",
            [productId]
          )
          variantId = variantRows[0]?.id
          if (variantId) {
            await client.query(
              "update variants set price = $1, sku = coalesce($2, sku), stock = coalesce($3, stock) where id = $4",
              [row.price, row.sku, row.stock, variantId]
            )
          }
          updated++
        } else {
          const { rows: productRows } = await client.query(
            `insert into products (title, handle, description, brand, category_id, tags, images, thumbnail,
                                   weight, supplier_id, shipping_method_id, status)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'published') returning id`,
            [row.title, row.handle, row.description, row.brand, categoryId, row.tags, JSON.stringify(row.images),
             row.images[0] || null, row.weight, supplierId, shippingId]
          )
          productId = productRows[0].id
          const { rows: variantRows } = await client.query(
            `insert into variants (product_id, title, sku, price, stock, manage_stock)
             values ($1, 'Default', $2, $3, $4, $5) returning id`,
            [productId, row.sku, row.price, row.stock ?? 0, row.stock !== null]
          )
          variantId = variantRows[0].id
          created++
        }

        if (variantId) {
          if (row.salePrice !== null) {
            await client.query(
              `insert into price_list_prices (price_list_id, variant_id, price) values ($1, $2, $3)
               on conflict (price_list_id, variant_id) do update set price = $3`,
              [salePriceListId, variantId, row.salePrice]
            )
          } else {
            await client.query("delete from price_list_prices where price_list_id = $1 and variant_id = $2", [
              salePriceListId,
              variantId,
            ])
          }
        }
      })
    } catch (error) {
      errors.push({ row: row.rowNumber, message: error.message })
    }
  }

  return { created, updated, failed: errors.length, errors, warnings }
}

/** Builds the .xlsx template buffer with headers and one example row. */
const buildTemplate = async () => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Products")
  sheet.columns = COLUMNS.map((col) => ({ header: col.header, key: col.key, width: 24 }))
  sheet.getRow(1).font = { bold: true }
  sheet.addRow(COLUMNS.map((col) => col.example ?? ""))
  return workbook.xlsx.writeBuffer()
}

module.exports = { importXlsx, buildTemplate }
