const { pool } = require("../db")
const { logError } = require("../lib/error-log")
const prodata = require("../services/prodata")
const settings = require("../services/settings")
const inventory = require("../services/inventory")

const MINUTE = 60_000

/**
 * Background work for the Pro-Data integration.
 *
 * Each job runs on its own interval under a Postgres advisory lock, so an
 * overlapping tick — or a second copy of the API behind a load balancer —
 * skips instead of running the same job twice. Nothing starts unless Pro-Data
 * is configured, so development and a shop without the integration are
 * unaffected.
 */
const JOBS = {
  catalog: { every: 6 * 60 * MINUTE, lock: 7_351_001, run: (options) => inventory.catalog.syncCatalog(options) },
  import: { every: 15_000, lock: 7_351_002, run: () => inventory.importer.runImportJobs() },
  push: { every: 30_000, lock: 7_351_003, run: () => inventory.pushes.runPushes() },
  tracking: { every: 15 * MINUTE, lock: 7_351_004, run: () => inventory.tracking.trackOrders() },
  stock: { every: 10 * MINUTE, lock: 7_351_005, run: () => inventory.stock.syncStock() },
}

// Delay before each job's first run after start, so a restart does not fire
// everything at once — and the catalog goes first, since the rest need it.
const FIRST_RUN = { catalog: 20_000, import: 25_000, push: 30_000, tracking: 60_000, stock: 90_000 }

const timers = []

/**
 * Runs one job if its lock is free. Returns false when it was already running.
 * The lock is a session lock, so it is taken and released on one dedicated
 * connection; the job itself uses the pool as usual.
 */
const runJob = async (name, options = {}) => {
  const job = JOBS[name]
  if (!job) throw Object.assign(new Error(`Unknown job "${name}".`), { status: 400 })

  const client = await pool.connect()
  let locked = false
  try {
    const { rows } = await client.query("select pg_try_advisory_lock($1) as locked", [job.lock])
    locked = rows[0].locked
    if (!locked) return false

    const startedAt = new Date()
    let record
    try {
      const summary = await job.run(options)
      record = { ok: true, summary }
    } catch (error) {
      record = { ok: false, error: String(error.message).slice(0, 1000) }
      await logError({ kind: "job_error", error: Object.assign(error, { message: `[${name}] ${error.message}` }) })
    }
    await settings.set(`inventory.run.${name}`, {
      ...record,
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt.getTime(),
    })
    return true
  } finally {
    if (locked) await client.query("select pg_advisory_unlock($1)", [job.lock]).catch(() => {})
    client.release()
  }
}

/** A tick: skip when the job is switched off, and never let a failure escape the timer. */
const tick = async (name) => {
  try {
    const switches = await settings.jobSwitches()
    if (switches[name] === false) return
    await runJob(name)
  } catch (error) {
    // runJob records the job's own failures; this catches the scheduler's
    // (the database down, say). A timer must never throw.
    await logError({ kind: "job_error", error: Object.assign(error, { message: `[scheduler:${name}] ${error.message}` }) })
  }
}

/**
 * Runs a job now, from an admin button. Not awaited by the request — the
 * catalog walk alone takes about a minute. Returns false when it is already
 * running.
 */
const runNow = async (name, options = {}) => {
  if (!JOBS[name]) throw Object.assign(new Error(`Unknown job "${name}".`), { status: 400 })
  if (!prodata.isConfigured()) throw Object.assign(new Error("Pro-Data is not configured."), { status: 400 })
  // Check the lock without holding it, so the button can say "already running".
  const { rows } = await pool.query(
    "select exists (select 1 from pg_locks where locktype = 'advisory' and objid = $1 and granted) as busy",
    [JOBS[name].lock]
  )
  if (rows[0].busy) return false
  runJob(name, options).catch((error) => logError({ kind: "job_error", error }))
  return true
}

/** Nudges a job to run soon — after an order is queued, say — without waiting for its interval. */
const kick = (name) => {
  if (!prodata.isConfigured() || !started) return
  setTimeout(() => tick(name), 250).unref()
}

let started = false
const start = () => {
  if (started || !prodata.isConfigured()) return false
  started = true
  for (const [name, job] of Object.entries(JOBS)) {
    timers.push(setTimeout(() => tick(name), FIRST_RUN[name]).unref())
    timers.push(setInterval(() => tick(name), job.every).unref())
  }
  console.log("Pro-Data sync started.")
  return true
}

const stop = () => {
  for (const timer of timers.splice(0)) clearTimeout(timer)
  started = false
}

module.exports = { start, stop, runJob, runNow, kick, JOBS }
