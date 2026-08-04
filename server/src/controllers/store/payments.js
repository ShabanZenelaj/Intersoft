const { query, tx } = require("../../db")
const raiaccept = require("../../services/raiaccept")
const mail = require("../../services/mail")
const { logError } = require("../../lib/error-log")

/**
 * RaiAccept notification webhook.
 *
 * Three things shape this handler, all of them from their documentation:
 *
 *   1. The webhook is *not* the confirmation. Their docs say to call Retrieve
 *      order details afterwards and treat that as the truth, so the payload is
 *      used only to work out which order is being talked about.
 *   2. It is retried up to three times, so it has to be idempotent — the same
 *      notification arriving twice must not refund twice, restock twice or
 *      send two emails.
 *   3. It is a public endpoint. Anyone can post to it, which is exactly why
 *      nothing here is believed without asking RaiAccept.
 *
 * It always answers 200 once it has understood the request: a non-2xx makes
 * them retry, and retrying will not fix a payment that genuinely failed.
 */

/** Their SUCCESS on the purchase transaction is what makes an order paid. */
const isSuccessful = (transaction) =>
  String(transaction?.status || "").toUpperCase() === "SUCCESS" || String(transaction?.statusCode) === "0000"

/** Finds our order from whatever the notification gave us. */
const findOrder = async (body) => {
  const raiOrderId = body?.order?.orderIdentification
  const reference = body?.order?.invoice?.merchantOrderReference

  if (raiOrderId) {
    const { rows } = await query("select * from orders where raiaccept_order_id = $1", [raiOrderId])
    if (rows.length) return rows[0]
  }
  if (reference) {
    const { rows } = await query("select * from orders where payment_reference = $1", [reference])
    if (rows.length) return rows[0]
  }
  return null
}

/** Mirrors the stored card so the account area can show it later. */
const rememberCard = async (order, card) => {
  if (!order.customer_id || !card?.cardToken) return
  await query(
    `insert into customer_cards (customer_id, card_token, masked_number, brand, issuer_country, holder_name, last_used_at)
     values ($1,$2,$3,$4,$5,$6, now())
     on conflict (customer_id, card_token)
       do update set last_used_at = now(), masked_number = excluded.masked_number, brand = excluded.brand`,
    [
      order.customer_id,
      card.cardToken,
      String(card.maskedCardNumber || "").slice(0, 32),
      String(card.type || "").slice(0, 32),
      String(card.issuerCountry || "").slice(0, 8),
      String(card.cardHolderName || "").slice(0, 100),
    ]
  )
}

const markPaid = async (order, { transaction, card }) => {
  // Idempotency: only the transition out of 'awaiting' does any work.
  const { rows } = await query(
    `update orders
        set payment_status = 'paid',
            raiaccept_transaction_id = coalesce($1, raiaccept_transaction_id),
            card_brand = coalesce($2, card_brand),
            card_masked = coalesce($3, card_masked),
            payment_data = coalesce(payment_data, '{}'::jsonb) || $4::jsonb,
            updated_at = now()
      where id = $5 and payment_status = 'awaiting'
      returning *`,
    [
      transaction?.transactionId || null,
      card?.type || null,
      card?.maskedCardNumber || null,
      JSON.stringify({
        raiaccept_transaction_id: transaction?.transactionId || null,
        status_code: transaction?.statusCode || null,
        status_message: transaction?.statusMessage || null,
        settled_at: new Date().toISOString(),
      }),
      order.id,
    ]
  )
  if (!rows.length) return { changed: false }

  await query("insert into order_events (order_id, type, data) values ($1, 'payment_captured', $2)", [
    order.id,
    JSON.stringify({ method: "card", by: "raiaccept", transaction_id: transaction?.transactionId || null }),
  ])
  await rememberCard(order, card)

  // Only now is the order real to the customer.
  mail.sendOrderConfirmation(rows[0])
  return { changed: true, order: rows[0] }
}

const markFailed = async (order, { transaction }) => {
  // Same guard: a second notification must not restock a second time.
  const restocked = await tx(async (client) => {
    const { rows } = await client.query(
      `update orders set status = 'canceled', updated_at = now()
        where id = $1 and status <> 'canceled' and payment_status = 'awaiting'
        returning *`,
      [order.id]
    )
    if (!rows.length) return null
    for (const item of rows[0].items || []) {
      await client.query("update variants set stock = stock + $1 where id = $2 and manage_stock", [
        item.quantity,
        item.variant_id,
      ])
    }
    return rows[0]
  })
  if (!restocked) return { changed: false }

  await query("insert into order_events (order_id, type, data) values ($1, 'status_changed', $2)", [
    order.id,
    JSON.stringify({
      from: order.status,
      to: "canceled",
      restocked: true,
      reason: "card payment failed",
      status_code: transaction?.statusCode || null,
    }),
  ])
  return { changed: true, order: restocked }
}

const webhook = async (req, res) => {
  console.log("[raiaccept:webhook] received", {
    bodyKeys: Object.keys(req.body || {}),
    transactionType: req.body?.transaction?.transactionType || null,
    transactionStatus: req.body?.transaction?.status || null,
    transactionStatusCode: req.body?.transaction?.statusCode || null,
    orderIdentification: req.body?.order?.orderIdentification || null,
    merchantOrderReference: req.body?.order?.invoice?.merchantOrderReference || null,
  })

  console.log("[raiaccept:webhook] finding matching order")
  const order = await findOrder(req.body)

  if (!order) {
    console.log("[raiaccept:webhook] no matching order found", {
      orderIdentification: req.body?.order?.orderIdentification || null,
      merchantOrderReference: req.body?.order?.invoice?.merchantOrderReference || null,
    })

    // Nothing to do, but say so cleanly so they stop retrying.
    return res.json({ received: true, matched: false })
  }

  console.log("[raiaccept:webhook] matched order", {
    orderId: order.id,
    displayId: order.display_id,
    status: order.status,
    paymentStatus: order.payment_status,
    raiacceptOrderId: order.raiaccept_order_id,
    paymentReference: order.payment_reference,
  })

  const incomingTransactionType = String(req.body?.transaction?.transactionType || "").toUpperCase()

  // Refund notifications are informational — the admin already recorded the
  // refund when it issued one, so there is nothing to settle here.
  if (String(req.body?.transaction?.transactionType || "").toUpperCase() === "REFUND") {
    console.log("[raiaccept:webhook] refund notification ignored as informational", {
      orderId: order.id,
      transactionId: req.body?.transaction?.transactionId || null,
      status: req.body?.transaction?.status || null,
      statusCode: req.body?.transaction?.statusCode || null,
    })

    return res.json({ received: true, matched: true, handled: "refund_notification" })
  }

  let confirmed
  try {
    // The webhook said something happened; RaiAccept says what.
    console.log("[raiaccept:webhook] verifying transactions with RaiAccept", {
      orderId: order.id,
      raiacceptOrderId: order.raiaccept_order_id,
    })

    confirmed = await raiaccept.listTransactions(order.raiaccept_order_id)

    console.log("[raiaccept:webhook] RaiAccept verification response received", {
      isArray: Array.isArray(confirmed),
      hasTransactions: Array.isArray(confirmed?.transactions),
      transactionCount: Array.isArray(confirmed) ? confirmed.length : confirmed?.transactions?.length || 0,
      hasCard: Boolean(confirmed?.card),
    })
  } catch (error) {
    console.error("[raiaccept:webhook] RaiAccept verification failed", {
      orderId: order.id,
      raiacceptOrderId: order.raiaccept_order_id,
      errorName: error?.name,
      errorMessage: error?.message,
      errorStack: error?.stack,
    })

    // Their API is unreachable. Answer 5xx so the retry is actually useful.
    await logError({ kind: "server_error", error, req, status: 502 })
    return res.status(502).json({ received: false, message: "Could not verify with RaiAccept." })
  }

  const transactions = Array.isArray(confirmed) ? confirmed : confirmed.transactions || []

  console.log("[raiaccept:webhook] confirmed transactions summary", {
    orderId: order.id,
    transactionCount: transactions.length,
    transactions: transactions.map((t) => ({
      transactionId: t.transactionId || null,
      transactionType: t.transactionType || null,
      status: t.status || null,
      statusCode: t.statusCode || null,
      statusMessage: t.statusMessage || null,
      createdOn: t.createdOn || null,
      updatedOn: t.updatedOn || null,
    })),
  })

  const purchase = transactions
    .filter((t) => String(t.transactionType || "").toUpperCase() === "PURCHASE")
    .sort((a, b) => new Date(b.updatedOn || b.createdOn || 0) - new Date(a.updatedOn || a.createdOn || 0))[0]

  console.log("[raiaccept:webhook] selected purchase transaction", {
    orderId: order.id,
    foundPurchase: Boolean(purchase),
    transactionId: purchase?.transactionId || null,
    status: purchase?.status || null,
    statusCode: purchase?.statusCode || null,
    successful: purchase ? isSuccessful(purchase) : false,
  })

  const card = req.body?.card || confirmed.card || null

  console.log("[raiaccept:webhook] card info presence", {
    orderId: order.id,
    hasIncomingCard: Boolean(req.body?.card),
    hasConfirmedCard: Boolean(confirmed?.card),
    hasSelectedCard: Boolean(card),
    cardType: card?.type || null,
    maskedCardNumber: card?.maskedCardNumber || null,
    hasCardToken: Boolean(card?.cardToken),
  })

  if (purchase && isSuccessful(purchase)) {
    console.log("[raiaccept:webhook] marking order paid", {
      orderId: order.id,
      transactionId: purchase?.transactionId || null,
    })

    const result = await markPaid(order, { transaction: purchase, card })

    console.log("[raiaccept:webhook] markPaid result", {
      orderId: order.id,
      changed: result.changed,
      returnedOrderId: result.order?.id || null,
      returnedPaymentStatus: result.order?.payment_status || null,
    })

    return res.json({ received: true, matched: true, outcome: "paid", changed: result.changed })
  }

  console.log("[raiaccept:webhook] marking order failed", {
    orderId: order.id,
    hasPurchase: Boolean(purchase),
    fallbackTransactionId: req.body?.transaction?.transactionId || null,
    fallbackStatus: req.body?.transaction?.status || null,
    fallbackStatusCode: req.body?.transaction?.statusCode || null,
  })

  const result = await markFailed(order, { transaction: purchase || req.body?.transaction })

  console.log("[raiaccept:webhook] markFailed result", {
    orderId: order.id,
    changed: result.changed,
    returnedOrderId: result.order?.id || null,
    returnedStatus: result.order?.status || null,
    returnedPaymentStatus: result.order?.payment_status || null,
  })

  return res.json({ received: true, matched: true, outcome: "failed", changed: result.changed })
}

/**
 * Where the shopper lands after the payment window.
 *
 * The redirect is only a frontend hint — their docs are explicit that it does
 * not reflect the real result — so this reports the order's current state and
 * nudges RaiAccept for an answer if the webhook has not arrived yet.
 */
const status = async (req, res) => {
  const { rows } = await query("select * from orders where id = $1", [req.params.id])
  if (!rows.length) return res.status(404).json({ message: "Order not found." })
  let order = rows[0]

  if (order.payment_method === "card" && order.payment_status === "awaiting" && order.raiaccept_order_id) {
    try {
      const confirmed = await raiaccept.listTransactions(order.raiaccept_order_id)
      const transactions = Array.isArray(confirmed) ? confirmed : confirmed.transactions || []
      const purchase = transactions.find((t) => String(t.transactionType || "").toUpperCase() === "PURCHASE")
      if (purchase && isSuccessful(purchase)) {
        const result = await markPaid(order, { transaction: purchase, card: confirmed.card })
        if (result.order) order = result.order
      }
    } catch {
      // Leave it awaiting; the webhook or a later visit will settle it.
    }
  }

  res.json({
    order_id: order.id,
    display_id: order.display_id,
    status: order.status,
    payment_status: order.payment_status,
    paid: order.payment_status === "paid",
  })
}

module.exports = { webhook, status }
