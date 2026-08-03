const express = require("express")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")

const orders = controller(require("../../controllers/admin/orders"))
const schema = require("../../validation/admin/orders")

const router = express.Router()

router.get("/orders", validate(schema.list), orders.list)
router.get("/orders/:id", validate(schema.get), orders.get)

// Actions on an order. Each records an event and, unless the request passes
// `notify: false`, emails the customer.
router.post("/orders/:id/status", validate(schema.setStatus), orders.setStatus)
router.post("/orders/:id/capture", validate(schema.capturePayment), orders.capturePayment)
router.post("/orders/:id/refund", validate(schema.refund), orders.refund)
router.post("/orders/:id/notes", validate(schema.addNote), orders.addNote)

module.exports = router
