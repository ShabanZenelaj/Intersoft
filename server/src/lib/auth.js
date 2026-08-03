const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { query } = require("../db")

const SECRET = process.env.JWT_SECRET
if (!SECRET || SECRET.length < 16) {
  throw new Error("JWT_SECRET must be set (16+ characters) in server/.env")
}

const hashPassword = (plain) => bcrypt.hash(plain, 10)
const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash)

/** kind: "admin" | "customer". Tokens are scoped so one can never act as the other. */
const signToken = (id, kind) => jwt.sign({ sub: id, kind }, SECRET, { expiresIn: "7d" })

/**
 * Password-reset token. It carries a fingerprint of the current password hash,
 * so the link stops working the moment the password changes (or is reset
 * twice) without needing a table of pending resets.
 */
const fingerprint = (passwordHash) =>
  require("crypto").createHash("sha256").update(passwordHash).digest("hex").slice(0, 16)

const signResetToken = (customer) =>
  jwt.sign({ sub: customer.id, kind: "customer_reset", fp: fingerprint(customer.password_hash) }, SECRET, {
    expiresIn: "1h",
  })

/** Returns the customer id when the token is valid and still current. */
const verifyResetToken = async (token) => {
  try {
    const payload = jwt.verify(String(token || ""), SECRET)
    if (payload.kind !== "customer_reset") return null
    const { rows } = await query("select id, password_hash from customers where id = $1", [payload.sub])
    if (!rows.length || fingerprint(rows[0].password_hash) !== payload.fp) return null
    return rows[0].id
  } catch {
    return null
  }
}

const readToken = (req) => {
  const header = req.headers.authorization || ""
  return header.startsWith("Bearer ") ? header.slice(7) : null
}

const verifyToken = (req, kind) => {
  const token = readToken(req)
  if (!token) return null
  try {
    const payload = jwt.verify(token, SECRET)
    return payload.kind === kind ? payload.sub : null
  } catch {
    return null
  }
}

/** Requires a valid admin token and loads req.admin. */
const adminAuth = async (req, res, next) => {
  const id = verifyToken(req, "admin")
  if (!id) return res.status(401).json({ message: "Unauthorized" })
  const { rows } = await query("select id, email, name from admins where id = $1", [id])
  if (!rows.length) return res.status(401).json({ message: "Unauthorized" })
  req.admin = rows[0]
  next()
}

/** Requires a valid customer token and loads req.customer. */
const customerAuth = async (req, res, next) => {
  const id = verifyToken(req, "customer")
  if (!id) return res.status(401).json({ message: "Unauthorized" })
  const { rows } = await query(
    "select id, email, first_name, last_name, phone, default_address, created_at from customers where id = $1",
    [id]
  )
  if (!rows.length) return res.status(401).json({ message: "Unauthorized" })
  req.customer = rows[0]
  next()
}

/** Loads req.customer when a valid token is present; continues either way. */
const customerOptional = async (req, _res, next) => {
  const id = verifyToken(req, "customer")
  if (id) {
    const { rows } = await query(
      "select id, email, first_name, last_name, phone, default_address, created_at from customers where id = $1",
      [id]
    )
    req.customer = rows[0] || null
  }
  next()
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  signResetToken,
  verifyResetToken,
  adminAuth,
  customerAuth,
  customerOptional,
}
