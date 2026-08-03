const express = require("express")
const { customerAuth } = require("../../lib/auth")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")

const customers = controller(require("../../controllers/store/customers"))
const schema = require("../../validation/store/customers")

const router = express.Router()

// The account area: every route here needs a real customer token.
router.get("/customers/me", customerAuth, validate(schema.me), customers.me)
router.patch("/customers/me", customerAuth, validate(schema.update), customers.update)
router.post("/customers/me/password", customerAuth, validate(schema.changePassword), customers.changePassword)
router.get("/customers/me/summary", customerAuth, validate(schema.summary), customers.summary)

module.exports = router
