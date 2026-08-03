const Joi = require("joi")
const { email, password, text, locale } = require("../common")

const name = (label) =>
  Joi.string()
    .trim()
    .max(100)
    .required()
    .messages({ "string.empty": `${label} is required.`, "any.required": `${label} is required.` })

const register = {
  body: Joi.object({
    email: email.required(),
    password: password.required(),
    first_name: name("First name"),
    last_name: name("Last name"),
    phone: text(30),
    locale,
  }),
}

// Deliberately loose: a wrong email or password must answer with the same
// "Wrong email or password." as a well-formed guess, never a format hint.
const login = {
  body: Joi.object({
    email: Joi.string().max(255).allow(""),
    password: Joi.string().max(200).allow(""),
  }),
}

// Also loose, and for the same reason: the endpoint always answers 200 so it
// cannot be used to discover which addresses have accounts.
const forgotPassword = {
  body: Joi.object({
    email: Joi.string().max(255).allow(""),
    locale,
  }),
}

const resetPassword = {
  body: Joi.object({
    token: Joi.string().max(2000).required().messages({
      "string.empty": "This reset link is invalid or has expired.",
      "any.required": "This reset link is invalid or has expired.",
    }),
    password: password.required(),
  }),
}

module.exports = { register, login, forgotPassword, resetPassword }
