const { query } = require("../../db")
const prodata = require("../prodata")

/**
 * Follows sent orders through Pro-Data:
 *   H  open — sitting with staff, not invoiced
 *   M  closed — invoiced; Pro-Data's stock now reflects the sale
 *   A  canceled in Pro-Data
 *
 * One history call covers every order, so this is cheap. It also closes the
 * loop on manual cancels: an order flagged "cancel it in Pro-Data too" clears
 * itself once Pro-Data shows it canceled.
 */
const trackOrders = async () => {
  const { rows: pushes } = await query(
    `select p.id, p.order_id, p.pro_data_order_id, p.pro_data_status, p.void_required, p.void_done_at,
            o.status as order_status
       from inventory_pushes p join orders o on o.id = p.order_id
      where p.state = 'sent' and p.pro_data_order_id is not null
        and (p.pro_data_status is distinct from 'M' and p.pro_data_status is distinct from 'A'
             or (p.void_required and p.void_done_at is null))`
  )
  if (!pushes.length) return { tracked: 0, changed: 0 }

  const history = await prodata.orderHistory()
  const statusById = new Map(history.map((order) => [order.orderID, String(order.status || "").trim().charAt(0)]))

  let changed = 0
  let missing = 0
  for (const push of pushes) {
    const status = statusById.get(push.pro_data_order_id)
    if (!status) {
      missing++
      await query("update inventory_pushes set last_error = $2, updated_at = now() where id = $1", [
        push.id,
        `Pro-Data's order history no longer lists ${push.pro_data_order_id}.`,
      ])
      continue
    }
    if (!["H", "M", "A"].includes(status) || status === push.pro_data_status) continue

    await query(
      `update inventory_pushes set pro_data_status = $2, pro_data_status_at = now(), last_error = null,
              void_done_at = case when $2 = 'A' and void_required and void_done_at is null then now() else void_done_at end,
              updated_at = now()
        where id = $1`,
      [push.id, status]
    )
    await query("insert into order_events (order_id, type, data) values ($1, 'inventory_status', $2)", [
      push.order_id,
      JSON.stringify({
        pro_data_order_id: push.pro_data_order_id,
        from: push.pro_data_status,
        to: status,
        // Pro-Data canceled an order the shop still considers live — the admin should know.
        ...(status === "A" && push.order_status !== "canceled" ? { warning: "canceled_in_prodata" } : {}),
      }),
    ])
    changed++
  }
  return { tracked: pushes.length, changed, missing }
}

module.exports = { trackOrders }
