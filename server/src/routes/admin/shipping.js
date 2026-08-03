const express = require("express")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")

const shipping = controller(require("../../controllers/admin/shipping"))
const schema = require("../../validation/admin/shipping")

const router = express.Router()

router.get("/shipping-methods", validate(schema.list), shipping.list)
router.post("/shipping-methods", validate(schema.create), shipping.create)
router.patch("/shipping-methods/:id", validate(schema.update), shipping.update)
router.delete("/shipping-methods/:id", validate(schema.remove), shipping.remove)

module.exports = router
