const { query } = require("../../db")
const { hashPassword } = require("../../lib/auth")
const { money } = require("../../lib/util")
const { ACTIVE_STATUSES } = require("../../lib/order-status")

const me = async (req, res) => {
  // Group membership drives pricing behind the scenes; it is never returned
  // to the shopper, who should only ever see the resulting price.
  res.json({ customer: req.customer })
}

const update = async (req, res) => {
  const { first_name, last_name, phone, default_address } = req.body

  let address = null
  if (default_address && typeof default_address === "object") {
    address = {
      first_name: String(default_address.first_name || "").slice(0, 100),
      last_name: String(default_address.last_name || "").slice(0, 100),
      address_1: String(default_address.address_1 || "").slice(0, 200),
      city: String(default_address.city || "").slice(0, 100),
      postal_code: String(default_address.postal_code || "").slice(0, 20),
      country_code: String(default_address.country_code || "al").slice(0, 2).toLowerCase(),
      phone: String(default_address.phone || "").slice(0, 30),
    }
  }

  const { rows } = await query(
    `update customers set first_name = $1, last_name = $2, phone = $3,
            default_address = coalesce($4, default_address)
     where id = $5
     returning id, email, first_name, last_name, phone, default_address, created_at`,
    [
      String(first_name).slice(0, 100),
      String(last_name).slice(0, 100),
      phone || null,
      address ? JSON.stringify(address) : null,
      req.customer.id,
    ]
  )
  res.json({ customer: rows[0] })
}

const changePassword = async (req, res) => {
  const { password } = req.body
  await query("update customers set password_hash = $1 where id = $2", [await hashPassword(password), req.customer.id])
  res.json({ success: true })
}

/** Totals for the account overview — computed over every order, not one page. */
const summary = async (req, res) => {
  const { rows } = await query(
    `select count(*)::int as orders_count,
            count(*) filter (where status = any($2))::int as active_count,
            coalesce(sum(total) filter (where status <> 'canceled'), 0) as total_spent
       from orders where customer_id = $1`,
    [req.customer.id, ACTIVE_STATUSES]
  )
  res.json({
    orders_count: rows[0].orders_count,
    active_count: rows[0].active_count,
    total_spent: money(rows[0].total_spent),
  })
}

module.exports = { me, update, changePassword, summary }
