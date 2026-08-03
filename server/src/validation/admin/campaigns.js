const Joi = require("joi")
const { uuid, idParam, amount, flag, text, date } = require("../common")

const campaignParams = idParam("campaign id")

/**
 * Campaign rules, including the ones that depend on other fields: a coupon
 * needs a code unless it applies automatically, a category or product
 * campaign needs something in scope, and a home-page banner needs an image.
 */
const body = Joi.object({
  name: text(200),
  code: Joi.string()
    .trim()
    .uppercase()
    .max(30)
    .allow("", null)
    .when("is_automatic", {
      // `.required()` matters: without it an absent is_automatic would also
      // satisfy the condition and skip the code check entirely.
      is: Joi.valid(true, "true").required(),
      // Automatic campaigns need no code; a blank one is stored as null.
      then: Joi.optional(),
      otherwise: Joi.string()
        .trim()
        .uppercase()
        .pattern(/^[A-Z0-9_-]{2,30}$/)
        .required()
        .messages({
          "string.pattern.base": "Code must be 2-30 letters/numbers.",
          "string.empty": "Code must be 2-30 letters/numbers.",
          "any.required": "Code must be 2-30 letters/numbers.",
        }),
    }),
  handle: Joi.string().max(300).allow("", null),
  // Defaults mirror the controller's, and applying them here means the rules
  // below see the same value the database will (an absent type is a
  // percentage, so it still gets capped at 100).
  type: Joi.string().valid("percentage", "fixed", "free_shipping").default("percentage"),
  value: Joi.number()
    .positive()
    .required()
    .messages({ "number.base": "Value must be positive.", "number.positive": "Value must be positive." })
    .when("type", {
      is: "percentage",
      then: Joi.number().max(100).messages({ "number.max": "Percentage cannot exceed 100." }),
    }),
  applies_to: Joi.string().valid("order", "category", "product", "shipping").default("order"),
  category_ids: Joi.array()
    .items(uuid)
    .when("applies_to", {
      is: "category",
      then: Joi.array().min(1).required().messages({
        "array.min": "Choose at least one category.",
        "any.required": "Choose at least one category.",
      }),
    }),
  product_ids: Joi.array()
    .items(uuid)
    .when("applies_to", {
      is: "product",
      then: Joi.array().min(1).required().messages({
        "array.min": "Choose at least one product.",
        "any.required": "Choose at least one product.",
      }),
    }),
  customer_group_id: uuid.allow(null, ""),
  min_subtotal: amount.allow(null, ""),
  min_quantity: Joi.number().integer().min(0).allow(null, ""),
  is_active: flag,
  is_automatic: flag,
  starts_at: date,
  ends_at: date,
  usage_limit: Joi.number().integer().min(1).allow(null, ""),
  usage_limit_per_customer: Joi.number().integer().min(1).allow(null, ""),
  // Required only when the campaign is meant to appear on the home page.
  // `is` must be `.required()` — otherwise an absent show_on_home would also
  // satisfy the condition and demand a banner from every campaign.
  banner_image: Joi.string()
    .max(2000)
    .allow(null, "")
    .when("show_on_home", {
      is: Joi.valid(true, "true").required(),
      then: Joi.string().max(2000).required().messages({
        "any.required": "A campaign shown on the home page needs a banner image.",
        "string.empty": "A campaign shown on the home page needs a banner image.",
        "string.base": "A campaign shown on the home page needs a banner image.",
      }),
    }),
  banner_title: text(120),
  banner_title_sq: text(120),
  banner_subtitle: text(200),
  banner_subtitle_sq: text(200),
  show_on_home: flag,
})

const list = { query: Joi.object({}) }
const create = { body }
const update = { params: campaignParams, body }
const remove = { params: campaignParams }

module.exports = { list, create, update, remove }
