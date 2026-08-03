const { query } = require("../../db")
const { check, money } = require("../../lib/util")

const list = async (_req, res) => {
  const { rows } = await query("select * from shipping_methods order by sort_order, price")
  res.json({ shipping_methods: rows.map((row) => ({ ...row, price: money(row.price) })) })
}

const create = async (req, res) => {
  const { name, name_sq = "", description = "", description_sq = "", price, is_active = true } = req.body || {}
  const { rows } = await query(
    `insert into shipping_methods (name, name_sq, description, description_sq, price, is_active)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [
      String(name).trim(),
      String(name_sq).trim(),
      String(description),
      String(description_sq),
      money(price),
      is_active !== false,
    ]
  )
  res.status(201).json({ shipping_method: rows[0] })
}

const update = async (req, res) => {
  const { name, name_sq = "", description = "", description_sq = "", price, is_active = true } = req.body || {}
  const { rows } = await query(
    `update shipping_methods set name=$1, name_sq=$2, description=$3, description_sq=$4,
            price=$5, is_active=$6 where id=$7 returning *`,
    [
      String(name).trim(),
      String(name_sq).trim(),
      String(description),
      String(description_sq),
      money(price),
      is_active !== false,
      req.params.id,
    ]
  )
  check(rows.length, "Shipping method not found.")
  res.json({ shipping_method: rows[0] })
}

const remove = async (req, res) => {
  await query("delete from shipping_methods where id = $1", [req.params.id])
  res.json({ success: true })
}

module.exports = { list, create, update, remove }
