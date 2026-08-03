const Joi = require("joi")
const { uuid, idParam, flag, text } = require("../common")

const categoryParams = idParam("category id")

const body = Joi.object({
  name: Joi.string().trim().max(200).required().messages({
    "string.empty": "Name is required.",
    "any.required": "Name is required.",
  }),
  // Albanian name/description are stored in metadata by the controller.
  name_sq: text(200),
  handle: Joi.string().max(300).allow("", null),
  description: text(5000),
  description_sq: text(5000),
  parent_id: uuid.allow(null, ""),
  image_url: Joi.string().max(2000).allow(null, ""),
  is_active: flag,
  sort_order: Joi.number().integer().allow(null, ""),
})

const list = { query: Joi.object({}) }
const create = { body }
const update = { params: categoryParams, body }
const remove = { params: categoryParams }

module.exports = { list, create, update, remove }
