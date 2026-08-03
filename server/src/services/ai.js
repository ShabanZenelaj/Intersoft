const OpenAI = require("openai")

/**
 * Optional AI product-data enhancement (official OpenAI SDK). Reports itself
 * as not configured when OPENAI_API_KEY is missing; the admin UI hides the
 * feature then. Suggestions are never saved automatically — the store manager
 * reviews and applies them.
 */

let client = null

const isConfigured = () => Boolean(process.env.OPENAI_API_KEY)

const getClient = () => {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}

/**
 * @param {object} product - { title, description, category, tags: string[] }
 * @param {string[]} fields - any of "description", "tags", "title"
 * @param {string} language - "en" or "sq"
 */
const enhanceProduct = async (product, fields = ["description", "tags"], language = "en") => {
  if (!isConfigured()) {
    const error = new Error("AI enhancement is not configured. Set OPENAI_API_KEY in server/.env.")
    error.status = 400
    throw error
  }

  const languageName = language === "sq" ? "Albanian" : "English"
  const wanted = []
  if (fields.includes("title")) {
    wanted.push('"title": an improved, concise, SEO-friendly product title (string, max 90 characters)')
  }
  if (fields.includes("description")) {
    wanted.push(
      '"description": a compelling product description of 2-3 short paragraphs focused on concrete specs and benefits (string, plain text, no markdown)'
    )
  }
  if (fields.includes("tags")) {
    wanted.push('"tags": 5-10 lowercase search keywords/tags (array of strings, no # symbols)')
  }

  const prompt = [
    "You are a copywriter for Intersoft, an online electronics store specializing in PCs, components and peripherals.",
    `Write in ${languageName}. Be accurate: never invent specifications that are not implied by the existing data.`,
    "",
    "Current product data:",
    `Title: ${product.title || "(none)"}`,
    `Description: ${product.description || "(none)"}`,
    `Category: ${product.category || "(none)"}`,
    `Existing tags: ${(product.tags || []).join(", ") || "(none)"}`,
    "",
    "Return a JSON object with exactly these keys:",
    ...wanted,
  ].join("\n")

  const response = await getClient().chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  })

  const parsed = JSON.parse(response.choices?.[0]?.message?.content || "{}")
  const result = {}
  if (fields.includes("title") && typeof parsed.title === "string") result.title = parsed.title.trim()
  if (fields.includes("description") && typeof parsed.description === "string") {
    result.description = parsed.description.trim()
  }
  if (fields.includes("tags") && Array.isArray(parsed.tags)) {
    result.tags = parsed.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean)
  }
  return result
}

module.exports = { isConfigured, enhanceProduct }
