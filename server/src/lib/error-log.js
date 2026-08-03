const { query } = require("../db")

/**
 * Records server-side failures in the error_logs table.
 *
 * Two rules this module lives by:
 *
 * 1. It never throws. Logging runs at the exact moment something is already
 *    broken — quite possibly the database itself — so a failure to log falls
 *    back to the console and is otherwise swallowed. It must never replace the
 *    original error with a logging error.
 *
 * 2. It never stores secrets. Request bodies are redacted by key before they
 *    go anywhere near the table, so a 500 during sign-in cannot turn the log
 *    into a list of passwords.
 */

/** Keys whose values are never stored, at any depth. */
const SECRET_KEYS = [
  "password",
  "confirm_password",
  "new_password",
  "current_password",
  "password_hash",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "secret",
  "api_key",
  "apikey",
  "payment_data",
  "card",
  "card_number",
  "cvv",
  "cvc",
  "pan",
]

const REDACTED = "[redacted]"

/** Guard rails so one enormous payload cannot bloat the table. */
const MAX_STACK = 8000
const MAX_MESSAGE = 2000
const MAX_JSON = 10000
const MAX_DEPTH = 6

const isSecret = (key) => SECRET_KEYS.includes(String(key).toLowerCase())

/**
 * Deep-copies a value, replacing anything under a secret key. Arrays keep
 * their shape; anything deeper than MAX_DEPTH is summarised rather than walked.
 */
const redact = (value, depth = 0) => {
  if (value === null || value === undefined) return value
  if (depth > MAX_DEPTH) return "[too deep]"
  if (Array.isArray(value)) return value.slice(0, 50).map((entry) => redact(entry, depth + 1))
  if (Buffer.isBuffer(value)) return `[buffer ${value.length} bytes]`
  if (typeof value === "object") {
    const out = {}
    for (const [key, entry] of Object.entries(value)) {
      out[key] = isSecret(key) ? REDACTED : redact(entry, depth + 1)
    }
    return out
  }
  return value
}

const truncate = (text, max) => {
  const value = text === null || text === undefined ? "" : String(text)
  return value.length > max ? `${value.slice(0, max)}… [truncated]` : value
}

/** Redacted JSON, capped in size, always a valid object for jsonb. */
const safeJson = (value) => {
  try {
    const redacted = redact(value ?? {})
    const text = JSON.stringify(redacted)
    if (text === undefined) return {}
    return text.length > MAX_JSON ? { _truncated: `payload of ${text.length} characters` } : redacted
  } catch {
    // Circular references, exotic getters — the payload is not worth a crash.
    return { _unserializable: true }
  }
}

/**
 * @param {object} params
 * @param {"server_error"|"uncaught_exception"|"unhandled_rejection"} params.kind
 * @param {*} params.error      the thrown value (not always an Error)
 * @param {object} [params.req] the request, when there was one
 * @param {number} [params.status]
 * @returns {Promise<void>} resolves even when the write fails
 */
const logError = async ({ kind, error, req = null, status = null }) => {
  // Everything is inside the try, including reading the error apart. Callers
  // deliberately do not await this, so a throw here would surface as an
  // unhandled rejection — the very thing this module exists to report.
  let stack = null
  let message = ""
  try {
    // A rejection can carry any value, not just an Error.
    const isError = error instanceof Error
    const name = isError ? error.name : typeof error
    message = isError ? error.message : truncate(safeStringify(error), MAX_MESSAGE)
    stack = isError ? error.stack : null

    await query(
      `insert into error_logs
         (kind, name, message, stack, method, path, status, query, body, ip, user_agent, admin_id, customer_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        kind,
        truncate(name, 200),
        truncate(message, MAX_MESSAGE),
        stack ? truncate(stack, MAX_STACK) : null,
        req?.method || null,
        req ? truncate(req.originalUrl || req.path, 500) : null,
        status,
        JSON.stringify(safeJson(req?.query)),
        JSON.stringify(safeJson(req?.body)),
        req?.ip || null,
        req ? truncate(req.get?.("user-agent"), 500) || null : null,
        req?.admin?.id || null,
        req?.customer?.id || null,
      ]
    )
  } catch (loggingError) {
    // The database is the thing that is broken often enough that this is the
    // expected path, not a surprise. Say so on stdout and move on.
    console.error(`[error-log] could not record ${kind}: ${loggingError.message}`)
    console.error(stack || message)
  }
}

const safeStringify = (value) => {
  try {
    return typeof value === "string" ? value : JSON.stringify(value)
  } catch {
    return String(value)
  }
}

module.exports = { logError, redact, SECRET_KEYS }
