const express = require("express")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")

const dashboard = controller(require("../../controllers/admin/dashboard"))
const schema = require("../../validation/admin/dashboard")

const router = express.Router()

router.get("/stats", validate(schema.stats), dashboard.stats)

module.exports = router
