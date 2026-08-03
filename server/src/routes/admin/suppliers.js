const express = require("express")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")

const suppliers = controller(require("../../controllers/admin/suppliers"))
const schema = require("../../validation/admin/suppliers")

const router = express.Router()

router.get("/suppliers", validate(schema.list), suppliers.list)
router.post("/suppliers", validate(schema.create), suppliers.create)
router.patch("/suppliers/:id", validate(schema.update), suppliers.update)
router.delete("/suppliers/:id", validate(schema.remove), suppliers.remove)

module.exports = router
