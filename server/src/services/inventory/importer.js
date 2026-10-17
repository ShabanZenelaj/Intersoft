const crypto = require("crypto")
const { query } = require("../../db")
const prodata = require("../prodata")
const ai = require("../ai")
const { saveImage } = require("../uploads")
const { upsertProduct } = require("../products")
const { normalizeWarehouses, recordDetails, availableForItem } = require("./stock")

const JOBS_PER_TICK = 5
const MAX_ATTEMPTS = 3
// A Pro-Data item may list many images; a product page needs a handful.
const MAX_IMAGES = 8
// A job left "running" this long belongs to a process that died mid-import.
const STALE_MINUTES = 15

/**
 * Queues items for import as draft products. Skips anything that would make
 * a second product for the same item: items already linked to a variant,
 * items with an import still pending, and ignored or removed items.
 */
const queueImports = async (itemIds, requestedBy) => {
  const { rows } = await query(
    `insert into inventory_jobs (inventory_item_id, requested_by)
     select i.id, $2 from inventory_items i
      where i.id = any($1::uuid[])
        and not i.ignored and i.removed_at is null
        and not exists (select 1 from variants v where v.inventory_item_id = i.id)
     on conflict (inventory_item_id) where state in ('queued', 'running') do nothing
     returning id`,
    [itemIds, requestedBy || null]
  )
  return { queued: rows.length, skipped: itemIds.length - rows.length }
}

/** Where a Pro-Data classification lands: the exact pair first, then the main classification alone. */
const mappedCategory = async (item) => {
  const { rows } = await query(
    `select category_id from inventory_category_map
      where category = $1 and sub_category in ($2, '')
      order by (sub_category = $2) desc limit 1`,
    [item.category, item.sub_category]
  )
  return rows[0]?.category_id || null
}

/** Downloads the item's images and stores them as our own uploads, skipping empties and repeats. */
const importImages = async (item) => {
  const urls = []
  const seen = new Set()
  for (let n = 1; n <= Math.min(item.image_count, MAX_IMAGES); n++) {
    const buffer = await prodata.getItemImage(item.code, n)
    if (!buffer) continue
    const hash = crypto.createHash("sha1").update(buffer).digest("hex")
    if (seen.has(hash)) continue
    seen.add(hash)
    try {
      urls.push(await saveImage({ buffer, originalname: `${item.code}-${n}.jpg` }))
    } catch {
      // Not a supported image (their server has been known to hand back
      // oddities). One bad picture must not sink the import.
    }
  }
  return urls
}

/** Collapses the runs of spaces stockroom names tend to carry. */
const tidy = (value) => String(value || "").replace(/\s+/g, " ").trim()

/**
 * Creates one draft product from one Pro-Data item.
 *
 * Idempotent: if the item is already linked to a variant (an earlier attempt
 * got that far, or someone linked it by hand), that product is returned and
 * nothing new is made. Product and link are written in one transaction by
 * upsertProduct, so an attempt that fails never leaves an unlinked draft behind.
 */
const importItem = async (itemId) => {
  const { rows: existing } = await query(
    "select product_id from variants where inventory_item_id = $1 limit 1",
    [itemId]
  )
  if (existing.length) return { productId: existing[0].product_id, flags: [] }

  const { rows } = await query("select * from inventory_items where id = $1", [itemId])
  const item = rows[0]
  if (!item) throw new Error("The item is no longer in the inventory mirror.")

  // ItemsStoku is the only place with brand, comment and second name.
  const details = await prodata.getItemStock(item.code)
  await recordDetails(item.id, details)
  const fresh = {
    ...item,
    brand: tidy(details?.brand) || item.brand,
    comment: tidy(details?.comment) || item.comment,
    name_alt: tidy(details?.emertimiiDyte) || item.name_alt,
    stock_by_warehouse: normalizeWarehouses(details?.warehouses),
  }

  const flags = []
  const categoryId = await mappedCategory(fresh)
  if (!categoryId) flags.push("uncategorized")

  const images = await importImages(fresh)
  if (!images.length) flags.push("no_images")

  const price = Number(fresh.price) || 0
  if (price <= 0) flags.push("no_price")

  let copy = null
  if (ai.isConfigured()) {
    try {
      copy = await ai.enhanceBilingual(fresh)
    } catch {
      flags.push("not_enriched")
    }
  } else {
    flags.push("not_enriched")
  }

  const name = tidy(fresh.name) || fresh.code
  const productId = await upsertProduct({
    title: copy?.title_en || name,
    description: copy?.description_en || "",
    brand: fresh.brand,
    status: "draft",
    category_id: categoryId,
    tags: copy?.tags || [],
    images,
    metadata: {
      ...(copy ? { title_sq: copy.title_sq, description_sq: copy.description_sq } : { title_sq: name }),
      imported_from: "prodata",
      import_flags: flags,
      imported_at: new Date().toISOString(),
    },
    variants: [
      {
        title: "Default",
        sku: fresh.code,
        price,
        stock: await availableForItem(fresh),
        manage_stock: true,
        inventory_item_id: fresh.id,
      },
    ],
  })

  return { productId, flags }
}

/**
 * Works through queued imports a few at a time. Each import makes several
 * calls to Pro-Data plus one to the copy assistant, so a big selection is
 * spread over several ticks instead of blocking one for minutes.
 */
const runImportJobs = async () => {
  await query(
    `update inventory_jobs set state = 'queued', updated_at = now()
      where state = 'running' and updated_at < now() - make_interval(mins => $1)`,
    [STALE_MINUTES]
  )

  const { rows: jobs } = await query(
    `update inventory_jobs set state = 'running', attempts = attempts + 1, updated_at = now()
      where id in (
        select id from inventory_jobs where state = 'queued'
         order by created_at for update skip locked limit $1)
      returning *`,
    [JOBS_PER_TICK]
  )

  let done = 0
  let failed = 0
  for (const job of jobs) {
    try {
      const { productId } = await importItem(job.inventory_item_id)
      await query(
        "update inventory_jobs set state = 'done', product_id = $2, last_error = null, updated_at = now() where id = $1",
        [job.id, productId]
      )
      done++
    } catch (error) {
      const giveUp = job.attempts >= MAX_ATTEMPTS
      await query(
        "update inventory_jobs set state = $2, last_error = $3, updated_at = now() where id = $1",
        [job.id, giveUp ? "failed" : "queued", String(error.message).slice(0, 1000)]
      )
      if (giveUp) failed++
    }
  }

  const { rows: left } = await query("select count(*)::int as n from inventory_jobs where state = 'queued'")
  return { picked: jobs.length, done, failed, still_queued: left[0].n }
}

module.exports = { queueImports, importItem, runImportJobs, mappedCategory }
