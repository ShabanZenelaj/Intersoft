const Joi = require("joi")
const { idParam, amount, flag, text } = require("../common")

const methodParams = idParam("shipping option id")

const body = Joi.object({
  name: Joi.string().trim().max(200).required().messages({
    "string.empty": "Name is required.",
    "any.required": "Name is required.",
  }),
  name_sq: text(200),
  description: text(2000),
  description_sq: text(2000),
  price: amount.required().messages({
    "number.base": "Invalid price.",
    "number.min": "Invalid price.",
    "any.required": "Invalid price.",
  }),
  is_active: flag,
})

const list = { query: Joi.object({}) }
const create = { body }
const update = { params: methodParams, body }
const remove = { params: methodParams }

module.exports = { list, create, update, remove }
