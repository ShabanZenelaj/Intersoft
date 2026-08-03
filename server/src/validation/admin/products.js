const Joi = require("joi")
const { uuid, idParam, pagination, amount, flag, text } = require("../common")

const productParams = idParam("product id")

/**
 * One purchasable version of a product. The editor always sends the full set
 * back, including ids for rows that already exist, so the controller can tell
 * updates from inserts and delete what is missing.
 */
const variant = Joi.object({
  id: uuid.allow(null, ""),
  title: Joi.string().max(200).allow("", null),
  sku: Joi.string().max(100).allow("", null),
  // Free-form: the option names are whatever the manager typed ("Memory").
  options: Joi.object().unknown(true),
  price: amount.required().messages({
    "number.base": "Every version needs a price.",
    "any.required": "Every version needs a price.",
    "number.min": "A price cannot be negative.",
  }),
  // Empty means "no sale price"; the controller clears it from the sale list.
  sale_price: amount.allow(null, ""),
  stock: Joi.number().integer().min(0).allow(null, ""),
  manage_stock: flag,
})

const body = Joi.object({
  title: Joi.string().trim().max(300).required().messages({
    "string.empty": "Give the product a name.",
    "any.required": "Give the product a name.",
  }),
  // Only supplied when the manager deliberately changes the web address;
  // otherwise the controller keeps the existing one so links keep working.
  handle: Joi.string().max(300).allow("", null),
  description: text(20000),
  brand: text(200),
  status: Joi.string().valid("published", "draft"),
  category_id: uuid.allow(null, ""),
  supplier_id: uuid.allow(null, ""),
  shipping_method_id: uuid.allow(null, ""),
  tags: Joi.array().items(Joi.string().max(100)),
  images: Joi.array().items(Joi.string().max(2000)),
  thumbnail: Joi.string().max(2000).allow(null, ""),
  // Option definitions built by the editor: [{ title, values: [...] }].
  options: Joi.array().items(Joi.object().unknown(true)),
  weight: Joi.number().integer().min(0).allow(null, ""),
  // Holds the Albanian title/description and the "featured" flag; the shape
  // is open on purpose so new keys do not need a schema change.
  metadata: Joi.object().unknown(true),
  variants: Joi.array().items(variant).min(1).required().messages({
    "array.min": "A product needs at least one version.",
    "any.required": "A product needs at least one version.",
  }),
})

const list = {
  query: Joi.object({
    q: Joi.string().max(200).allow(""),
    status: Joi.string().valid("published", "draft").allow(""),
    category_id: uuid,
    order: Joi.string().max(50),
    ...pagination,
  }),
}

const get = { params: productParams }
const create = { body }
const update = { params: productParams, body }
const remove = { params: productParams }

module.exports = { list, get, create, update, remove }
