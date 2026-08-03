const express = require("express")
const { customerOptional } = require("../../lib/auth")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")

const catalog = controller(require("../../controllers/store/catalog"))
const schema = require("../../validation/store/catalog")

const router = express.Router()

// `customerOptional` reads the token when present but never rejects: the
// catalog works for guests and simply personalises prices when signed in.
router.get("/products", customerOptional, validate(schema.list), catalog.list)
router.get("/categories", validate(schema.listCategories), catalog.listCategories)
router.get("/shipping-methods", validate(schema.listShippingMethods), catalog.listShippingMethods)

module.exports = router
