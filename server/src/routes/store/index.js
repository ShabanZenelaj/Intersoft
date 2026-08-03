const express = require("express")

/**
 * Public store API, mounted at /api/store.
 *
 * One file per resource. Each sub-router declares full paths rather than being
 * mounted under a prefix, so a path in the code is the path in the URL and
 * stays greppable. Order matters where a literal segment could be read as a
 * parameter, which is why each file keeps its own routes in the right order.
 */
const router = express.Router()

router.use(require("./catalog"))
router.use(require("./campaigns"))
router.use(require("./cart"))
router.use(require("./auth"))
router.use(require("./customers"))
router.use(require("./orders"))
router.use(require("./payments"))

module.exports = router
