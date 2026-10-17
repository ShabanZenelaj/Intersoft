const { query } = require("../db")

/**
 * Small key/value store for non-secret configuration and job bookkeeping.
 * Secrets never live here — credentials come from the environment.
 *
 * Every key has a default, so a fresh database behaves sensibly before anyone
 * has opened a settings page.
 */
const DEFAULTS = {
  // Warehouse names whose stock counts toward what the website can sell.
  // null means all of them.
  "inventory.warehouses": null,
  // How the per-line discount is written into Pro-Data's `discount` field.
  // Their system stores `priceAfterDiscount` as the price and computes nothing
  // from `discount`, so this only affects what staff read there. Their own
  // customer "rabat" is a percentage, hence the default.
  "inventory.discount_mode": "percent",
  // Each background job can be switched off from the status page.
  "inventory.jobs": { catalog: true, import: true, push: true, tracking: true, stock: true },
  // The distinct item count of the last complete catalog walk — the yardstick
  // for deciding whether a new walk is complete enough to trust with removals.
  "inventory.catalog.last_count": null,
}

const get = async (key) => {
  const { rows } = await query("select value from settings where key = $1", [key])
  return rows.length ? rows[0].value : DEFAULTS[key] ?? null
}

const getMany = async (keys) => {
  const { rows } = await query("select key, value from settings where key = any($1::text[])", [keys])
  const stored = new Map(rows.map((row) => [row.key, row.value]))
  return Object.fromEntries(keys.map((key) => [key, stored.has(key) ? stored.get(key) : DEFAULTS[key] ?? null]))
}

const set = async (key, value) => {
  await query(
    `insert into settings (key, value, updated_at) values ($1, $2, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, JSON.stringify(value)]
  )
}

/** Job switches, with any job missing from the stored value falling back to on. */
const jobSwitches = async () => ({ ...DEFAULTS["inventory.jobs"], ...((await get("inventory.jobs")) || {}) })

module.exports = { get, getMany, set, jobSwitches, DEFAULTS }
