const raiaccept = require("./raiaccept")

/**
 * Payment methods.
 *
 * COD and POS are offline: the order is placed as "awaiting" and marked paid
 * from the admin once the courier collects the money.
 *
 * "card" goes to RaiAccept, Raiffeisen's gateway. That one is not settled in
 * the request that places the order — the shopper leaves for the RaiAccept
 * payment window and the result arrives later by webhook. See
 * services/raiaccept.js and controllers/store/payments.js.
 *
 * Without RAIACCEPT_USERNAME / RAIACCEPT_PASSWORD the card option runs in test
 * mode: orders are placed and authorised immediately so the rest of the shop
 * can be developed without the bank.
 */

const METHODS = ["cod", "pos", "card"]

const gatewayConfigured = () => raiaccept.isConfigured()

/** True when this method sends the shopper away to pay before we can settle. */
const isRedirectMethod = (method) => method === "card" && gatewayConfigured()

/** Called when the customer selects a payment method at checkout. */
const initiate = async (method, _cart) => {
  if (!METHODS.includes(method)) {
    const error = new Error("Unknown payment method")
    error.status = 400
    throw error
  }

  if (method === "card" && !gatewayConfigured()) {
    return { test_mode: true, initiated_at: new Date().toISOString() }
  }

  // The RaiAccept session is created once the order exists, because their
  // merchantOrderReference has to point at a real order of ours.
  return { initiated_at: new Date().toISOString() }
}

/**
 * Called as the order is created.
 *
 * Card orders are deliberately *not* authorised here: they are placed awaiting
 * payment, the shopper is redirected, and the webhook settles them. Marking
 * them paid at this point would record money that has not moved.
 */
const authorize = async (method, paymentData) => {
  if (isRedirectMethod(method)) {
    return { ...paymentData, awaiting_redirect: true }
  }
  return { ...paymentData, authorized_at: new Date().toISOString() }
}

/**
 * Refunds. Card refunds go back through RaiAccept against the original
 * purchase transaction; COD and POS are recorded here and settled by hand.
 */
const refund = async (method, paymentData, amount) => {
  const data = paymentData || {}

  if (method === "card" && gatewayConfigured()) {
    const orderId = data.raiaccept_order_id
    const transactionId = data.raiaccept_transaction_id
    if (!orderId || !transactionId) {
      const error = new Error("This card payment has no settled transaction to refund.")
      error.status = 400
      throw error
    }
    const result = await raiaccept.refund(orderId, transactionId, amount)
    return {
      ...data,
      last_refund_at: new Date().toISOString(),
      last_refund_amount: amount,
      last_refund_transaction_id: result.transactionId || result.transaction?.transactionId || null,
      last_refund_status: result.status || result.transaction?.status || null,
    }
  }

  return { ...data, last_refund_at: new Date().toISOString(), last_refund_amount: amount }
}

module.exports = { METHODS, initiate, authorize, refund, gatewayConfigured, isRedirectMethod }
