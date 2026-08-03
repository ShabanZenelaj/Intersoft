const express = require("express")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")

const products = controller(require("../../controllers/admin/products"))
const schema = require("../../validation/admin/products")

const router = express.Router()

router.get("/products", validate(schema.list), products.list)
router.get("/products/:id", validate(schema.get), products.get)
router.post("/products", validate(schema.create), products.create)
router.patch("/products/:id", validate(schema.update), products.update)
router.delete("/products/:id", validate(schema.remove), products.remove)

module.exports = router
