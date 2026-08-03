const Joi = require("joi")
const { flag, pagination } = require("../common")

const list = {
  query: Joi.object({
    // ?banners=true limits the list to campaigns shown on the home page.
    banners: flag,
  }),
}

const get = {
  params: Joi.object({
    handle: Joi.string()
      .max(200)
      .required()
      .messages({ "any.required": "Which campaign?", "string.empty": "Which campaign?" }),
  }),
  query: Joi.object({
    order: Joi.string().max(50),
    ...pagination,
  }),
}

module.exports = { list, get }
