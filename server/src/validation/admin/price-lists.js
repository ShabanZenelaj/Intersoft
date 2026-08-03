const Joi = require("joi")
const { uuid, idParam, amount, flag, text, date } = require("../common")

const listParams = idParam("price list id")

const body = Joi.object({
  name: Joi.string().trim().max(200).required().messages({
    "string.empty": "Name is required.",
    "any.required": "Name is required.",
  }),
  description: text(2000),
  // "sale" shows as a discount; "override" is a negotiated price with no
  // strike-through invented on top of it.
  type: Joi.string().valid("sale", "override"),
  customer_group_id: uuid.allow(null, ""),
  customer_id: uuid.allow(null, ""),
  priority: Joi.number().integer().allow(null, ""),
  is_active: flag,
  starts_at: date,
  ends_at: date,
})
  // A list targets everyone, one group, or one customer — never two at once.
  .oxor("customer_group_id", "customer_id")
  .messages({ "object.oxor": "Target either a group or a single customer, not both." })

const quantity = Joi.number().integer().min(1)

const list = { query: Joi.object({}) }
const get = { params: listParams }
const create = { body }
const update = { params: listParams, body }
const remove = { params: listParams }

const setPrice = {
  params: listParams,
  body: Joi.object({
    variant_id: uuid.required().messages({
      "any.required": "Choose a product variant.",
      "string.guid": "Choose a product variant.",
    }),
    price: amount.required().messages({
      "number.base": "Invalid price.",
      "number.min": "Invalid price.",
      "any.required": "Invalid price.",
    }),
    min_quantity: quantity,
  }),
}

const bulkFill = {
  params: listParams,
  body: Joi.object({
    percent_off: Joi.number().greater(0).less(100).required().messages({
      "number.base": "Discount must be between 0 and 100.",
      "number.greater": "Discount must be between 0 and 100.",
      "number.less": "Discount must be between 0 and 100.",
      "any.required": "Discount must be between 0 and 100.",
    }),
    min_quantity: quantity,
    category_id: uuid.allow(null, ""),
  }),
}

const removePrice = {
  params: listParams,
  body: Joi.object({
    variant_id: uuid.required().messages({ "any.required": "variant_id is required." }),
    min_quantity: quantity,
  }),
}

const searchVariants = { query: Joi.object({ q: Joi.string().max(200).allow("") }) }

module.exports = { list, get, create, update, remove, setPrice, bulkFill, removePrice, searchVariants }
