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

/**
 * Turns a raw inventory record into shop copy in both languages at once — one
 * call instead of two, for items imported from Pro-Data.
 *
 * Inventory names are written for a stockroom ("LAPTOP HP 15S-FQ5 I5 8/512"),
 * so the title is rewritten for people while model numbers stay exact. The
 * Albanian follows the shop's voice: Kosovo usage, warm and plain, "dhe"
 * rather than "e", and no mention of returns — they are handled one to one,
 * never advertised.
 *
 * @param {object} item - { name, name_alt, comment, brand, category, sub_category }
 * @returns {Promise<{ title_en, description_en, title_sq, description_sq, tags }>}
 */
const enhanceBilingual = async (item) => {
  if (!isConfigured()) {
    const error = new Error("AI enhancement is not configured. Set OPENAI_API_KEY in server/.env.")
    error.status = 400
    throw error
  }

  const prompt = [
    "You write product copy for Intersoft, an online electronics store in Kosovo specialising in PCs, components and peripherals.",
    "Below is a raw record from the store's inventory system. Turn it into shop copy in English and in Albanian.",
    "",
    "Rules:",
    "- Be accurate. Never invent specifications, features or compatibility that the record does not state or clearly imply.",
    "  If the record is thin, write a shorter, general description that is still true.",
    "- Titles: readable and concise (max 90 characters). Keep brand names and model numbers exactly as given.",
    "  Expand stockroom abbreviations only when the meaning is certain.",
    "- Descriptions: 2 short paragraphs of plain text, no markdown, no emoji.",
    "- Albanian: standard Albanian as spoken in Kosovo; warm, friendly and natural, never stiff or machine-like.",
    "  Use \"dhe\" for \"and\". Address the customer informally (\"ti\").",
    "- Never mention returns, refunds, exchanges or money-back guarantees, in either language.",
    "- Tags: 5-10 lowercase English search keywords, no # symbols.",
    "",
    "Inventory record:",
    `Name: ${item.name || "(none)"}`,
    `Second name: ${item.name_alt || "(none)"}`,
    `Brand: ${item.brand || "(none)"}`,
    `Classification: ${[item.category, item.sub_category].filter(Boolean).join(" > ") || "(none)"}`,
    `Note: ${item.comment || "(none)"}`,
    "",
    'Return a JSON object with exactly these keys: "title_en", "description_en", "title_sq", "description_sq", "tags".',
  ].join("\n")

  const response = await getClient().chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.5,
  })

  const parsed = JSON.parse(response.choices?.[0]?.message?.content || "{}")
  const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "")
  const result = {
    title_en: text(parsed.title_en, 300),
    description_en: text(parsed.description_en, 20000),
    title_sq: text(parsed.title_sq, 300),
    description_sq: text(parsed.description_sq, 20000),
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean).slice(0, 10)
      : [],
  }
  if (!result.title_en || !result.title_sq) throw new Error("The assistant returned incomplete copy.")
  return result
}

module.exports = { isConfigured, enhanceProduct, enhanceBilingual }
