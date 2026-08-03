const { query, tx } = require("../../db")
const { check, isUuid, money, pageParams } = require("../../lib/util")
const { orderToJson } = require("../../lib/serialize")
const payments = require("../../services/payments")
const mail = require("../../services/mail")

const loadOrder = async (id) => {
  check(isUuid(id), "Invalid order id.")
  const { rows } = await query("select * from orders where id = $1", [id])
  check(rows.length, "Order not found.")
  return rows[0]
}

const addEvent = (orderId, type, data = {}) =>
  query("insert into order_events (order_id, type, data) values ($1, $2, $3)", [orderId, type, JSON.stringify(data)])

const list = async (req, res) => {
  const { limit, offset } = pageParams(req)
  const where = []
  const params = []
  if (req.query.status) {
    params.push(req.query.status)
    where.push(`status = $${params.length}`)
  }
  if (req.query.q) {
    params.push(`%${req.query.q}%`)
    where.push(`(email ilike $${params.length} or display_id::text = trim(both '%' from $${params.length}))`)
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : ""
  const { rows: countRows } = await query(`select count(*)::int as count from orders ${whereSql}`, params)
  const { rows } = await query(
    `select * from orders ${whereSql} order by created_at desc limit ${limit} offset ${offset}`,
    params
  )
  res.json({ orders: rows.map((order) => orderToJson(order)), count: countRows[0].count })
}

const get = async (req, res) => {
  const order = await loadOrder(req.params.id)
  const { rows: events } = await query(
    "select id, type, data, created_at from order_events where order_id = $1 order by created_at desc",
    [order.id]
  )
  let customer = null
  if (order.customer_id) {
    const { rows } = await query("select id, email, first_name, last_name, phone from customers where id = $1", [
      order.customer_id,
    ])
    customer = rows[0] || null
  }
  res.json({ order: { ...orderToJson(order, events), customer } })
}

const setStatus = async (req, res) => {
  const order = await loadOrder(req.params.id)
  const { status } = req.body
  check(order.status !== "canceled", "The order is canceled.")

  if (status === "canceled") {
    await tx(async (client) => {
      for (const item of order.items) {
        await client.query("update variants set stock = stock + $1 where id = $2 and manage_stock", [
          item.quantity,
          item.variant_id,
        ])
      }
      await client.query("update orders set status = 'canceled', updated_at = now() where id = $1", [order.id])
    })
    await addEvent(order.id, "status_changed", { from: order.status, to: "canceled", restocked: true })
  } else {
    await query("update orders set status = $1, updated_at = now() where id = $2", [status, order.id])
    await addEvent(order.id, "status_changed", { from: order.status, to: status })
  }

  const updated = await loadOrder(order.id)
  // Keep the customer informed at every step, unless the admin opts out.
  if (req.body?.notify !== false) {
    mail.sendOrderStatus(updated, status)
  }
  res.json({ order: orderToJson(updated) })
}

/** Marks the payment collected (COD/POS after delivery, or card capture). */
const capturePayment = async (req, res) => {
  const order = await loadOrder(req.params.id)
  check(order.payment_status === "awaiting", "Payment is not awaiting capture.")
  await query("update orders set payment_status = 'paid', updated_at = now() where id = $1", [order.id])
  await addEvent(order.id, "payment_captured", { method: order.payment_method, by: req.admin.email })

  const updated = await loadOrder(order.id)
  if (req.body?.notify !== false) {
    mail.sendPaymentCaptured(updated)
  }
  res.json({ order: orderToJson(updated) })
}

/** Refund (full or partial) with optional restock — covers returns handling. */
const refund = async (req, res) => {
  const order = await loadOrder(req.params.id)
  const amount = money(req.body.amount)
  const reason = req.body.reason || ""
  const restock = Boolean(req.body.restock)
  const alreadyRefunded = money(order.refunded_total)
  check(amount <= money(order.total) - alreadyRefunded, "Refund exceeds the remaining order total.")

  const paymentData = await payments.refund(order.payment_method, order.payment_data, amount)
  const newRefunded = money(alreadyRefunded + amount)
  const paymentStatus = newRefunded >= money(order.total) ? "refunded" : "partially_refunded"

  await tx(async (client) => {
    if (restock) {
      for (const item of order.items) {
        await client.query("update variants set stock = stock + $1 where id = $2 and manage_stock", [
          item.quantity,
          item.variant_id,
        ])
      }
    }
    await client.query(
      "update orders set refunded_total = $1, payment_status = $2, payment_data = $3, updated_at = now() where id = $4",
      [newRefunded, paymentStatus, JSON.stringify(paymentData), order.id]
    )
  })
  await addEvent(order.id, "refunded", { amount, reason, restock, by: req.admin.email })

  const updated = await loadOrder(order.id)
  if (req.body?.notify !== false) {
    mail.sendRefund(updated, amount)
  }
  res.json({ order: orderToJson(updated) })
}

const addNote = async (req, res) => {
  const order = await loadOrder(req.params.id)
  const { note } = req.body
  await addEvent(order.id, "note", { note, by: req.admin.email })
  res.json({ success: true })
}

module.exports = { list, get, setStatus, capturePayment, refund, addNote }
