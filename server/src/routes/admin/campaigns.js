const express = require("express")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")

const campaigns = controller(require("../../controllers/admin/campaigns"))
const schema = require("../../validation/admin/campaigns")

const router = express.Router()

router.get("/campaigns", validate(schema.list), campaigns.list)
router.post("/campaigns", validate(schema.create), campaigns.create)
router.patch("/campaigns/:id", validate(schema.update), campaigns.update)
router.delete("/campaigns/:id", validate(schema.remove), campaigns.remove)

module.exports = router
