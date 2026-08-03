const slugify = (value) =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

const money = (value) => Math.round(Number(value) * 100) / 100

const isUuid = (value) =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

const isEmail = (value) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

/** Wraps async route handlers so thrown errors reach the error middleware. */
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

/**
 * Wraps every handler a controller exports with asyncRoute, so controllers can
 * be written as plain `async (req, res)` functions and the route tables can
 * reference them directly:
 *
 *   const products = controller(require("../controllers/admin/products"))
 *   router.get("/products", products.list)
 *
 * Non-function exports (shared constants) are passed through untouched.
 */
const controller = (handlers) =>
  Object.fromEntries(
    Object.entries(handlers).map(([name, value]) => [name, typeof value === "function" ? asyncRoute(value) : value])
  )

/** 400-throwing assertion for request validation. */
const check = (condition, message) => {
  if (!condition) {
    const error = new Error(message)
    error.status = 400
    throw error
  }
}

const pageParams = (req, defaultLimit = 50, maxLimit = 200) => {
  const limit = Math.min(Math.max(1, Number(req.query.limit) || defaultLimit), maxLimit)
  const offset = Math.max(0, Number(req.query.offset) || 0)
  return { limit, offset }
}

module.exports = { slugify, money, isUuid, isEmail, asyncRoute, controller, check, pageParams }
