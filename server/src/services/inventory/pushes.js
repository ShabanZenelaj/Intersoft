const { query, tx } = require("../../db")
const { money } = require("../../lib/util")
const prodata = require("../prodata")
const settings = require("../settings")

const PUSHES_PER_TICK = 20
// A push left "sending" this long belongs to a worker that died mid-send. Its
// outcome is unknown, so it goes through the same check as a timed-out post.
const STALE_SENDING_MINUTES = 5
const MAX_BACKOFF_MINUTES = 60
// Totals in Pro-Data's history are rounded per line; allow a few cents.
const AMOUNT_TOLERANCE = 0.05

// ---------------------------------------------------------------- lines

/**
 * The price each unit was really sold at, after order-level discounts.
 *
 * A discount scoped to some products lands only on those lines (the order
 * records which, see `describe` in services/campaigns.js). Orders placed
 * before that was recorded fall back to spreading the discount over every
 * line. Shipping discounts are left out — no shipping is sent to Pro-Data.
 * Each discount takes its exact amount off whatever its lines still cost.
 */
const netUnitPrices = (order) => {
  const lines = (order.items || []).map((item) => ({
    productId: item.product_id,
    quantity: Number(item.quantity) || 0,
    unit: money(item.unit_price),
    net: Number(item.unit_price) || 0,
  }))
  for (const discount of order.discounts || []) {
    if (discount.is_shipping) continue
    const scoped = Array.isArray(discount.product_ids)
      ? lines.filter((line) => discount.product_ids.includes(line.productId))
      : lines
    const base = scoped.reduce((sum, line) => sum + line.net * line.quantity, 0)
    if (base <= 0) continue
    const ratio = Math.min(1, Number(discount.amount) / base)
    for (const line of scoped) line.net *= 1 - ratio
  }
  return lines.map((line) => money(line.net))
}

/**
 * Creates the push for an order, inside the caller's transaction, with its
 * lines snapshotted from the order as it is now.
 *
 * A line is resolved at once when its variant is linked to a Pro-Data item,
 * or when the variant is marked "never send". Anything else waits for the
 * admin under "Needs linking". Returns null when the order already has a push.
 */
const createPush = async (client, order) => {
  const { rows: exists } = await client.query("select id from inventory_pushes where order_id = $1", [order.id])
  if (exists.length) return null

  const items = order.items || []
  const variantIds = items.map((item) => item.variant_id).filter(Boolean)
  const { rows: variants } = await client.query(
    "select id, inventory_item_id, inventory_sync from variants where id = any($1::uuid[])",
    [variantIds]
  )
  const byId = new Map(variants.map((variant) => [variant.id, variant]))
  const nets = netUnitPrices(order)

  const lines = items.map((item, index) => {
    const variant = byId.get(item.variant_id)
    let resolution = null
    let itemId = null
    if (variant?.inventory_sync === false) resolution = "dismissed"
    else if (variant?.inventory_item_id) {
      resolution = "auto"
      itemId = variant.inventory_item_id
    }
    return {
      line_no: index + 1,
      variant_id: variant ? variant.id : null,
      title: [item.product_title || item.title, item.variant_title !== "Default" ? item.variant_title : null]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 300) || "Item",
      quantity: Number(item.quantity),
      unit_price: money(item.unit_price),
      net_price: nets[index],
      inventory_item_id: itemId,
      resolution,
    }
  })

  const state = stateFor(lines)
  const { rows } = await client.query(
    "insert into inventory_pushes (order_id, state) values ($1, $2) returning id",
    [order.id, state]
  )
  const pushId = rows[0].id
  for (const line of lines) {
    await client.query(
      `insert into inventory_push_lines
         (push_id, line_no, variant_id, title, quantity, unit_price, net_price, inventory_item_id, resolution,
          resolved_by, resolved_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, case when $9::text is null then null else now() end)`,
      [pushId, line.line_no, line.variant_id, line.title, line.quantity, line.unit_price, line.net_price,
       line.inventory_item_id, line.resolution, line.resolution ? "automatic" : null]
    )
  }
  return { id: pushId, state }
}

/** What a push's lines add up to: waiting on the admin, ready, or nothing to send. */
const stateFor = (lines) => {
  if (lines.some((line) => line.resolution === null)) return "waiting_links"
  if (lines.every((line) => line.resolution === "dismissed")) return "dismissed"
  return "queued"
}

/** Re-evaluates pushes that were waiting on links after lines changed. */
const refreshWaiting = async (client, pushIds) => {
  for (const pushId of new Set(pushIds)) {
    const { rows: lines } = await client.query("select resolution from inventory_push_lines where push_id = $1", [pushId])
    const state = stateFor(lines)
    await client.query(
      `update inventory_pushes set state = $2, next_attempt_at = now(), updated_at = now()
        where id = $1 and state = 'waiting_links' and $2 <> 'waiting_links'`,
      [pushId, state]
    )
  }
}

/**
 * The admin's answer for one unmapped line.
 *
 *   link     link the variant to the item for good — this line and every other
 *            line of that variant still waiting are resolved with it
 *   one_off  use this item for this sale only
 *   dismiss  don't send this line
 *   never    never send this product: the variant is marked, and every line
 *            of it still waiting is dismissed
 */
const resolveLine = async (lineId, { action, inventoryItemId = null, by }) =>
  tx(async (client) => {
    const { rows } = await client.query(
      `select l.*, p.state as push_state from inventory_push_lines l
         join inventory_pushes p on p.id = l.push_id where l.id = $1 for update of l`,
      [lineId]
    )
    const line = rows[0]
    if (!line) throw Object.assign(new Error("That line no longer exists."), { status: 404 })
    if (line.resolution !== null) throw Object.assign(new Error("That line has already been dealt with."), { status: 409 })

    if ((action === "link" || action === "one_off")) {
      const { rows: items } = await client.query("select id from inventory_items where id = $1", [inventoryItemId])
      if (!items.length) throw Object.assign(new Error("Choose an item from Pro-Data."), { status: 400 })
    }
    if ((action === "link" || action === "never") && !line.variant_id) {
      throw Object.assign(
        new Error("This product has since been deleted from the shop, so it can only be mapped for this sale."),
        { status: 400 }
      )
    }

    const touched = [line.push_id]
    if (action === "link" || action === "never") {
      if (action === "link") {
        await client.query("update variants set inventory_item_id = $1, inventory_sync = true where id = $2", [
          inventoryItemId,
          line.variant_id,
        ])
      } else {
        await client.query("update variants set inventory_sync = false where id = $1", [line.variant_id])
      }
      const { rows: affected } = await client.query(
        `update inventory_push_lines set resolution = $2, inventory_item_id = $3, resolved_by = $4, resolved_at = now()
          where variant_id = $1 and resolution is null returning push_id`,
        [line.variant_id, action === "link" ? "linked" : "dismissed", action === "link" ? inventoryItemId : null, by]
      )
      touched.push(...affected.map((row) => row.push_id))
    } else {
      await client.query(
        `update inventory_push_lines set resolution = $2, inventory_item_id = $3, resolved_by = $4, resolved_at = now()
          where id = $1`,
        [lineId, action === "one_off" ? "one_off" : "dismissed", action === "one_off" ? inventoryItemId : null, by]
      )
    }
    await refreshWaiting(client, touched)
    return { pushesTouched: new Set(touched).size }
  })

/**
 * Links a variant to a Pro-Data item from the product editor (null unlinks).
 * Linking means the same as "Link permanently" under Needs linking: any sale
 * of this variant still waiting for a mapping is resolved with it.
 */
const linkVariant = async (variantId, inventoryItemId, by) =>
  tx(async (client) => {
    const { rows: variants } = await client.query("select id from variants where id = $1 for update", [variantId])
    if (!variants.length) throw Object.assign(new Error("That product version no longer exists."), { status: 404 })

    if (inventoryItemId === null) {
      await client.query("update variants set inventory_item_id = null where id = $1", [variantId])
      return { linked: false, alsoLinkedTo: [] }
    }

    const { rows: items } = await client.query("select id, removed_at from inventory_items where id = $1", [inventoryItemId])
    if (!items.length) throw Object.assign(new Error("Choose an item from Pro-Data."), { status: 400 })
    if (items[0].removed_at) {
      throw Object.assign(new Error("That item has been removed from Pro-Data, so it can't be linked."), { status: 400 })
    }

    await client.query("update variants set inventory_item_id = $1, inventory_sync = true where id = $2", [
      inventoryItemId,
      variantId,
    ])
    const { rows: affected } = await client.query(
      `update inventory_push_lines set resolution = 'linked', inventory_item_id = $2, resolved_by = $3, resolved_at = now()
        where variant_id = $1 and resolution is null returning push_id`,
      [variantId, inventoryItemId, by]
    )
    await refreshWaiting(client, affected.map((row) => row.push_id))

    // Two web products drawing on one Pro-Data item would each show its full
    // stock. Allowed — bundles and duplicates exist — but worth a warning.
    const { rows: others } = await client.query(
      `select p.id, p.title from variants v join products p on p.id = v.product_id
        where v.inventory_item_id = $1 and v.id <> $2`,
      [inventoryItemId, variantId]
    )
    return { linked: true, resolvedLines: affected.length, alsoLinkedTo: others }
  })

// ---------------------------------------------------------------- sending

const buildComment = (order) => {
  const address = order.shipping_address || {}
  return [
    `WEB #${order.display_id}`,
    [address.first_name, address.last_name].filter(Boolean).join(" "),
    address.phone,
    address.city,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" · ")
    .slice(0, 250)
}

const discountValue = (unit, net, mode) => {
  if (unit <= 0 || net >= unit) return 0
  return mode === "amount" ? money(unit - net) : money(((unit - net) / unit) * 100)
}

/** Same lines, same quantities, same prices — or the cart is not what we built. */
const cartMatches = (cart, expected) => {
  const key = (code, quantity, price) => `${String(code).toLowerCase()}|${Number(quantity)}|${money(price)}`
  const have = cart.map((row) => key(row.code, row.quantity, row.priceAfterDiscount)).sort()
  const want = expected.map((line) => key(line.code, line.quantity, line.net_price)).sort()
  return have.length === want.length && have.every((value, index) => value === want[index])
}

const totalsOf = (lines) => ({
  units: lines.reduce((sum, line) => sum + line.quantity, 0),
  amount: money(lines.reduce((sum, line) => sum + money(line.quantity * Number(line.net_price)), 0)),
})

const backoffMinutes = (attempts) => Math.min(2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MINUTES)

const markFailed = async (pushId, message, attempts) => {
  await query(
    `update inventory_pushes set state = 'failed', last_error = $2,
            next_attempt_at = now() + make_interval(mins => $3), updated_at = now()
      where id = $1`,
    [pushId, String(message).slice(0, 1000), backoffMinutes(attempts)]
  )
}

/** Records success, and flags the order for a manual cancel in Pro-Data if it was canceled meanwhile. */
const markSent = async (push, proDataOrderId, note = null) => {
  await tx(async (client) => {
    const { rows } = await client.query("select status from orders where id = $1", [push.order_id])
    const canceled = rows[0]?.status === "canceled"
    await client.query(
      `update inventory_pushes set state = 'sent', pro_data_order_id = $2, pro_data_status = 'H',
              pro_data_status_at = now(), sent_at = now(), last_error = $3, void_required = $4, updated_at = now()
        where id = $1`,
      [push.id, proDataOrderId, note, canceled]
    )
    await client.query("insert into order_events (order_id, type, data) values ($1, 'inventory_sent', $2)", [
      push.order_id,
      JSON.stringify({ pro_data_order_id: proDataOrderId, ...(note ? { note } : {}) }),
    ])
  })
}

/**
 * Settles a post whose outcome is unknown — a timeout, a dropped connection,
 * a 5xx, or a worker that died mid-send.
 *
 * Pro-Data has no idempotency key, so blindly posting again could create a
 * second order. Instead:
 *   - A new order in their history, after the marker taken just before
 *     posting, whose units and total match: that is ours. Our API user is
 *     dedicated to the web shop and pushes run one at a time, so nothing else
 *     could have put it there.
 *   - No such order, and the cart still holds exactly our lines: the post
 *     never happened (posting empties the cart). Safe to try again.
 *   - Anything else: a person decides. Never retried automatically.
 * If Pro-Data cannot be asked right now, the push stays "sending" and this
 * runs again on a later tick.
 */
const resolveAmbiguous = async (push, lines, cause = null) => {
  const expected = totalsOf(lines)
  let history
  let cart
  try {
    history = await prodata.orderHistory()
    cart = await prodata.getCart()
  } catch (error) {
    await query("update inventory_pushes set last_error = $2, updated_at = now() where id = $1", [
      push.id,
      `Checking whether the order reached Pro-Data: ${error.message}`.slice(0, 1000),
    ])
    return "unresolved"
  }

  const markerIndex = push.history_marker ? history.findIndex((order) => order.orderID === push.history_marker) : -1
  const newer = push.history_marker && markerIndex === -1 ? null : history.slice(0, markerIndex === -1 ? history.length : markerIndex)
  const matches = (newer || []).filter(
    (order) =>
      Number(order.totalItems) === expected.units &&
      Math.abs(Number(order.totalAmount) - expected.amount) <= AMOUNT_TOLERANCE
  )

  if (newer && matches.length === 1) {
    await markSent(push, matches[0].orderID, "Confirmed from Pro-Data's order history after an unclear reply.")
    return "sent"
  }
  if (newer && matches.length === 0 && cartMatches(cart, lines)) {
    // Say what Pro-Data said, when it said something — that is what the
    // admin needs to fix a refusal that keeps coming back.
    const reason = cause?.proDataError ? `Pro-Data refused the order (${cause.message.replace(/^Pro-Data \w+: /, "")})` : "The order did not reach Pro-Data"
    await markFailed(push.id, `${reason}. It will be sent again.`, push.attempts)
    return "retry"
  }

  const reason = !newer
    ? "Pro-Data's order history no longer shows the order it had before sending, so it can't be checked automatically."
    : matches.length > 1
      ? `Several new orders in Pro-Data could be this one (${matches.map((m) => m.orderID).join(", ")}).`
      : "The reply was unclear and the order is not in Pro-Data's history, but the cart there is no longer ours."
  await query(
    "update inventory_pushes set state = 'needs_check', last_error = $2, updated_at = now() where id = $1",
    [push.id, `${reason} Check Pro-Data, then confirm here whether it arrived.`]
  )
  return "needs_check"
}

/** Lines ready to send, with the Pro-Data code each one maps to. */
const sendableLines = async (pushId) => {
  const { rows } = await query(
    `select l.id, l.line_no, l.quantity, l.unit_price, l.net_price, l.resolution, i.code
       from inventory_push_lines l
       join inventory_items i on i.id = l.inventory_item_id
      where l.push_id = $1 and l.resolution in ('auto', 'linked', 'one_off')
      order by l.line_no`,
    [pushId]
  )
  return rows
}

/**
 * Sends one order: clean cart → add every line → check the cart is exactly
 * ours → note the newest order in their history → post.
 *
 * Everything before the post is safe to repeat. The post is not, which is why
 * any unclear outcome from it goes to resolveAmbiguous rather than a retry.
 */
const sendPush = async (claimed) => {
  const push = claimed
  const lines = await sendableLines(push.id)
  if (!lines.length) {
    await query("update inventory_pushes set state = 'dismissed', updated_at = now() where id = $1", [push.id])
    return "dismissed"
  }
  const { rows: orders } = await query("select * from orders where id = $1", [push.order_id])
  const order = orders[0]
  // Whatever path re-queued it, a canceled order is never sent.
  if (!order || order.status === "canceled") {
    await query(
      "update inventory_pushes set state = 'dismissed', last_error = 'The order was canceled before it was sent.', updated_at = now() where id = $1",
      [push.id]
    )
    return "dismissed"
  }
  const mode = await settings.get("inventory.discount_mode")

  // ---- safe to repeat -----------------------------------------------------
  try {
    const leftover = await prodata.getCart()
    if (leftover.length) await prodata.emptyCart()

    for (const line of lines) {
      try {
        await prodata.insertIntoCart({
          code: line.code,
          quantity: line.quantity,
          price: money(line.unit_price),
          discount: discountValue(Number(line.unit_price), Number(line.net_price), mode),
          priceAfterDiscount: money(line.net_price),
        })
      } catch (error) {
        if (error.proDataError && /does not exist/i.test(error.message)) {
          // The item this line points at is gone from Pro-Data. Hand the line
          // back to the admin rather than retrying something that cannot work.
          await prodata.emptyCart().catch(() => {})
          await tx(async (client) => {
            await client.query(
              `update inventory_push_lines set resolution = null, inventory_item_id = null, resolved_by = null,
                      resolved_at = null where id = $1`,
              [line.id]
            )
            await client.query(
              "update inventory_pushes set state = 'waiting_links', last_error = $2, updated_at = now() where id = $1",
              [push.id, `Pro-Data no longer has item ${line.code}. Choose another item for that line.`]
            )
          })
          return "waiting_links"
        }
        throw error
      }
    }

    const cart = await prodata.getCart()
    if (!cartMatches(cart, lines)) {
      await prodata.emptyCart().catch(() => {})
      throw new Error("Pro-Data's cart did not match the order after adding the lines.")
    }

    const history = await prodata.orderHistory()
    await query("update inventory_pushes set history_marker = $2, updated_at = now() where id = $1", [
      push.id,
      history[0]?.orderID || null,
    ])
    push.history_marker = history[0]?.orderID || null
  } catch (error) {
    await markFailed(push.id, error.message, push.attempts)
    return "failed"
  }

  // ---- not safe to repeat ---------------------------------------------------
  let result
  try {
    result = await prodata.postOrder({ comment: buildComment(order) })
  } catch (error) {
    // "No Rows to be posted" means the cart was empty, so nothing was created.
    if (error.proDataError && /no rows to be posted/i.test(error.message)) {
      await markFailed(push.id, "Pro-Data found the cart empty when posting. It will be sent again.", push.attempts)
      return "failed"
    }
    return resolveAmbiguous(push, lines, error)
  }

  if (!result.orderId) return resolveAmbiguous(push, lines)
  await markSent(push, result.orderId)
  return "sent"
}

/**
 * The worker. Pushes go strictly one at a time: Pro-Data's cart is a single
 * server-side cart per API user, and two pushes filling it at once would post
 * each other's lines.
 */
const runPushes = async () => {
  const outcome = { sent: 0, failed: 0, waiting_links: 0, needs_check: 0, retry: 0, dismissed: 0, unresolved: 0 }

  // Recover sends interrupted by a crash or restart.
  const { rows: stale } = await query(
    `select * from inventory_pushes
      where state = 'sending' and updated_at < now() - make_interval(mins => $1)`,
    [STALE_SENDING_MINUTES]
  )
  for (const push of stale) {
    if (!push.history_marker) {
      // It never reached the post step, so nothing can have been posted.
      await markFailed(push.id, "Sending was interrupted before posting. It will be sent again.", push.attempts)
      outcome.retry++
      continue
    }
    outcome[await resolveAmbiguous(push, await sendableLines(push.id))]++
  }

  for (let i = 0; i < PUSHES_PER_TICK; i++) {
    const { rows } = await query(
      `update inventory_pushes set state = 'sending', attempts = attempts + 1, history_marker = null, updated_at = now()
        where id = (
          select id from inventory_pushes
           where state in ('queued', 'failed') and next_attempt_at <= now()
           order by next_attempt_at, created_at for update skip locked limit 1)
        returning *`
    )
    if (!rows.length) break
    outcome[await sendPush(rows[0])]++
  }
  return outcome
}

// ---------------------------------------------------------------- order events

/**
 * The order left `pending` — create its push in the same transaction as the
 * status change. Only when Pro-Data is configured: orders from before the
 * integration existed are not sent retroactively.
 */
const onOrderConfirmed = async (client, order) => {
  if (!prodata.isConfigured()) return null
  return createPush(client, order)
}

/**
 * The order was canceled. Anything not yet sent is simply dropped. An order
 * Pro-Data already has cannot be canceled through their API, so it is flagged
 * for someone to cancel it there by hand. Sends in flight or in doubt settle
 * this themselves when they finish (markSent checks the order's status).
 */
const onOrderCanceled = async (client, orderId) => {
  await client.query(
    `update inventory_pushes set
       state = case when state in ('waiting_links', 'queued', 'failed') then 'dismissed' else state end,
       void_required = case when state = 'sent' and coalesce(pro_data_status, 'H') <> 'A' then true else void_required end,
       last_error = case when state in ('waiting_links', 'queued', 'failed') then 'The order was canceled before it was sent.'
                         else last_error end,
       updated_at = now()
     where order_id = $1`,
    [orderId]
  )
}

/**
 * Admin action on an order: send it now (creating the push if the order never
 * got one), or retry one that failed.
 */
const sendNow = async (orderId) =>
  tx(async (client) => {
    const { rows: orders } = await client.query("select * from orders where id = $1 for update", [orderId])
    const order = orders[0]
    if (!order) throw Object.assign(new Error("Order not found."), { status: 404 })
    if (order.status === "canceled") throw Object.assign(new Error("A canceled order is not sent to Pro-Data."), { status: 400 })

    const created = await createPush(client, order)
    if (created) return created
    const { rows } = await client.query(
      `update inventory_pushes set state = 'queued', next_attempt_at = now(), updated_at = now()
        where order_id = $1 and state = 'failed' returning id, state`,
      [orderId]
    )
    if (rows.length) return rows[0]
    const { rows: current } = await client.query("select id, state from inventory_pushes where order_id = $1", [orderId])
    return current[0]
  })

/**
 * A person settles a push that needs checking, or ticks off a manual cancel.
 *   arrived      it is in Pro-Data — record its order number
 *   send_again   it is not in Pro-Data — send it
 *   void_done    the order was canceled in Pro-Data by hand
 */
const resolvePush = async (orderId, { action, proDataOrderId }) => {
  const { rows } = await query("select * from inventory_pushes where order_id = $1", [orderId])
  const push = rows[0]
  if (!push) throw Object.assign(new Error("This order has not been sent to Pro-Data."), { status: 404 })

  if (action === "arrived") {
    if (push.state !== "needs_check") throw Object.assign(new Error("Only an order waiting for a check can be confirmed."), { status: 409 })
    await markSent(push, proDataOrderId, "Confirmed by hand after checking Pro-Data.")
  } else if (action === "send_again") {
    if (push.state !== "needs_check") throw Object.assign(new Error("Only an order waiting for a check can be sent again."), { status: 409 })
    await query(
      `update inventory_pushes set state = 'queued', next_attempt_at = now(), last_error = null, updated_at = now()
        where id = $1`,
      [push.id]
    )
  } else if (action === "void_done") {
    if (!push.void_required) throw Object.assign(new Error("Nothing needs canceling in Pro-Data for this order."), { status: 409 })
    await query("update inventory_pushes set void_done_at = now(), updated_at = now() where id = $1", [push.id])
  }
}

module.exports = {
  netUnitPrices,
  createPush,
  resolveLine,
  linkVariant,
  runPushes,
  sendPush,
  resolveAmbiguous,
  onOrderConfirmed,
  onOrderCanceled,
  sendNow,
  resolvePush,
  buildComment,
  discountValue,
  cartMatches,
}
