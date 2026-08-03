const Joi = require("joi")
const { idParam, text } = require("../common")

const groupParams = idParam("group id")

const name = Joi.string().trim().max(200).required().messages({
  "string.empty": "Name is required.",
  "any.required": "Name is required.",
})

const list = { query: Joi.object({}) }
const create = { body: Joi.object({ name, handle: Joi.string().max(300).allow("", null), description: text(2000) }) }
const update = { params: groupParams, body: Joi.object({ name, description: text(2000) }) }
const remove = { params: groupParams }

module.exports = { list, create, update, remove }
