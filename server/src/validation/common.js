const Joi = require("joi")

/**
 * Building blocks shared by the store and admin schemas.
 *
 * Messages are written the way the admin panel and storefront show them —
 * whole sentences a shopper or a store manager can act on, not type errors.
 */

const uuid = Joi.string().uuid()

/** `:id` style path parameters. */
const idParam = (label = "id") =>
  Joi.object({
    id: uuid.required().messages({
      "string.guid": `That ${label} is not valid.`,
      "any.required": `A ${label} is required.`,
    }),
  })

/** Paging, as read by lib/util.js `pageParams`. */
const pagination = {
  limit: Joi.number().integer().min(1),
  offset: Joi.number().integer().min(0),
}

/**
 * A money amount. HTML number inputs hand over strings, and empty inputs hand
 * over "", so the schemas accept both and the controllers round with money().
 */
const amount = Joi.number().min(0)

/** A checkbox or a "true"/"false" string from a form. */
const flag = Joi.boolean()

/** Optional free text that a form submits as "" when left blank. */
const text = (max) => Joi.string().max(max).allow("", null)

/** A date input that submits "" or null when left blank. */
const date = Joi.date().iso().allow("", null)

const email = Joi.string().email().messages({
  "string.email": "Enter a valid email address.",
  "string.empty": "Email is required.",
  "any.required": "Email is required.",
})

const password = Joi.string().min(8).messages({
  "string.min": "Password must be at least 8 characters.",
  "string.empty": "Password is required.",
  "any.required": "Password is required.",
})

/** A postal address, as collected at checkout and in the account area. */
const address = Joi.object({
  first_name: Joi.string().max(100).required().messages({
    "string.empty": "First name is required.",
    "any.required": "First name is required.",
  }),
  last_name: Joi.string().max(100).required().messages({
    "string.empty": "Last name is required.",
    "any.required": "Last name is required.",
  }),
  address_1: Joi.string().max(200).required().messages({
    "string.empty": "Street address is required.",
    "any.required": "Street address is required.",
  }),
  city: Joi.string().max(100).required().messages({
    "string.empty": "City is required.",
    "any.required": "City is required.",
  }),
  postal_code: text(20),
  country_code: Joi.string().max(2).allow("", null),
  phone: text(30),
})

const locale = Joi.string().valid("en", "sq")

module.exports = { uuid, idParam, pagination, amount, flag, text, date, email, password, address, locale }
