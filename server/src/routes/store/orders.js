const express = require("express")
const { customerAuth } = require("../../lib/auth")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")
const { storeAuthLimiter } = require("../../lib/rate-limits")

const orders = controller(require("../../controllers/store/orders"))
const schema = require("../../validation/store/orders")

const router = express.Router()

router.get("/orders", customerAuth, validate(schema.list), orders.list)

// Must stay above "/orders/:id" so "lookup" is not read as an order id.
router.post("/orders/lookup", storeAuthLimiter, validate(schema.lookup), orders.lookup)

// Open to guests on purpose: order ids are unguessable uuids, which is how the
// confirmation page works before an account exists.
router.get("/orders/:id", validate(schema.get), orders.get)
router.post("/orders/:id/claim", customerAuth, validate(schema.claim), orders.claim)

module.exports = router
