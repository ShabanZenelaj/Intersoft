const { query } = require("../../db")
const { hashPassword, verifyPassword, signToken } = require("../../lib/auth")

const login = async (req, res) => {
  const { email, password } = req.body || {}
  const { rows } = await query("select id, password_hash from admins where lower(email) = lower($1)", [
    String(email || ""),
  ])
  const ok = rows.length && (await verifyPassword(String(password || ""), rows[0].password_hash))
  if (!ok) return res.status(401).json({ message: "Wrong email or password." })
  res.json({ token: signToken(rows[0].id, "admin") })
}

const me = async (req, res) => res.json({ admin: req.admin })

const changePassword = async (req, res) => {
  const { password } = req.body
  await query("update admins set password_hash = $1 where id = $2", [await hashPassword(password), req.admin.id])
  res.json({ success: true })
}

module.exports = { login, me, changePassword }
