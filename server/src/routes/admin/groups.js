const express = require("express")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")

const groups = controller(require("../../controllers/admin/groups"))
const schema = require("../../validation/admin/groups")

const router = express.Router()

router.get("/customer-groups", validate(schema.list), groups.list)
router.post("/customer-groups", validate(schema.create), groups.create)
router.patch("/customer-groups/:id", validate(schema.update), groups.update)
router.delete("/customer-groups/:id", validate(schema.remove), groups.remove)

module.exports = router
