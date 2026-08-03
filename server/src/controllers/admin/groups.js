const { query } = require("../../db")
const { check, slugify } = require("../../lib/util")

const list = async (_req, res) => {
  const { rows } = await query(
    `select g.*, (select count(*)::int from customer_group_members m where m.group_id = g.id) as member_count,
            (select count(*)::int from price_lists pl where pl.customer_group_id = g.id) as price_list_count
       from customer_groups g order by g.name`
  )
  res.json({ customer_groups: rows })
}

const create = async (req, res) => {
  const { name, description = "" } = req.body || {}
  let handle = slugify(req.body?.handle || name)
  const { rows: clash } = await query("select 1 from customer_groups where handle = $1", [handle])
  if (clash.length) handle = `${handle}-${Date.now().toString(36)}`
  const { rows } = await query("insert into customer_groups (name, handle, description) values ($1,$2,$3) returning *", [
    String(name).trim(),
    handle,
    String(description),
  ])
  res.status(201).json({ customer_group: rows[0] })
}

const update = async (req, res) => {
  const { name, description = "" } = req.body || {}
  const { rows } = await query("update customer_groups set name=$1, description=$2 where id=$3 returning *", [
    String(name).trim(),
    String(description),
    req.params.id,
  ])
  check(rows.length, "Group not found.")
  res.json({ customer_group: rows[0] })
}

const remove = async (req, res) => {
  await query("delete from customer_groups where id = $1", [req.params.id])
  res.json({ success: true })
}

module.exports = { list, create, update, remove }
