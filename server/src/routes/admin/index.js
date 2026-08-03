const express = require("express")
const { adminAuth } = require("../../lib/auth")

/**
 * Admin API, mounted at /api/admin. Same-origin only — the app applies no CORS
 * here, so a browser on another origin cannot call it at all.
 *
 * One file per resource, each declaring full paths (see routes/store/index.js
 * for why). The security boundary lives here and only here: signing in is
 * mounted before `adminAuth`, everything after it requires a valid admin token.
 */
const router = express.Router()

const auth = require("./auth")

router.use(auth.publicRoutes)

// ---------------------------------------------------------------------------
// Everything below this line requires an admin token.
// ---------------------------------------------------------------------------
router.use(adminAuth)

router.use(auth.protectedRoutes)
router.use(require("./dashboard"))
router.use(require("./products"))
router.use(require("./categories"))
router.use(require("./orders"))
router.use(require("./customers"))
router.use(require("./groups"))
router.use(require("./price-lists"))
router.use(require("./campaigns"))
router.use(require("./shipping"))
router.use(require("./suppliers"))
router.use(require("./uploads"))
router.use(require("./import"))
router.use(require("./ai"))

module.exports = router
