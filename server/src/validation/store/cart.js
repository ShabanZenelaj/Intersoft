const Joi = require("joi")
const { uuid, idParam, address, locale } = require("../common")

const cartParams = idParam("cart id")
const itemParams = Joi.object({
  id: uuid.required().messages({ "string.guid": "That cart id is not valid." }),
  itemId: uuid.required().messages({ "string.guid": "That cart item is not valid." }),
})

const quantity = Joi.number().integer().min(1).max(999).messages({
  "number.base": "Enter how many you want.",
  "number.min": "Quantity must be at least 1.",
  "number.max": "That is more than we can put in one line.",
})

const create = { body: Joi.object({}) }

const get = { params: cartParams }

const addItem = {
  params: cartParams,
  body: Joi.object({
    variant_id: uuid.required().messages({
      "any.required": "Choose which version you want.",
      "string.guid": "Choose which version you want.",
    }),
    quantity: quantity.default(1),
  }),
}

const updateItem = {
  params: itemParams,
  body: Joi.object({ quantity: quantity.required() }),
}

const removeItem = { params: itemParams }

const applyPromotion = {
  params: cartParams,
  body: Joi.object({
    code: Joi.string().trim().max(30).required().messages({
      "string.empty": "Enter a promo code.",
      "any.required": "Enter a promo code.",
    }),
  }),
}

const removePromotion = { params: cartParams }

const setDetails = {
  params: cartParams,
  body: Joi.object({
    email: require("../common").email.required(),
    address: address.required().messages({ "any.required": "A delivery address is required." }),
    locale,
  }),
}

const setPayment = {
  params: cartParams,
  body: Joi.object({
    // The gateway list lives in services/payments; an unknown one is rejected
    // there with its own message, so only presence is checked here.
    method: Joi.string().max(30).required().messages({
      "string.empty": "Choose how you want to pay.",
      "any.required": "Choose how you want to pay.",
    }),
  }),
}

const complete = { params: cartParams, body: Joi.object({}) }

const attachCustomer = { params: cartParams, body: Joi.object({}) }

module.exports = {
  create,
  get,
  addItem,
  updateItem,
  removeItem,
  applyPromotion,
  removePromotion,
  setDetails,
  setPayment,
  complete,
  attachCustomer,
}
