const Joi = require("joi")
const { password } = require("../common")

// Loose on purpose: a bad sign-in must answer "Wrong email or password."
// rather than telling an attacker the address was not even well formed.
const login = {
  body: Joi.object({
    email: Joi.string().max(255).allow(""),
    password: Joi.string().max(200).allow(""),
  }),
}

const me = { query: Joi.object({}) }

const changePassword = { body: Joi.object({ password: password.required() }) }

module.exports = { login, me, changePassword }
