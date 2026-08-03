const { query } = require("../../db")
const { check } = require("../../lib/util")
const ai = require("../../services/ai")

const status = async (_req, res) => res.json({ configured: ai.isConfigured() })

const enhance = async (req, res) => {
  const { product_id, fields = ["description", "tags"], language = "en" } = req.body || {}
  const { rows } = await query(
    `select p.title, p.description, p.tags, c.name as category
       from products p left join categories c on c.id = p.category_id where p.id = $1`,
    [product_id]
  )
  check(rows.length, "Product not found.")
  const suggestions = await ai.enhanceProduct(rows[0], fields, language === "sq" ? "sq" : "en")
  res.json({ suggestions })
}

module.exports = { status, enhance }
