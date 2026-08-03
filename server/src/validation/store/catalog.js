const Joi = require("joi")
const { uuid, pagination } = require("../common")

const list = {
  query: Joi.object({
    q: Joi.string().max(200).allow(""),
    handle: Joi.string().max(200),
    category_id: uuid,
    order: Joi.string().max(50),
    ...pagination,
  }),
}

// /categories and /shipping-methods take no input at all.
const listCategories = { query: Joi.object({}) }
const listShippingMethods = { query: Joi.object({}) }

module.exports = { list, listCategories, listShippingMethods }
