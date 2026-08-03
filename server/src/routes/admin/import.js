const express = require("express")
const multer = require("multer")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")

const importer = controller(require("../../controllers/admin/import"))
const schema = require("../../validation/admin/import")

const router = express.Router()

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

router.post("/import/products", upload.single("file"), validate(schema.importProducts), importer.importProducts)
router.get("/import/template", validate(schema.downloadTemplate), importer.downloadTemplate)

module.exports = router
