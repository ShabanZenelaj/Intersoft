const Joi = require("joi")
const { idParam, pagination } = require("../common")
const { ACTIVE_STATUSES } = require("../../lib/order-status")

const orderParams = idParam("order id")

const list = {
  query: Joi.object({
    // The account page's filter tabs. "active" expands to the in-progress set.
    status: Joi.string().valid(...ACTIVE_STATUSES, "delivered", "canceled", "active"),
    ...pagination,
  }),
}

const lookup = {
  body: Joi.object({
    display_id: Joi.number().integer().positive().required().messages({
      "number.base": "Enter your order number.",
      "number.positive": "Enter your order number.",
      "any.required": "Enter your order number.",
    }),
    email: Joi.string().email().required().messages({
      "string.email": "Enter the email used for the order.",
      "string.empty": "Enter the email used for the order.",
      "any.required": "Enter the email used for the order.",
    }),
  }),
}

const get = { params: orderParams }

const claim = { params: orderParams, body: Joi.object({}) }

module.exports = { list, lookup, get, claim }
