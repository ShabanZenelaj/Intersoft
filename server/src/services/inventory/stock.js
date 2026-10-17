const { query, tx } = require("../../db")
const prodata = require("../prodata")
const settings = require("../settings")

// Their API runs on an office server; the client caps requests in flight at 3,
// so a wider pool here would only queue.
const CONCURRENCY = 3

/** Their `[{warehouse, quantityAvailable}]` as the mirror stores it. */
const normalizeWarehouses = (warehouses) =>
  (Array.isArray(warehouses) ? warehouses : []).map((entry) => ({
    warehouse: String(entry.warehouse || "").trim(),
    quantity: Number(entry.quantityAvailable ?? entry.quantity) || 0,
  }))

/**
 * What the website may sell from Pro-Data's stock.
 *
 * Only the warehouses the admin chose count (null = all). Each one is clamped
 * at zero before summing: Pro-Data happily carries negative balances (−3713 in
 * one demo warehouse), and one broken ledger must not cancel out real stock
 * sitting in another. Fractional quantities round down — half a laptop is not
 * for sale.
 */
const available = (warehouses, counted) => {
  const allowed = Array.isArray(counted) ? new Set(counted) : null
  const total = (warehouses || [])
    .filter((entry) => !allowed || allowed.has(entry.warehouse))
    .reduce((sum, entry) => sum + Math.max(0, Number(entry.quantity) || 0), 0)
  return Math.floor(total + 1e-9)
}

/**
 * Units of a Pro-Data item that web orders have claimed but Pro-Data's stock
 * does not yet reflect.
 *
 * Pro-Data only takes stock down when staff invoice an order (status M). Until
 * then, every web sale of the item is subtracted here:
 *   - orders still `pending`, which Pro-Data has not seen at all
 *   - orders sent or on their way, while Pro-Data still has them open (H)
 * Invoiced (M) or canceled (A) orders, and orders we canceled, claim nothing.
 * An order we marked delivered but Pro-Data has not invoiced still claims its
 * units — Pro-Data's count has not moved yet.
 */
const reserved = async (client, itemId) => {
  const { rows } = await client.query(
    `select coalesce((
        select sum(l.quantity)
          from inventory_push_lines l
          join inventory_pushes p on p.id = l.push_id
          join orders o on o.id = p.order_id
         where l.inventory_item_id = $1
           and l.resolution in ('auto', 'linked', 'one_off')
           and o.status <> 'canceled'
           and (p.state <> 'sent' or p.pro_data_status is null or p.pro_data_status = 'H')
      ), 0)
      + coalesce((
        select sum((line->>'quantity')::int)
          from orders o
          cross join lateral jsonb_array_elements(o.items) line
          join variants v on v.id = (line->>'variant_id')::uuid
         where o.status = 'pending'
           and v.inventory_item_id = $1
           and not exists (select 1 from inventory_pushes p where p.order_id = o.id)
      ), 0) as reserved`,
    [itemId]
  )
  return Number(rows[0].reserved) || 0
}

/** Stores what Pro-Data said about one item: stock, and the details only ItemsStoku carries. */
const recordDetails = async (itemId, details) => {
  await query(
    `update inventory_items set
       stock_by_warehouse = $2, stock_checked_at = now(),
       brand = coalesce(nullif($3, ''), brand),
       comment = coalesce(nullif($4, ''), comment),
       name_alt = coalesce(nullif($5, ''), name_alt)
     where id = $1`,
    [
      itemId,
      JSON.stringify(normalizeWarehouses(details?.warehouses)),
      String(details?.brand || "").trim(),
      String(details?.comment || "").trim(),
      String(details?.emertimiiDyte || "").trim(),
    ]
  )
}

/**
 * Sets every linked variant's stock from one item's availability.
 *
 * Each variant is written in its own transaction that first locks the variant
 * row. Checkout decrements stock by updating that same row, so it cannot slip
 * an order in between reading the reservations and writing the result: either
 * its order is committed before the lock is granted (and counted), or its
 * decrement waits and lands on top of the value written here.
 */
const applyToVariants = async (item, availableUnits) => {
  const { rows: variants } = await query(
    "select id from variants where inventory_item_id = $1 and manage_stock and inventory_sync",
    [item.id]
  )
  let changed = 0
  for (const variant of variants) {
    await tx(async (client) => {
      const { rows } = await client.query("select stock from variants where id = $1 for update", [variant.id])
      if (!rows.length) return
      const target = Math.max(0, availableUnits - (await reserved(client, item.id)))
      if (rows[0].stock !== target) {
        await client.query("update variants set stock = $1 where id = $2", [target, variant.id])
        changed++
      }
    })
  }
  return changed
}

/** Runs `fn` over `items` with at most `limit` in flight. */
const pool = async (items, limit, fn) => {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift())
  })
  await Promise.all(workers)
}

/**
 * Refreshes stock for every Pro-Data item a web variant is linked to — not the
 * whole catalog. ItemsStoku can only be trusted one code at a time (its paged
 * form skips items), and only linked items matter to the website.
 */
const syncStock = async () => {
  const counted = await settings.get("inventory.warehouses")
  const { rows: items } = await query(
    `select distinct i.id, i.code, i.removed_at
       from inventory_items i
       join variants v on v.inventory_item_id = i.id
      where v.manage_stock and v.inventory_sync`
  )

  let checked = 0
  let variantsChanged = 0
  const failures = []

  await pool(items, CONCURRENCY, async (item) => {
    try {
      let units = 0
      if (!item.removed_at) {
        const details = await prodata.getItemStock(item.code)
        await recordDetails(item.id, details)
        // No stock records at all is Pro-Data's way of saying none.
        units = details ? available(normalizeWarehouses(details.warehouses), counted) : 0
      }
      checked++
      variantsChanged += await applyToVariants(item, units)
    } catch (error) {
      failures.push(`${item.code}: ${error.message}`)
    }
  })

  if (failures.length && !checked) {
    // Nothing got through at all — most likely Pro-Data is down. Fail the run
    // so the status page says so, rather than reporting a quiet success.
    throw new Error(`Stock sync reached no items. First error: ${failures[0]}`)
  }
  return { items: items.length, checked, variants_changed: variantsChanged, failed: failures.length, failures: failures.slice(0, 10) }
}

/** Current availability of one mirrored item, from what was last read. */
const availableForItem = async (item) => {
  const counted = await settings.get("inventory.warehouses")
  return available(item.stock_by_warehouse || [], counted)
}

module.exports = {
  syncStock,
  available,
  availableForItem,
  normalizeWarehouses,
  recordDetails,
  reserved,
  applyToVariants,
}
