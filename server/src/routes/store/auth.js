const express = require("express")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")
const { storeAuthLimiter } = require("../../lib/rate-limits")

const auth = controller(require("../../controllers/store/auth"))
const schema = require("../../validation/store/auth")

const router = express.Router()

// Credential endpoints share one rate-limit bucket with the guest order
// lookup — see lib/rate-limits.js.
router.post("/auth/register", storeAuthLimiter, validate(schema.register), auth.register)
router.post("/auth/login", storeAuthLimiter, validate(schema.login), auth.login)
router.post("/auth/forgot-password", storeAuthLimiter, validate(schema.forgotPassword), auth.forgotPassword)
router.post("/auth/reset-password", storeAuthLimiter, validate(schema.resetPassword), auth.resetPassword)

module.exports = router
