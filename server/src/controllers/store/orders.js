const { query } = require("../../db")
const { check, pageParams } = require("../../lib/util")
const { orderToJson } = require("../../lib/serialize")
const { ACTIVE_STATUSES } = require("../../lib/order-status")

const list = async (req, res) => {
  const { limit, offset } = pageParams(req, 10, 50)
  // `status` narrows the list to one of the account page's filter tabs.
  const status = ACTIVE_STATUSES.concat(["delivered", "canceled", "active"]).includes(req.query.status)
    ? req.query.status
    : null
  const statuses = status === "active" ? ACTIVE_STATUSES : status ? [status] : null

  const where = statuses ? "customer_id = $1 and status = any($2)" : "customer_id = $1"
  const params = statuses ? [req.customer.id, statuses] : [req.customer.id]

  const { rows: countRows } = await query(`select count(*)::int as count from orders where ${where}`, params)
  const { rows } = await query(
    `select * from orders where ${where} order by created_at desc limit $${params.length + 1} offset $${
      params.length + 2
    }`,
    [...params, limit, offset]
  )
  res.json({ orders: rows.map((order) => orderToJson(order)), count: countRows[0].count })
}

/**
 * Guest order tracking: order number + the email it was placed with. Rate
 * limited and never reveals whether a number exists on its own.
 */
const lookup = async (req, res) => {
  const { display_id: displayId, email } = req.body

  const { rows } = await query("select * from orders where display_id = $1 and lower(email) = lower($2)", [
    displayId,
    email,
  ])
  if (!rows.length) {
    return res.status(404).json({ message: "No order matches that number and email." })
  }
  const { rows: events } = await query(
    "select type, data, created_at from order_events where order_id = $1 order by created_at desc",
    [rows[0].id]
  )
  res.json({ order: orderToJson(rows[0], events) })
}

// Order ids are unguessable uuids, so the confirmation page can load a guest
// order by id. Logged-in customers can only list their own orders above.
const get = async (req, res) => {
  const { rows } = await query("select * from orders where id = $1", [req.params.id])
  if (!rows.length) return res.status(404).json({ message: "Order not found." })
  const { rows: events } = await query(
    "select type, data, created_at from order_events where order_id = $1 order by created_at desc",
    [req.params.id]
  )
  res.json({ order: orderToJson(rows[0], events) })
}

/** Attaches a guest order to the signed-in account (emails must match). */
const claim = async (req, res) => {
  const { rows } = await query("select id, email, customer_id from orders where id = $1", [req.params.id])
  check(rows.length, "Order not found.")
  const order = rows[0]
  if (order.customer_id && order.customer_id !== req.customer.id) {
    return res.status(403).json({ message: "This order belongs to another account." })
  }
  if (order.email.toLowerCase() !== req.customer.email.toLowerCase()) {
    return res.status(403).json({ message: "This order was placed with a different email." })
  }
  await query("update orders set customer_id = $1 where id = $2", [req.customer.id, order.id])
  res.json({ success: true })
}

module.exports = { list, lookup, get, claim }
