const rateLimit = require("express-rate-limit")
const { ipKeyGenerator } = require("express-rate-limit")

/**
 * Shared limiter instances.
 *
 * Each instance owns one counter bucket, so endpoints sharing a limiter share
 * an allowance — sometimes deliberately (see storeAuthLimiter).
 *
 * Limits are set far above what a real person does in a quarter of an hour:
 * the goal is to stop a script, not to cost you a sale. If one ever fires for
 * a genuine customer, raise it.
 */

/**
 * Which shopper a request belongs to.
 *
 * This matters more than it looks. The storefront renders on the server, so it
 * reaches this API machine-to-machine: left alone, every shopper in the country
 * arrives as one address and shares a single bucket, and one script could lock
 * the whole shop out of checkout.
 *
 * So the storefront names the shopper in `x-shopper-address`. That header is
 * believed only when the request genuinely comes from the storefront — a
 * loopback or private-network peer. A request off the open internet has a
 * public socket address, so inventing the header buys nothing and the caller is
 * keyed by their own address as usual.
 *
 * A dedicated header rather than `x-forwarded-for` on purpose: XFF belongs to
 * whatever proxy sits in front of this server, and overloading it would make
 * the two meanings impossible to tell apart.
 */
const PRIVATE_PEER = /^(::1$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::ffff:(127\.|10\.|192\.168\.))/

const clientKey = (req) => {
  const peer = req.socket?.remoteAddress || ""
  if (PRIVATE_PEER.test(peer)) {
    const shopper = String(req.get("x-shopper-address") || "").trim()
    if (shopper) return ipKeyGenerator(shopper)
  }
  // Otherwise express's own value, which honours `trust proxy` and already
  // ignores addresses a client tries to prepend to x-forwarded-for.
  return ipKeyGenerator(req.ip)
}

/** The API answers in JSON everywhere else; a 429 should not be the exception. */
const tooMany = (message) => ({
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  handler: (_req, res) => res.status(429).json({ message }),
})

/**
 * Registering, signing in, resetting a password and looking up an order by
 * number are all guessing-prone, so 30 attempts per quarter hour covers the
 * lot rather than 30 each.
 */
const storeAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  ...tooMany("Too many attempts. Please wait a few minutes and try again."),
})

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  ...tooMany("Too many sign-in attempts. Please wait a few minutes and try again."),
})

/**
 * Creating a cart is unauthenticated and writes a row, so it is the cheapest
 * way to fill the database from outside. A shopper needs one cart, maybe a
 * handful across devices; 60 leaves enormous headroom.
 */
const cartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  ...tooMany("Too many requests. Please wait a moment and try again."),
})

/**
 * Placing an order reserves stock and sends email, so unbounded checkout is
 * both a stock-locking and a mail-reputation problem. Twenty orders per
 * quarter hour from one address is far beyond normal shopping.
 */
const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  ...tooMany("Too many orders from this connection. Please wait a few minutes."),
})

/**
 * Promo codes are short and guessable, so this is the one brute-force surface
 * a shopper can reach without an account.
 *
 * `skipSuccessfulRequests` is the important part: a code that works costs
 * nothing, so a customer applying their voucher is never rate limited. Only
 * wrong guesses consume the budget, which is exactly the behaviour to bound.
 */
const promoCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  ...tooMany("Too many invalid codes. Please wait a few minutes before trying another."),
})

module.exports = {
  storeAuthLimiter,
  adminLoginLimiter,
  cartLimiter,
  checkoutLimiter,
  promoCodeLimiter,
}
