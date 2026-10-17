/**
 * Pro-Data — the inventory app where the business keeps its products and
 * receives orders. Swagger: <PRODATA_URL>/Swagger/index.html
 *
 * Their documentation leaves most responses undescribed, so everything this
 * client assumes was established by calling the API itself. The quirks it
 * absorbs, so no other module has to know about them:
 *
 *   - Failures often arrive as HTTP 200 with `hasError: true` in the body.
 *   - An empty cart is a plain-text 404, not an empty list.
 *   - An unknown order is a plain-text 404.
 *   - A missing image is a 200 with an empty body.
 *   - Text fields use the literal string "[EditValue is null]" for "empty".
 *   - `B2BPostBulkOrder` is broken on their side (its stored procedure is
 *     called without a required parameter), so orders go through the cart.
 *
 * Every endpoint takes its input as query parameters, including POSTs, and
 * acts as the `username` the token was issued to — for this integration, a
 * dedicated user whose Pro-Data subject is the web shop.
 */

const BASE_URL = () => (process.env.PRODATA_URL || "").replace(/\/+$/, "")
const USERNAME = () => process.env.PRODATA_USERNAME || ""
const PASSWORD = () => process.env.PRODATA_PASSWORD || ""
const UNIQUE_IDENT = () => process.env.PRODATA_UNIQUEIDENT || ""

const isConfigured = () => Boolean(BASE_URL() && USERNAME() && PASSWORD())

const DEFAULT_TIMEOUT = 20_000
// Posting an order took ~3s on their demo. A generous timeout here means fewer
// ambiguous outcomes, and every ambiguous outcome costs a history lookup.
const POST_ORDER_TIMEOUT = 45_000

const NULL_SENTINEL = "[EditValue is null]"

const fail = (message, { status = 502, upstreamStatus = null, proDataError = false } = {}) => {
  const error = new Error(message)
  error.status = status
  error.upstreamStatus = upstreamStatus
  // True when Pro-Data answered and explicitly said no (hasError), as opposed
  // to not answering at all.
  error.proDataError = proDataError
  return error
}

// ---------------------------------------------------------------- throttle

/**
 * Their API runs on an office server. However many jobs want it at once, at
 * most this many requests are in flight.
 */
const MAX_IN_FLIGHT = 3
let inFlight = 0
const waiting = []

const acquire = () =>
  new Promise((resolve) => {
    if (inFlight < MAX_IN_FLIGHT) {
      inFlight++
      resolve()
    } else {
      waiting.push(resolve)
    }
  })

const release = () => {
  const next = waiting.shift()
  if (next) next()
  else inFlight--
}

// ---------------------------------------------------------------- auth

let cached = { token: null, expiresAt: 0 }

/** Reads `exp` out of a JWT without verifying it — we only need the timing. */
const tokenExpiry = (token) => {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"))
    return Number(payload.exp) ? Number(payload.exp) * 1000 : null
  } catch {
    return null
  }
}

/**
 * Tokens last seven days. One is kept in memory and replaced an hour before it
 * expires, or on the first 401.
 *
 * The login response's exact shape is not documented, so the token is found by
 * its form — three base64url segments starting "eyJ" — wherever it sits.
 */
const authenticate = async () => {
  if (cached.token && Date.now() < cached.expiresAt) return cached.token
  if (!isConfigured()) throw fail("Pro-Data is not configured.", { status: 503 })

  const params = new URLSearchParams({ username: USERNAME(), password: PASSWORD(), Uniqueident: UNIQUE_IDENT() })
  let response
  try {
    response = await fetch(`${BASE_URL()}/ProDataRestAPI/B2BLogUser?${params}`, {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    })
  } catch (error) {
    throw fail(`Pro-Data sign-in could not reach the server: ${error.message}`)
  }
  const text = await response.text()
  const token = (text.match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/) || [])[0]
  if (!response.ok || !token) {
    // Never echo the body: a login response is the one place a token or a
    // password-shaped value could appear in an error message.
    let reason = `HTTP ${response.status}`
    try {
      const body = JSON.parse(text)
      if (body?.errorMsg) reason = body.errorMsg
    } catch {
      /* not JSON */
    }
    throw fail(`Pro-Data sign-in failed: ${reason}`, { upstreamStatus: response.status })
  }

  const expiry = tokenExpiry(token) || Date.now() + 6 * 24 * 3600_000
  cached = { token, expiresAt: Math.max(expiry - 3600_000, Date.now() + 60_000) }
  return token
}

const resetAuth = () => {
  cached = { token: null, expiresAt: 0 }
}

// ---------------------------------------------------------------- requests

/** Replaces their "[EditValue is null]" placeholder with a real empty string, at any depth. */
const clean = (value) => {
  if (value === NULL_SENTINEL) return ""
  if (Array.isArray(value)) return value.map(clean)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, clean(inner)]))
  }
  return value
}

/** Their errors come back inside a 200, either on the object or on every row. */
const assertNoError = (name, body) => {
  const rows = Array.isArray(body) ? body : [body]
  const failed = rows.find((row) => row && typeof row === "object" && row.hasError === true)
  if (failed) {
    throw fail(`Pro-Data ${name}: ${failed.errorMsg || "request refused"}`, { upstreamStatus: 200, proDataError: true })
  }
}

/**
 * @param {string} method
 * @param {string} name     endpoint name, e.g. "Items"
 * @param {object} params   query parameters (their API takes everything this way)
 * @param {object} options  { timeout, binary, notFound: (text) => value }
 *   notFound — how to read a 404. Their 404s are plain text meaning "nothing
 *   here", not errors, for some endpoints; for those, return the empty value.
 */
const request = async (method, name, params = {}, options = {}, retryOnAuthFailure = true) => {
  const token = await authenticate()
  const url = `${BASE_URL()}/ProDataRestAPI/${name}?${new URLSearchParams(params)}`

  await acquire()
  let response
  let buffer
  try {
    response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(options.timeout || DEFAULT_TIMEOUT),
    })
    buffer = Buffer.from(await response.arrayBuffer())
  } catch (error) {
    // A network failure or timeout — Pro-Data may or may not have acted.
    throw fail(`Pro-Data ${name} did not answer: ${error.message}`, { upstreamStatus: null })
  } finally {
    release()
  }

  if (response.status === 401 && retryOnAuthFailure) {
    resetAuth()
    return request(method, name, params, options, false)
  }

  if (response.status === 404 && options.notFound) return options.notFound(buffer.toString("utf8"))

  if (!response.ok) {
    const detail = buffer.toString("utf8").slice(0, 300) || "no detail"
    throw fail(`Pro-Data ${name} failed (${response.status}): ${detail}`, { upstreamStatus: response.status })
  }

  if (options.binary) return buffer

  const text = buffer.toString("utf8")
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    throw fail(`Pro-Data ${name} returned something that is not JSON.`, { upstreamStatus: response.status })
  }
  assertNoError(name, body)
  return clean(body)
}

// ---------------------------------------------------------------- catalog

/**
 * One page of the catalog. Their pages contain exact duplicate rows (the same
 * item repeated), so callers de-duplicate by code. A page shorter than
 * `rowsPerPage` is the last one — true of this endpoint, though NOT of
 * ItemsStoku, whose pages are filtered after paging and come back sparse.
 */
const listItems = ({ page = 1, rowsPerPage = 1000 } = {}) =>
  request("GET", "Items", { username: USERNAME(), rowsPerPage, pageNumber: page })

/**
 * One item with its brand, comment, second name and per-warehouse stock.
 * The code is matched exactly but case-insensitively. Null when the item has
 * no stock records at all (their answer is then an empty list).
 */
const getItemStock = async (code) => {
  const rows = await request("GET", "ItemsStoku", { username: USERNAME(), ItemCode: code })
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

/** Image `n` (1-based) of an item, or null when there is none. */
const getItemImage = async (code, n) => {
  const buffer = await request("GET", "ItemImage", { username: USERNAME(), Code: code, image: n }, { binary: true })
  return buffer.length ? buffer : null
}

const listClassifications = () => request("GET", "ItemsKlasifikimet", { username: USERNAME() })
const listSubClassifications = () => request("GET", "ItemsSubKlasifikimet", { username: USERNAME() })

// ---------------------------------------------------------------- orders

/** The server-side cart for our API user. An empty cart is a 404 on their side. */
const getCart = () =>
  request("GET", "B2BRetrieveCart", { username: USERNAME() }, { notFound: () => [] })

const emptyCart = () => request("DELETE", "B2BEmptyCart", { username: USERNAME() })

const deleteCartRow = (rowId) => request("DELETE", "B2BDeleteRowCart", { username: USERNAME(), rowId })

/**
 * Adds one line. Pro-Data stores `priceAfterDiscount` as the line's price and
 * computes nothing from `discount` — it is carried along for their records
 * only. An unknown code is refused with "Item does not exist."
 */
const insertIntoCart = ({ code, quantity, price, discount, priceAfterDiscount }) =>
  request("POST", "B2BInsertIntoCart", {
    username: USERNAME(),
    itemCode: code,
    quantity,
    price,
    discount,
    priceAfterDiscount,
    variantCode1: "",
    variantCode2: "",
  })

/**
 * Turns the cart into an order and empties the cart. Answers with the new
 * order's id ("26-PSEC-001-30"). The comment is for the people reading the
 * order in Pro-Data; their API never returns it.
 */
const postOrder = async ({ comment }) => {
  const body = await request(
    "POST",
    "B2BPostOrder",
    { username: USERNAME(), Comment: comment, DeliveryMetod: "" },
    { timeout: POST_ORDER_TIMEOUT }
  )
  return { orderId: body?.returnData || null, message: body?.returnText || "" }
}

/**
 * Every order placed by our API user, newest first:
 * { orderID, data (date), status "H"|"M"|"A", totalAmount, totalItems (units) }.
 */
const orderHistory = () => request("GET", "B2BRetrieveOrdeHistory", { username: USERNAME() })

/** The lines of one order, or null when Pro-Data does not know it. */
const orderDetails = (orderId) =>
  request("GET", "B2BRetrieveOrderDetails", { username: USERNAME(), order: orderId }, { notFound: () => null })

module.exports = {
  isConfigured,
  authenticate,
  resetAuth,
  listItems,
  getItemStock,
  getItemImage,
  listClassifications,
  listSubClassifications,
  getCart,
  emptyCart,
  deleteCartRow,
  insertIntoCart,
  postOrder,
  orderHistory,
  orderDetails,
  clean,
  NULL_SENTINEL,
}
