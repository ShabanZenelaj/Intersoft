const express = require("express")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")
const { adminLoginLimiter } = require("../../lib/rate-limits")

const auth = controller(require("../../controllers/admin/auth"))
const schema = require("../../validation/admin/auth")

/**
 * Signing in is the only admin endpoint reachable without a token, so it is
 * exported separately and mounted *before* the adminAuth gate in index.js.
 */
const publicRoutes = express.Router()
publicRoutes.post("/auth/login", adminLoginLimiter, validate(schema.login), auth.login)

const protectedRoutes = express.Router()
protectedRoutes.get("/auth/me", validate(schema.me), auth.me)
protectedRoutes.post("/auth/password", validate(schema.changePassword), auth.changePassword)

module.exports = { publicRoutes, protectedRoutes }
