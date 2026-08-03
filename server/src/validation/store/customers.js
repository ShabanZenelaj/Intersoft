const Joi = require("joi")
const { password, text, address } = require("../common")

const me = { query: Joi.object({}) }

const update = {
  body: Joi.object({
    first_name: Joi.string().trim().max(100).required().messages({
      "string.empty": "First name is required.",
      "any.required": "First name is required.",
    }),
    last_name: Joi.string().trim().max(100).required().messages({
      "string.empty": "Last name is required.",
      "any.required": "Last name is required.",
    }),
    phone: text(30),
    // Optional: the account page submits the address fields empty until the
    // shopper fills them in, and the controller only saves a complete one.
    default_address: address.fork(
      ["first_name", "last_name", "address_1", "city"],
      (field) => field.optional().allow("")
    ),
  }),
}

const changePassword = { body: Joi.object({ password: password.required() }) }

const summary = { query: Joi.object({}) }

module.exports = { me, update, changePassword, summary }
