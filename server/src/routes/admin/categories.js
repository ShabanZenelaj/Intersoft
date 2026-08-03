const express = require("express")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")

const categories = controller(require("../../controllers/admin/categories"))
const schema = require("../../validation/admin/categories")

const router = express.Router()

router.get("/categories", validate(schema.list), categories.list)
router.post("/categories", validate(schema.create), categories.create)
router.patch("/categories/:id", validate(schema.update), categories.update)
router.delete("/categories/:id", validate(schema.remove), categories.remove)

module.exports = router
