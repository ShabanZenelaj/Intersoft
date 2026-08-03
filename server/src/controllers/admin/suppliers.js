const { query } = require("../../db")
const { check } = require("../../lib/util")

const list = async (_req, res) => {
  const { rows } = await query(
    `select s.*, sm.name as shipping_method_name,
            (select count(*)::int from products p where p.supplier_id = s.id) as product_count
       from suppliers s
       left join shipping_methods sm on sm.id = s.shipping_method_id
      order by s.name`
  )
  res.json({ suppliers: rows })
}

const create = async (req, res) => {
  const { name, email = null, phone = null, notes = "", shipping_method_id = null } = req.body || {}
  const { rows } = await query(
    "insert into suppliers (name, email, phone, notes, shipping_method_id) values ($1,$2,$3,$4,$5) returning *",
    [String(name).trim(), email, phone, String(notes), shipping_method_id || null]
  )
  res.status(201).json({ supplier: rows[0] })
}

/**
 * Updating a supplier's default shipping option can also push it onto that
 * supplier's products (apply_to_products), which is how a store manager
 * re-points a whole supplier's catalog to a new courier.
 */
const update = async (req, res) => {
  const { name, email = null, phone = null, notes = "", shipping_method_id = null, apply_to_products } = req.body || {}
  const { rows } = await query(
    "update suppliers set name=$1, email=$2, phone=$3, notes=$4, shipping_method_id=$5 where id=$6 returning *",
    [String(name).trim(), email, phone, String(notes), shipping_method_id || null, req.params.id]
  )
  check(rows.length, "Supplier not found.")

  let updatedProducts = 0
  if (apply_to_products && shipping_method_id) {
    const { rowCount } = await query(
      "update products set shipping_method_id = $1, updated_at = now() where supplier_id = $2",
      [shipping_method_id, req.params.id]
    )
    updatedProducts = rowCount
  }
  res.json({ supplier: rows[0], updated_products: updatedProducts })
}

const remove = async (req, res) => {
  await query("delete from suppliers where id = $1", [req.params.id])
  res.json({ success: true })
}

module.exports = { list, create, update, remove }
