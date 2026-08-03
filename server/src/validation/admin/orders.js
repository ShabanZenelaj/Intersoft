const Joi = require("joi")
const { idParam, pagination, amount, flag, text } = require("../common")
const { ALL_STATUSES } = require("../../lib/order-status")

const orderParams = idParam("order id")

/** Every action can suppress the customer email by sending notify: false. */
const notify = flag

const list = {
  query: Joi.object({
    q: Joi.string().max(200).allow(""),
    status: Joi.string().valid(...ALL_STATUSES).allow(""),
    ...pagination,
  }),
}

const get = { params: orderParams }

const setStatus = {
  params: orderParams,
  body: Joi.object({
    status: Joi.string()
      .valid(...ALL_STATUSES)
      .required()
      .messages({ "any.only": "Invalid status.", "any.required": "Invalid status." }),
    notify,
  }),
}

const capturePayment = { params: orderParams, body: Joi.object({ notify }) }

const refund = {
  params: orderParams,
  body: Joi.object({
    // The upper bound depends on what is left to refund, so the controller
    // checks it against the order.
    amount: amount.greater(0).required().messages({
      "number.base": "Enter an amount to refund.",
      "number.greater": "Invalid refund amount.",
      "any.required": "Enter an amount to refund.",
    }),
    reason: text(500),
    restock: flag,
    notify,
  }),
}

const addNote = {
  params: orderParams,
  body: Joi.object({
    note: Joi.string().trim().max(1000).required().messages({
      "string.empty": "Note is empty.",
      "any.required": "Note is empty.",
    }),
  }),
}

module.exports = { list, get, setStatus, capturePayment, refund, addNote }
