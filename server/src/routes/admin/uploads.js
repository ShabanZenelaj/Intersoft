const express = require("express")
const multer = require("multer")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")
const { MAX_BYTES } = require("../../services/uploads")

const uploads = controller(require("../../controllers/admin/uploads"))
const schema = require("../../validation/admin/uploads")

const router = express.Router()

// Held in memory only: the controller sniffs the magic bytes before anything
// is written to disk, so an image is never trusted by extension alone.
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 10 } })

router.post("/uploads", imageUpload.array("files", 10), validate(schema.create), uploads.create)
router.delete("/uploads", validate(schema.remove), uploads.remove)

module.exports = router
