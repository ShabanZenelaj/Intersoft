const { query } = require("../../db")
const { check, slugify } = require("../../lib/util")
const { categoryToJson } = require("../../lib/serialize")

/** Albanian name/description live in metadata (name_sq / description_sq). */
const categoryMetadata = (body, existing = {}) => {
  const metadata = { ...existing }
  const nameSq = String(body?.name_sq || "").trim()
  const descriptionSq = String(body?.description_sq || "").trim()
  if (nameSq) metadata.name_sq = nameSq
  else delete metadata.name_sq
  if (descriptionSq) metadata.description_sq = descriptionSq
  else delete metadata.description_sq
  return metadata
}

const list = async (_req, res) => {
  const { rows } = await query(
    `select c.*, (select count(*)::int from products p where p.category_id = c.id) as product_count
       from categories c order by sort_order, name`
  )
  res.json({ categories: rows.map((row) => ({ ...categoryToJson(row), product_count: row.product_count })) })
}

const create = async (req, res) => {
  const { name, description = "", parent_id = null, image_url = null, is_active = true } = req.body || {}
  let handle = slugify(req.body?.handle || name)
  const { rows: clash } = await query("select 1 from categories where handle = $1", [handle])
  if (clash.length) handle = `${handle}-${Date.now().toString(36)}`
  const { rows } = await query(
    `insert into categories (name, handle, description, parent_id, image_url, is_active, metadata)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [
      String(name).trim(),
      handle,
      String(description),
      parent_id || null,
      image_url,
      is_active !== false,
      JSON.stringify(categoryMetadata(req.body)),
    ]
  )
  res.status(201).json({ category: categoryToJson(rows[0]) })
}

const update = async (req, res) => {
  const { name, description, parent_id, image_url, is_active, sort_order } = req.body || {}
  check(parent_id !== req.params.id, "A category cannot be its own parent.")

  const { rows: current } = await query("select metadata from categories where id = $1", [req.params.id])
  check(current.length, "Category not found.")

  const { rows } = await query(
    `update categories set name=$1, description=coalesce($2, description), parent_id=$3,
            image_url=$4, is_active=$5, sort_order=coalesce($6, sort_order), metadata=$7
      where id=$8 returning *`,
    [
      String(name).trim(),
      description,
      parent_id || null,
      image_url || null,
      is_active !== false,
      Number.isFinite(Number(sort_order)) ? Number(sort_order) : null,
      JSON.stringify(categoryMetadata(req.body, current[0].metadata)),
      req.params.id,
    ]
  )
  res.json({ category: categoryToJson(rows[0]) })
}

const remove = async (req, res) => {
  await query("delete from categories where id = $1", [req.params.id])
  res.json({ success: true })
}

module.exports = { list, create, update, remove }
