const express = require("express")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")

const ai = controller(require("../../controllers/admin/ai"))
const schema = require("../../validation/admin/ai")

const router = express.Router()

router.get("/ai/status", validate(schema.status), ai.status)
router.post("/ai/enhance", validate(schema.enhance), ai.enhance)

module.exports = router
