const express = require("express")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")

const priceLists = controller(require("../../controllers/admin/priceLists"))
const schema = require("../../validation/admin/price-lists")

const router = express.Router()

router.get("/price-lists", validate(schema.list), priceLists.list)
router.get("/price-lists/:id", validate(schema.get), priceLists.get)
router.post("/price-lists", validate(schema.create), priceLists.create)
router.patch("/price-lists/:id", validate(schema.update), priceLists.update)
router.delete("/price-lists/:id", validate(schema.remove), priceLists.remove)

// The prices inside a list: one at a time, or a percentage sweep over a
// category — how a manager builds a B2B list quickly.
router.post("/price-lists/:id/prices", validate(schema.setPrice), priceLists.setPrice)
router.post("/price-lists/:id/bulk", validate(schema.bulkFill), priceLists.bulkFill)
router.delete("/price-lists/:id/prices", validate(schema.removePrice), priceLists.removePrice)

/** Variant search that powers the price-list editor's product picker. */
router.get("/variants", validate(schema.searchVariants), priceLists.searchVariants)

module.exports = router
