const Joi = require("joi")
const { uuid, locale } = require("../common")

const status = { query: Joi.object({}) }

const enhance = {
  body: Joi.object({
    product_id: uuid.required().messages({
      "any.required": "product_id is required.",
      "string.guid": "product_id is required.",
    }),
    fields: Joi.array().items(Joi.string().valid("description", "tags", "title")),
    language: locale,
  }),
}

module.exports = { status, enhance }
