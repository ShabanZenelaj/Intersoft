const { query } = require("../../db")
const prodata = require("../prodata")
const settings = require("../settings")

const PAGE_SIZE = 1000
// Half a million rows. A walk that reaches this is not ending, not large.
const MAX_PAGES = 500
// A complete walk may remove items only if it found at least this share of
// what the last complete walk found. Below that, something is more likely to
// be wrong with the walk than with the catalog.
const REMOVAL_FLOOR = 0.9
const UPSERT_CHUNK = 500

const numberOrNull = (value) => (Number.isFinite(Number(value)) && value !== "" && value !== null ? Number(value) : null)

/** One Items row as a mirror record. Items carries no brand or comment — those come from ItemsStoku at import. */
const toMirror = (row) => ({
  code: String(row.code || "").trim(),
  source_id: Number.isInteger(row.sortID) ? row.sortID : null,
  barcode: String(row.barcode || "").trim(),
  name: String(row.description || "").trim(),
  category: String(row.klasifikimi1 || "").trim(),
  sub_category: String(row.klasifikimi2 || "").trim(),
  vat: numberOrNull(row.vat),
  price: numberOrNull(row.price),
  image_count: Math.max(0, Math.floor(Number(row.noImages) || 0)),
  raw: row,
})

/**
 * Reads the whole catalog. `Items` repeats rows verbatim (the same item a
 * dozen times over), and those exact repeats are collapsed here. Matching
 * codes case-insensitively is left to Postgres, everywhere: JavaScript and
 * Postgres disagree on lowercasing outside ASCII (under the C locale Postgres
 * leaves "Ë" alone, JavaScript does not), and a mirror that compares codes one
 * way when writing and another way when removing will "remove" items it just
 * wrote. The walk counts as complete only when it ends the way this endpoint
 * ends: on a page shorter than asked for.
 */
const walk = async () => {
  const byCode = new Map()
  let rows = 0
  let pages = 0
  let complete = false
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await prodata.listItems({ page, rowsPerPage: PAGE_SIZE })
    pages = page
    rows += batch.length
    for (const row of batch) {
      const code = String(row?.code || "").trim()
      if (code) byCode.set(code, row)
    }
    if (batch.length < PAGE_SIZE) {
      complete = true
      break
    }
  }
  return { items: [...byCode.values()].map(toMirror), rows, pages, complete }
}

/**
 * Writes a chunk into the mirror. Only rows whose data actually changed are
 * rewritten, so a second sync with nothing new reports nothing changed.
 * Brand, comment and second name are not touched: Items does not carry them,
 * and the import step fills them from ItemsStoku.
 */
const upsertChunk = async (chunk) => {
  const { rows } = await query(
    `with incoming as (
       select * from jsonb_to_recordset($1::jsonb) as t(
         code text, source_id int, barcode text, name text, category text, sub_category text,
         vat numeric, price numeric, image_count int, raw jsonb)
     ), written as (
       insert into inventory_items as i
         (code, source_id, barcode, name, category, sub_category, vat, price, image_count, raw)
       -- One row per code as Postgres folds case, so a chunk can never try
       -- to update the same mirror row twice.
       select distinct on (lower(code)) code, source_id, barcode, name, category, sub_category, vat, price, image_count, raw
         from incoming order by lower(code)
       on conflict ((lower(code))) do update set
         code = excluded.code, source_id = excluded.source_id, barcode = excluded.barcode, name = excluded.name,
         category = excluded.category, sub_category = excluded.sub_category, vat = excluded.vat,
         price = excluded.price, image_count = excluded.image_count, raw = excluded.raw, removed_at = null
       where i.raw is distinct from excluded.raw or i.removed_at is not null or i.code <> excluded.code
       returning (xmax = 0) as inserted
     )
     select count(*) filter (where inserted)::int as inserted,
            count(*) filter (where not inserted)::int as updated
       from written`,
    [JSON.stringify(chunk)]
  )
  await query(
    "update inventory_items set last_seen_at = now() where lower(code) in (select lower(c) from unnest($1::text[]) c)",
    [chunk.map((item) => item.code)]
  )
  return rows[0]
}

/**
 * Pulls Pro-Data's catalog into the mirror.
 *
 * Removing is the dangerous half. An item missing from the walk is marked
 * removed only when the walk is demonstrably whole — it ended on a short page
 * and found at least 90% of what the previous complete walk did. A walk that
 * breaks off, or an endpoint that suddenly pages differently, must never make
 * the shop believe most of its catalog has vanished. `acceptRemovals` lets an
 * admin confirm a genuinely large clean-up after seeing the warning.
 */
const syncCatalog = async ({ acceptRemovals = false } = {}) => {
  const { items, rows, pages, complete } = await walk()

  let inserted = 0
  let updated = 0
  for (let i = 0; i < items.length; i += UPSERT_CHUNK) {
    const result = await upsertChunk(items.slice(i, i + UPSERT_CHUNK))
    inserted += result.inserted
    updated += result.updated
  }

  const previous = await settings.get("inventory.catalog.last_count")
  let removed = 0
  let removalSkipped = null
  if (!complete) {
    removalSkipped = `The walk stopped after ${pages} pages without reaching the end, so nothing was marked removed.`
  } else if (previous && items.length < previous * REMOVAL_FLOOR && !acceptRemovals) {
    removalSkipped =
      `This walk found ${items.length} items, against ${previous} last time. That drop is large enough to ` +
      "look like a problem with Pro-Data rather than real deletions, so nothing was marked removed."
  } else {
    const { rowCount } = await query(
      `update inventory_items set removed_at = now()
        where removed_at is null and lower(code) not in (select lower(c) from unnest($1::text[]) c)`,
      [items.map((item) => item.code)]
    )
    removed = rowCount
    await settings.set("inventory.catalog.last_count", items.length)
  }

  return { pages, rows, distinct: items.length, inserted, updated, removed, complete, removal_skipped: removalSkipped }
}

module.exports = { syncCatalog, walk, toMirror, REMOVAL_FLOOR }
