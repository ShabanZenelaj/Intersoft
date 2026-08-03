const { query, tx } = require("../../db")
const { check, isUuid, money, pageParams } = require("../../lib/util")
const { orderToJson } = require("../../lib/serialize")

const list = async (req, res) => {
  const { limit, offset } = pageParams(req)
  const params = []
  let whereSql = ""
  if (req.query.q) {
    params.push(`%${req.query.q}%`)
    whereSql = `where email ilike $1 or first_name ilike $1 or last_name ilike $1`
  }
  const { rows: countRows } = await query(`select count(*)::int as count from customers ${whereSql}`, params)
  const { rows } = await query(
    `select c.id, c.email, c.first_name, c.last_name, c.phone, c.created_at,
            (select count(*)::int from orders o where o.customer_id = c.id) as order_count,
            (select coalesce(sum(total), 0) from orders o where o.customer_id = c.id and o.status <> 'canceled') as total_spent
       from customers c ${whereSql}
      order by c.created_at desc limit ${limit} offset ${offset}`,
    params
  )
  res.json({
    customers: rows.map((row) => ({ ...row, total_spent: money(row.total_spent) })),
    count: countRows[0].count,
  })
}

const get = async (req, res) => {
  const { rows } = await query(
    "select id, email, first_name, last_name, phone, default_address, created_at from customers where id = $1",
    [req.params.id]
  )
  check(rows.length, "Customer not found.")
  const [{ rows: orders }, { rows: groups }, { rows: lists }] = await Promise.all([
    query("select * from orders where customer_id = $1 order by created_at desc limit 50", [req.params.id]),
    query("select group_id from customer_group_members where customer_id = $1", [req.params.id]),
    query(
      `select pl.id, pl.name, pl.type from price_lists pl
        where pl.customer_id = $1
           or pl.customer_group_id in (select group_id from customer_group_members where customer_id = $1)`,
      [req.params.id]
    ),
  ])
  res.json({
    customer: rows[0],
    orders: orders.map((order) => orderToJson(order)),
    group_ids: groups.map((row) => row.group_id),
    price_lists: lists,
  })
}

/** Sets the groups a customer belongs to (store manager assigns membership). */
const setGroups = async (req, res) => {
  const groupIds = Array.isArray(req.body?.group_ids) ? req.body.group_ids.filter(isUuid) : []
  await tx(async (client) => {
    await client.query("delete from customer_group_members where customer_id = $1", [req.params.id])
    for (const groupId of groupIds) {
      await client.query(
        "insert into customer_group_members (customer_id, group_id) values ($1,$2) on conflict do nothing",
        [req.params.id, groupId]
      )
    }
  })
  res.json({ success: true, group_ids: groupIds })
}

module.exports = { list, get, setGroups }
