const { query } = require("../../db")
const {
  hashPassword,
  verifyPassword,
  signToken,
  signResetToken,
  verifyResetToken,
} = require("../../lib/auth")
const { isEmail } = require("../../lib/util")
const mail = require("../../services/mail")

const register = async (req, res) => {
  const { email, password, first_name, last_name, phone } = req.body

  const { rows: existing } = await query("select 1 from customers where lower(email) = lower($1)", [email])
  if (existing.length) return res.status(409).json({ message: "Email already in use." })

  const hash = await hashPassword(password)
  const { rows } = await query(
    `insert into customers (email, password_hash, first_name, last_name, phone)
     values (lower($1), $2, $3, $4, $5) returning id, email, first_name`,
    [email, hash, first_name, last_name, phone || null]
  )
  const customer = rows[0]

  // Orders placed as a guest with this email now belong to the new account.
  const { rowCount: claimed } = await query(
    "update orders set customer_id = $1 where customer_id is null and lower(email) = lower($2)",
    [customer.id, email]
  )

  mail.sendWelcome(customer, req.body?.locale === "en" ? "en" : "sq")
  res.status(201).json({ token: signToken(customer.id, "customer"), claimed_orders: claimed })
}

const login = async (req, res) => {
  const { email, password } = req.body
  const { rows } = await query("select id, password_hash from customers where lower(email) = lower($1)", [
    String(email || ""),
  ])
  const ok = rows.length && (await verifyPassword(String(password || ""), rows[0].password_hash))
  if (!ok) return res.status(401).json({ message: "Wrong email or password." })
  res.json({ token: signToken(rows[0].id, "customer") })
}

/**
 * Always answers 200 so the endpoint cannot be used to discover which emails
 * have accounts. The reset link is emailed only when the account exists.
 */
const forgotPassword = async (req, res) => {
  const { email, locale } = req.body
  if (isEmail(email)) {
    const { rows } = await query(
      "select id, email, first_name, password_hash from customers where lower(email) = lower($1)",
      [email]
    )
    if (rows.length) {
      mail.sendPasswordReset(rows[0], signResetToken(rows[0]), locale === "en" ? "en" : "sq")
    }
  }
  res.json({ success: true })
}

const resetPassword = async (req, res) => {
  const { token, password } = req.body
  const customerId = await verifyResetToken(token)
  if (!customerId) {
    return res.status(400).json({ message: "This reset link is invalid or has expired." })
  }
  await query("update customers set password_hash = $1 where id = $2", [await hashPassword(password), customerId])
  res.json({ token: signToken(customerId, "customer") })
}

module.exports = { register, login, forgotPassword, resetPassword }
