/**
 * RaiAccept — Raiffeisen's card payment platform.
 * Docs: https://docs.raiaccept.com/code-integration.html
 *
 * The flow their API expects, in order:
 *   1. authenticate (AWS Cognito) → IdToken
 *   2. POST /orders                          create the order entry
 *   3. POST /orders/{id}/checkout            create the payment session
 *   4. send the shopper to paymentRedirectURL
 *   5. their webhook fires → GET /orders/{id} to confirm the real outcome
 *
 * Sandbox and production share these URLs; which one you are in is decided by
 * the credentials you authenticate with, and echoed back as `isProduction`.
 */

const AUTH_URL = process.env.RAIACCEPT_AUTH_URL || "https://authenticate.raiaccept.com"
const API_URL = process.env.RAIACCEPT_API_URL || "https://trapi.raiaccept.com"

// Published by RaiAccept and identical for every merchant; overridable in case
// they ever rotate it.
const CLIENT_ID = process.env.RAIACCEPT_CLIENT_ID || "kr2gs4117arvbnaperqff5dml"

const USERNAME = process.env.RAIACCEPT_USERNAME
const PASSWORD = process.env.RAIACCEPT_PASSWORD

/**
 * Their `country` is a String-ENUM of ISO 3166-1 alpha-3 codes, and the field is
 * "Recommended" rather than "Required".
 *
 * Kosovo is the catch: it has no ISO 3166-1 assignment at all. XK and XKX are
 * user-assigned conventions, and their API rejects XKX outright —
 * `billingAddress.country: Invalid format`. Since the field is optional, an
 * unmappable country is omitted rather than guessed: a missing recommended
 * field is accepted, a wrong one fails the whole checkout.
 *
 * If the bank confirms a code they accept for Kosovo, set
 * RAIACCEPT_KOSOVO_COUNTRY and it is used without a code change.
 */
const ALPHA3 = {
  al: "ALB",
  mk: "MKD",
  me: "MNE",
  rs: "SRB",
  gr: "GRC",
  it: "ITA",
  de: "DEU",
  ...(process.env.RAIACCEPT_KOSOVO_COUNTRY ? { xk: process.env.RAIACCEPT_KOSOVO_COUNTRY } : {}),
}

const isConfigured = () => Boolean(USERNAME && PASSWORD)

const fail = (message, status = 502) => {
  const error = new Error(message)
  error.status = status
  return error
}

// ---------------------------------------------------------------- auth

/**
 * Cognito tokens last an hour, so one is kept in memory and reused. Refreshed a
 * minute early to avoid racing the expiry, and re-fetched from scratch on
 * failure rather than retried with a stale token.
 */
let cached = { token: null, expiresAt: 0 }

const authenticate = async () => {
  if (cached.token && Date.now() < cached.expiresAt) return cached.token
  if (!isConfigured()) throw fail("Card payments are not configured.", 503)

  const response = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
    },
    body: JSON.stringify({
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME, PASSWORD },
      ClientId: CLIENT_ID,
    }),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw fail(`RaiAccept authentication failed (${response.status}): ${body.message || "no detail"}`)
  }

  const result = body.AuthenticationResult || {}
  if (!result.IdToken) throw fail("RaiAccept authentication returned no token.")

  // ExpiresIn is seconds; hold the token for a minute less than that.
  const ttl = (Number(result.ExpiresIn) || 3600) * 1000
  cached = { token: result.IdToken, expiresAt: Date.now() + Math.max(ttl - 60_000, 30_000) }
  return cached.token
}

/** Drops the cached token, so the next call authenticates again. */
const resetAuth = () => {
  cached = { token: null, expiresAt: 0 }
}

// ---------------------------------------------------------------- requests

const request = async (method, path, body, { retryOnAuthFailure = true } = {}) => {
  const token = await authenticate()
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  // A token can expire between the check and the call; take one clean retry.
  if (response.status === 401 && retryOnAuthFailure) {
    resetAuth()
    return request(method, path, body, { retryOnAuthFailure: false })
  }

  const text = await response.text()
  let payload = {}
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = { raw: text }
  }

  if (!response.ok) {
    // Their validation errors come back as { errors: [{ fieldName, message }] }.
    const detail =
      (payload.errors || []).map((e) => `${e.fieldName}: ${e.message}`).join("; ") ||
      payload.message ||
      payload.raw ||
      "no detail"
    const error = fail(`RaiAccept ${method} ${path} failed (${response.status}): ${detail}`)
    // Their status, kept separate from the one we answer our own caller with.
    error.upstreamStatus = response.status
    throw error
  }
  return payload
}

// ---------------------------------------------------------------- payloads

const person = (address = {}) => {
  const country = ALPHA3[String(address.country_code || "").toLowerCase()]
  return {
    firstName: String(address.first_name || "").slice(0, 32),
    lastName: String(address.last_name || "").slice(0, 32),
    addressStreet1: String(address.address_1 || "").slice(0, 50),
    addressStreet2: "",
    addressStreet3: "",
    city: String(address.city || "").slice(0, 50),
    postalCode: String(address.postal_code || "").slice(0, 16),
    ...(country ? { country } : {}),
    state: "",
  }
}

/**
 * Maps one of our orders onto their order payload.
 *
 * `recurring` is what turns this into one-click checkout: passing the shopper's
 * customerReference makes RaiAccept offer to store the card, and show it again
 * on their next visit. Guests have no stable id, so they get a plain purchase.
 */
const orderPayload = ({ order, reference, urls, customerReference, cardToken }) => {
  const shipping = order.shipping_address || {}
  const items = (order.items || []).map((item) => ({
    description: String(item.product_title || item.title || "Item").slice(0, 100),
    numberOfItems: item.quantity,
    price: Number(item.unit_price),
  }))

  const payload = {
    consumer: {
      firstName: String(shipping.first_name || "").slice(0, 32),
      lastName: String(shipping.last_name || "").slice(0, 32),
      email: String(order.email || "").slice(0, 255),
      mobilePhone: String(shipping.phone || "").replace(/\s/g, "").slice(0, 15),
      phone: "",
      workPhone: "",
      ipAddress: String(order.ip_address || "").slice(0, 255),
    },
    billingAddress: person(shipping),
    shippingAddress: person(shipping),
    invoice: {
      amount: Number(order.total),
      currency: "EUR",
      description: `Intersoft order #${order.display_id}`.slice(0, 200),
      merchantOrderReference: reference,
      items,
    },
    paymentMethodPreference: "CARD",
    urls,
  }

  // Only send `recurring` when there is something to say — sending an empty
  // customerReference would make every guest look like the same shopper.
  if (customerReference || cardToken) {
    payload.recurring = {
      recurringModel: "ONE_CLICK_CHECKOUT",
      ...(customerReference ? { customerReference } : {}),
      ...(cardToken ? { cardToken } : {}),
    }
  }
  return payload
}

// ---------------------------------------------------------------- operations

/**
 * Creates the order entry and its payment session in the two steps their API
 * requires, and hands back the URL to send the shopper to.
 *
 * Their docs are explicit that both requests must carry the same parameters.
 */
const createCheckout = async (args) => {
  const payload = orderPayload(args)
  const created = await request("POST", "/orders", payload)
  const orderIdentification = created.orderIdentification
  if (!orderIdentification) throw fail("RaiAccept created no order identification.")

  const session = await request("POST", `/orders/${encodeURIComponent(orderIdentification)}/checkout`, payload)
  if (!session.paymentRedirectURL) throw fail("RaiAccept created no payment session.")

  return {
    orderIdentification,
    sessionId: session.sessionId,
    paymentUrl: session.paymentRedirectURL,
    merchantAccountId: created.merchant?.merchantAccountId || null,
    isProduction: created.isProduction ?? null,
  }
}

/** The authoritative outcome — their webhook explicitly is not. */
const getOrder = (orderIdentification) =>
  request("GET", `/orders/${encodeURIComponent(orderIdentification)}`)

/**
 * Their docs document this as `POST .../transactions`, but the live API answers
 * POST with `405 HTTP request method is not supported`. GET is what actually
 * works, and matches the sibling single-transaction endpoint below.
 *
 * Both are attempted because of what this call decides. It is what settles a
 * paid order: if it throws, the webhook answers 5xx, RaiAccept gives up after
 * three retries, and a shopper whose card was charged is left looking at an
 * unpaid order while its stock stays held. Not worth risking on one reading of
 * a document their own server contradicts — so the undocumented-but-working
 * verb is tried first and the documented one kept as a fallback.
 */
const listTransactions = async (orderIdentification) => {
  const path = `/orders/${encodeURIComponent(orderIdentification)}/transactions`
  try {
    return await request("GET", path)
  } catch (error) {
    if (error.upstreamStatus !== 405) throw error
    return request("POST", path)
  }
}

const getTransaction = (orderIdentification, transactionId) =>
  request("GET", `/orders/${encodeURIComponent(orderIdentification)}/transactions/${encodeURIComponent(transactionId)}`)

/** Partial or full; must be the original currency and never more than was taken. */
const refund = (orderIdentification, transactionId, amount) =>
  request("POST", `/orders/${encodeURIComponent(orderIdentification)}/transactions/${encodeURIComponent(transactionId)}/refund`, {
    amount: Number(amount),
    currency: "EUR",
  })

module.exports = {
  isConfigured,
  authenticate,
  resetAuth,
  createCheckout,
  getOrder,
  listTransactions,
  getTransaction,
  refund,
  orderPayload,
  ALPHA3,
}
