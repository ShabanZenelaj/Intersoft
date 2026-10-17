const express = require("express")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")

const inventory = controller(require("../../controllers/admin/inventory"))
const schema = require("../../validation/admin/inventory")

/** The Pro-Data integration: status, the Inbox, Needs linking, and the product and order panels. */
const router = express.Router()

router.get("/inventory/status", validate(schema.status), inventory.status)
router.post("/inventory/test-connection", validate(schema.testConnection), inventory.testConnection)
router.post("/inventory/jobs/:job/run", validate(schema.runJob), inventory.runJob)
router.patch("/inventory/settings", validate(schema.updateSettings), inventory.updateSettings)
router.get("/inventory/warehouses", validate(schema.warehouses), inventory.warehouses)
router.get("/inventory/classifications", validate(schema.classifications), inventory.classifications)
router.put("/inventory/category-map", validate(schema.categoryMap), inventory.categoryMap)

router.get("/inventory/items", validate(schema.listItems), inventory.listItems)
router.get("/inventory/items/:id", validate(schema.getItem), inventory.getItem)
router.post("/inventory/items/import", validate(schema.importItems), inventory.importItems)
router.post("/inventory/items/ignore", validate(schema.ignoreItems), inventory.ignoreItems)

router.get("/inventory/links", validate(schema.listLinks), inventory.listLinks)
router.post("/inventory/links/:id", validate(schema.resolveLink), inventory.resolveLink)

router.get("/inventory/products/:id", validate(schema.getProduct), inventory.getProduct)
router.put("/inventory/variants/:id/link", validate(schema.linkVariant), inventory.linkVariant)
router.patch("/inventory/variants/:id", validate(schema.updateVariant), inventory.updateVariant)

router.get("/inventory/orders/:id", validate(schema.getOrder), inventory.getOrder)
router.post("/inventory/orders/:id/send", validate(schema.sendOrder), inventory.sendOrder)
router.post("/inventory/orders/:id/resolve", validate(schema.resolveOrder), inventory.resolveOrder)

module.exports = router
