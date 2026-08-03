const express = require("express")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")

const customers = controller(require("../../controllers/admin/customers"))
const schema = require("../../validation/admin/customers")

const router = express.Router()

router.get("/customers", validate(schema.list), customers.list)
router.get("/customers/:id", validate(schema.get), customers.get)

/** Group membership is assigned by the store manager, never self-served. */
router.put("/customers/:id/groups", validate(schema.setGroups), customers.setGroups)

module.exports = router
