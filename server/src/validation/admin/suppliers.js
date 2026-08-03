const Joi = require("joi")
const { uuid, idParam, flag, text } = require("../common")

const supplierParams = idParam("supplier id")

const base = {
  name: Joi.string().trim().max(200).required().messages({
    "string.empty": "Name is required.",
    "any.required": "Name is required.",
  }),
  email: Joi.string().email().max(255).allow("", null).messages({
    "string.email": "Enter a valid email address.",
  }),
  phone: text(50),
  notes: text(5000),
  shipping_method_id: uuid.allow(null, ""),
}

const list = { query: Joi.object({}) }
const create = { body: Joi.object(base) }
const update = {
  params: supplierParams,
  // Optionally pushes the new shipping option onto all of this supplier's
  // products, which is how a whole catalog is re-pointed to a new courier.
  body: Joi.object({ ...base, apply_to_products: flag }),
}
const remove = { params: supplierParams }

module.exports = { list, create, update, remove }
