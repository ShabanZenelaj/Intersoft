require("dotenv").config()
const path = require("path")
const express = require("express")
const helmet = require("helmet")
const cors = require("cors")

const storeRoutes = require("./routes/store")
const adminRoutes = require("./routes/admin")
const { logError } = require("./lib/error-log")

const app = express()
app.disable("x-powered-by")
app.set("trust proxy", 1)

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // The admin panel shows product images from arbitrary hosts
        // (the local /static URLs use 127.0.0.1, uploads may use a CDN).
        "img-src": ["'self'", "data:", "http:", "https:"],
      },
    },
  })
)
app.use(express.json({ limit: "1mb" }))

// The storefront (separate origin) talks to the store API only. The admin
// API is same-origin (the admin panel is served by this server), so it gets
// no CORS at all — browsers on other origins cannot call it.
app.use("/api/store", cors({ origin: (process.env.STORE_ORIGIN || "http://localhost:3000").split(",") }))

app.get("/health", (_req, res) => res.send("OK"))

// Product/category images are public assets: they must render from the
// storefront and from the admin regardless of which host name is used
// (localhost vs 127.0.0.1), so opt them out of helmet's same-origin default.
app.use(
  "/static",
  (_req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin")
    next()
  },
  express.static(path.join(__dirname, "..", "static"), { maxAge: "1d" })
)

app.use("/api/store", storeRoutes)
app.use("/api/admin", adminRoutes)

// Admin panel SPA
const adminDir = path.join(__dirname, "..", "admin")
app.use("/admin", express.static(adminDir))
app.get("/admin/*path", (_req, res) => res.sendFile(path.join(adminDir, "index.html")))
app.get("/", (_req, res) => res.redirect("/admin"))

app.use((req, res) => res.status(404).json({ message: `Not found: ${req.method} ${req.path}` }))

// Central error handler: validation errors carry .status, everything else is a 500.
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, _next) => {
  const status = error.status || 500

  // 4xx are the API working as intended (bad input, wrong password, not
  // found) and would drown the log. Only real failures are recorded.
  if (status >= 500) {
    console.error(error)
    // Not awaited: the caller should not wait on the log to get its response.
    logError({ kind: "server_error", error, req, status })
  }

  res.status(status).json({ message: status >= 500 ? "Internal server error" : error.message })
})

const port = Number(process.env.PORT) || 9000
const server = app.listen(port, () => console.log(`Intersoft server on http://localhost:${port} (admin at /admin)`))

/**
 * Process-level failures.
 *
 * After either of these the process is in an undefined state — a half-finished
 * transaction, a listener that will never fire — so it records what happened
 * and exits rather than staying up and serving broken responses. Whatever runs
 * the server (systemd, pm2, Docker, `node --watch`) is expected to restart it.
 */
const crash = (kind) => (error) => {
  console.error(`[${kind}]`, error)

  // Give the log write a moment to land, but never hang on it: if the database
  // is what died, waiting forever would leave a zombie process behind.
  const flushed = logError({ kind, error })
  const deadline = new Promise((resolve) => setTimeout(resolve, 2000).unref())

  Promise.race([flushed, deadline]).finally(() => {
    server.close(() => process.exit(1))
    // A hung connection must not keep a broken process alive either.
    setTimeout(() => process.exit(1), 1000).unref()
  })
}

process.on("uncaughtException", crash("uncaught_exception"))
process.on("unhandledRejection", crash("unhandled_rejection"))
