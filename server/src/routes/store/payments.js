const express = require("express")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")

const payments = controller(require("../../controllers/store/payments"))
const schema = require("../../validation/store/payments")

const router = express.Router()

/**
 * Called by RaiAccept, not by a browser — so no customer token, and the
 * handler treats the body as untrusted and confirms everything against their
 * API before touching an order.
 */
router.post("/payments/raiaccept/webhook", validate(schema.webhook), payments.webhook)

/** Polled by the landing pages the shopper is redirected back to. */
router.get("/payments/orders/:id/status", validate(schema.status), payments.status)

module.exports = router
