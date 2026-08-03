const express = require("express")
const { customerOptional } = require("../../lib/auth")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")

const campaigns = controller(require("../../controllers/store/campaigns"))
const schema = require("../../validation/store/campaigns")

const router = express.Router()

// Group-limited campaigns stay hidden from everyone else, so the shopper's
// token (when present) decides what comes back.
router.get("/campaigns", customerOptional, validate(schema.list), campaigns.list)
router.get("/campaigns/:handle", customerOptional, validate(schema.get), campaigns.get)

module.exports = router
