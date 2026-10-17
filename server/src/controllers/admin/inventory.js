const { query, tx } = require("../../db")
const { money, pageParams } = require("../../lib/util")
const prodata = require("../../services/prodata")
const settings = require("../../services/settings")
const inventory = require("../../services/inventory")
const scheduler = require("../../jobs/scheduler")

const JOBS = ["catalog", "import", "push", "tracking", "stock"]

/** A search term for ILIKE, with its wildcards taken literally. */
const likePattern = (text) => `%${String(text).replace(/[\\%_]/g, (char) => `\\${char}`)}%`

/** Where the shop connects to — host only, never credentials. */
const connectionLabel = () => {
  try {
    const url = new URL(process.env.PRODATA_URL)
    return `${url.protocol}//${url.host}`
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- status & settings

const status = async (_req, res) => {
  const [switches, stored] = await Promise.all([
    settings.jobSwitches(),
    settings.getMany(["inventory.warehouses", "inventory.discount_mode", ...JOBS.map((job) => `inventory.run.${job}`)]),
  ])
  const { rows: counts } = await query(
    `select
       (select count(*) from inventory_items)::int as items,
       (select count(*) from inventory_items i
         where not i.ignored and i.removed_at is null
           and not exists (select 1 from variants v where v.inventory_item_id = i.id))::int as new_items,
       (select count(*) from inventory_jobs where state in ('queued', 'running'))::int as import_queue,
       (select count(*) from inventory_jobs where state = 'failed')::int as import_failed,
       (select count(*) from products where status = 'draft' and metadata->>'imported_from' = 'prodata')::int as drafts_to_review,
       (select count(*) from inventory_push_lines l join inventory_pushes p on p.id = l.push_id
         where l.resolution is null and p.state = 'waiting_links')::int as needs_linking,
       (select count(*) from inventory_pushes where state in ('failed', 'needs_check'))::int as push_problems,
       (select count(*) from inventory_pushes where state in ('queued', 'sending'))::int as push_queue,
       (select count(*) from inventory_pushes where void_required and void_done_at is null)::int as void_required,
       (select count(*) from inventory_pushes p join orders o on o.id = p.order_id
         where p.pro_data_status = 'A' and o.status <> 'canceled')::int as canceled_in_prodata`
  )
  const { rows: errors } = await query(
    "select message, created_at from error_logs where kind = 'job_error' order by created_at desc limit 10"
  )
  // The orders a person has to act on, so the page can link straight to them.
  const { rows: attention } = await query(
    `select o.id, o.display_id, p.state, p.last_error, p.pro_data_order_id,
            (p.void_required and p.void_done_at is null) as void_required,
            (p.pro_data_status = 'A' and o.status <> 'canceled') as canceled_in_prodata
       from inventory_pushes p join orders o on o.id = p.order_id
      where p.state in ('failed', 'needs_check')
         or (p.void_required and p.void_done_at is null)
         or (p.pro_data_status = 'A' and o.status <> 'canceled')
      order by o.created_at desc limit 50`
  )
  res.json({
    configured: prodata.isConfigured(),
    connection: connectionLabel(),
    plain_http: /^http:/i.test(process.env.PRODATA_URL || ""),
    jobs: Object.fromEntries(
      JOBS.map((job) => [job, { enabled: switches[job] !== false, last_run: stored[`inventory.run.${job}`] }])
    ),
    settings: { warehouses: stored["inventory.warehouses"], discount_mode: stored["inventory.discount_mode"] },
    counts: counts[0],
    attention,
    recent_errors: errors,
  })
}

/** Signs in afresh and reads one catalog row. The answer is a result, not an API failure. */
const testConnection = async (_req, res) => {
  if (!prodata.isConfigured()) {
    return res.json({ ok: false, message: "Pro-Data is not configured. Set PRODATA_URL, PRODATA_USERNAME and PRODATA_PASSWORD." })
  }
  try {
    prodata.resetAuth()
    await prodata.authenticate()
    const rows = await prodata.listItems({ page: 1, rowsPerPage: 1 })
    res.json({ ok: true, message: rows.length ? "Signed in, and the catalog answered." : "Signed in, but the catalog is empty." })
  } catch (error) {
    res.json({ ok: false, message: error.message })
  }
}

const runJob = async (req, res) => {
  const started = await scheduler.runNow(req.params.job, { acceptRemovals: Boolean(req.body.accept_removals) })
  res.json({ started, message: started ? "Started." : "That job is already running." })
}

const updateSettings = async (req, res) => {
  const { warehouses, discount_mode: discountMode, jobs } = req.body
  if (warehouses !== undefined) await settings.set("inventory.warehouses", warehouses?.length ? warehouses : null)
  if (discountMode) await settings.set("inventory.discount_mode", discountMode)
  if (jobs) await settings.set("inventory.jobs", { ...(await settings.jobSwitches()), ...jobs })
  // A different set of counted warehouses changes what the site may sell.
  if (warehouses !== undefined) scheduler.kick("stock")
  res.json({ success: true })
}

/** Every warehouse name Pro-Data has reported, plus any already chosen. */
const warehouses = async (_req, res) => {
  const { rows } = await query(
    `select distinct w->>'warehouse' as name
       from inventory_items, jsonb_array_elements(coalesce(stock_by_warehouse, '[]'::jsonb)) w
      where w->>'warehouse' <> '' order by 1`
  )
  const chosen = (await settings.get("inventory.warehouses")) || []
  const names = [...new Set([...rows.map((row) => row.name), ...chosen])].sort()
  res.json({ warehouses: names, counted: chosen.length ? chosen : null })
}

const classifications = async (_req, res) => {
  const { rows } = await query(
    `select i.category, i.sub_category, count(*)::int as items, m.category_id, c.name as category_name
       from inventory_items i
       left join inventory_category_map m on m.category = i.category and m.sub_category = i.sub_category
       left join categories c on c.id = m.category_id
      where i.removed_at is null
      group by i.category, i.sub_category, m.category_id, c.name
      order by i.category, i.sub_category`
  )
  res.json({ classifications: rows })
}

const categoryMap = async (req, res) => {
  await tx(async (client) => {
    for (const mapping of req.body.mappings) {
      if (mapping.category_id) {
        await client.query(
          `insert into inventory_category_map (category, sub_category, category_id) values ($1, $2, $3)
           on conflict (category, sub_category) do update set category_id = excluded.category_id`,
          [mapping.category, mapping.sub_category || "", mapping.category_id]
        )
      } else {
        await client.query("delete from inventory_category_map where category = $1 and sub_category = $2", [
          mapping.category,
          mapping.sub_category || "",
        ])
      }
    }
  })
  res.json({ success: true })
}

// ---------------------------------------------------------------- inbox

const LINKED = "exists (select 1 from variants v where v.inventory_item_id = i.id)"
const TAB_FILTERS = {
  new: `not i.ignored and i.removed_at is null and not ${LINKED}`,
  ignored: "i.ignored",
  imported: LINKED,
  removed: "i.removed_at is not null",
  linkable: "i.removed_at is null",
  all: "true",
}

const listItems = async (req, res) => {
  const { limit, offset } = pageParams(req, 50, 200)
  const where = [TAB_FILTERS[req.query.tab]]
  const params = []
  const add = (sql, value) => {
    params.push(value)
    where.push(sql.replace("?", `$${params.length}`))
  }
  if (req.query.q) {
    params.push(likePattern(req.query.q))
    const p = `$${params.length}`
    where.push(`(i.code ilike ${p} escape '\\' or i.name ilike ${p} escape '\\' or i.barcode ilike ${p} escape '\\')`)
  }
  if (req.query.category) add("i.category = ?", req.query.category)
  if (req.query.sub_category) add("i.sub_category = ?", req.query.sub_category)
  if (req.query.has_images) where.push("i.image_count > 0")
  const whereSql = where.join(" and ")

  const { rows: countRows } = await query(`select count(*)::int as count from inventory_items i where ${whereSql}`, params)
  const { rows } = await query(
    `select i.id, i.code, i.name, i.brand, i.category, i.sub_category, i.price, i.vat, i.image_count,
            i.ignored, i.removed_at, i.last_seen_at, i.stock_by_warehouse, i.stock_checked_at,
            (select json_build_object('product_id', p.id, 'title', p.title, 'status', p.status)
               from variants v join products p on p.id = v.product_id
              where v.inventory_item_id = i.id limit 1) as product,
            (select json_build_object('state', j.state, 'error', j.last_error)
               from inventory_jobs j where j.inventory_item_id = i.id
              order by j.created_at desc limit 1) as job
       from inventory_items i
      where ${whereSql}
      order by i.name, i.code
      limit ${limit} offset ${offset}`,
    params
  )
  const counted = await settings.get("inventory.warehouses")
  res.json({
    items: rows.map((row) => ({
      ...row,
      price: row.price === null ? null : money(row.price),
      available: row.stock_by_warehouse ? inventory.stock.available(row.stock_by_warehouse, counted) : null,
    })),
    count: countRows[0].count,
  })
}

const getItem = async (req, res) => {
  const { rows } = await query("select * from inventory_items where id = $1", [req.params.id])
  if (!rows.length) return res.status(404).json({ message: "That item is not in the inventory mirror." })
  const item = rows[0]
  const { rows: linked } = await query(
    `select v.id as variant_id, v.title as variant_title, p.id as product_id, p.title as product_title, p.status
       from variants v join products p on p.id = v.product_id where v.inventory_item_id = $1`,
    [item.id]
  )
  res.json({ item: { ...item, available: await inventory.stock.availableForItem(item), linked } })
}

const importItems = async (req, res) => {
  const result = await inventory.importer.queueImports(req.body.ids, req.admin.email)
  if (result.queued) scheduler.kick("import")
  res.json(result)
}

const ignoreItems = async (req, res) => {
  const { rowCount } = await query("update inventory_items set ignored = $2 where id = any($1::uuid[])", [
    req.body.ids,
    req.body.ignored,
  ])
  res.json({ updated: rowCount })
}

// ---------------------------------------------------------------- needs linking

/**
 * Lines the admin still has to settle. Only orders still waiting to be sent
 * count: a line left unmapped on an order that was canceled meanwhile needs
 * nothing from anyone.
 */
const listLinks = async (req, res) => {
  const { limit, offset } = pageParams(req, 50, 200)
  const { rows: countRows } = await query(
    `select count(*)::int as count from inventory_push_lines l join inventory_pushes p on p.id = l.push_id
      where l.resolution is null and p.state = 'waiting_links'`
  )
  const { rows } = await query(
    `select l.id, l.title, l.quantity, l.unit_price, l.net_price, l.variant_id,
            o.id as order_id, o.display_id, o.created_at as order_created_at, o.status as order_status,
            p.last_error, v.sku, pr.id as product_id, pr.title as product_title
       from inventory_push_lines l
       join inventory_pushes p on p.id = l.push_id
       join orders o on o.id = p.order_id
       left join variants v on v.id = l.variant_id
       left join products pr on pr.id = v.product_id
      where l.resolution is null and p.state = 'waiting_links'
      order by o.created_at, l.line_no
      limit ${limit} offset ${offset}`
  )
  res.json({ lines: rows.map((row) => ({ ...row, unit_price: money(row.unit_price), net_price: money(row.net_price) })), count: countRows[0].count })
}

const resolveLink = async (req, res) => {
  const result = await inventory.pushes.resolveLine(req.params.id, {
    action: req.body.action,
    inventoryItemId: req.body.inventory_item_id || null,
    by: req.admin.email,
  })
  scheduler.kick("push")
  res.json(result)
}

// ---------------------------------------------------------------- products & variants

/** The editor's Pro-Data panel: each variant's link, with Pro-Data's price and stock alongside. */
const getProduct = async (req, res) => {
  const { rows: products } = await query("select id, metadata from products where id = $1", [req.params.id])
  if (!products.length) return res.status(404).json({ message: "Product not found." })
  const { rows } = await query(
    `select v.id as variant_id, v.title as variant_title, v.sku, v.inventory_sync, v.stock, v.manage_stock,
            i.id as item_id, i.code, i.name, i.price, i.vat, i.removed_at, i.stock_by_warehouse, i.stock_checked_at,
            (select count(*)::int from variants other where other.inventory_item_id = i.id and other.id <> v.id) as shared_with
       from variants v left join inventory_items i on i.id = v.inventory_item_id
      where v.product_id = $1 order by v.sort_order, v.created_at`,
    [req.params.id]
  )
  const counted = await settings.get("inventory.warehouses")
  res.json({
    configured: prodata.isConfigured(),
    imported: products[0].metadata?.imported_from === "prodata",
    import_flags: products[0].metadata?.import_flags || [],
    variants: rows.map((row) => ({
      variant_id: row.variant_id,
      variant_title: row.variant_title,
      sku: row.sku,
      inventory_sync: row.inventory_sync,
      stock: row.stock,
      manage_stock: row.manage_stock,
      item: row.item_id
        ? {
            id: row.item_id,
            code: row.code,
            name: row.name,
            price: row.price === null ? null : money(row.price),
            vat: row.vat === null ? null : Number(row.vat),
            removed: Boolean(row.removed_at),
            warehouses: (row.stock_by_warehouse || []).filter((w) => !counted || counted.includes(w.warehouse)),
            available: row.stock_by_warehouse ? inventory.stock.available(row.stock_by_warehouse, counted) : null,
            stock_checked_at: row.stock_checked_at,
            shared_with: row.shared_with,
          }
        : null,
    })),
  })
}

const linkVariant = async (req, res) => {
  const result = await inventory.pushes.linkVariant(req.params.id, req.body.inventory_item_id, req.admin.email)
  if (result.linked) {
    scheduler.kick("stock")
    if (result.resolvedLines) scheduler.kick("push")
  }
  res.json(result)
}

const updateVariant = async (req, res) => {
  const { rowCount } = await query("update variants set inventory_sync = $2 where id = $1", [
    req.params.id,
    req.body.inventory_sync,
  ])
  if (!rowCount) return res.status(404).json({ message: "That product version no longer exists." })
  res.json({ success: true })
}

// ---------------------------------------------------------------- orders

/** The order page's Pro-Data panel. */
const getOrder = async (req, res) => {
  const { rows: orders } = await query("select id, status from orders where id = $1", [req.params.id])
  if (!orders.length) return res.status(404).json({ message: "Order not found." })
  const { rows: pushes } = await query("select * from inventory_pushes where order_id = $1", [req.params.id])
  const push = pushes[0] || null
  let lines = []
  let returnsToRecord = false
  if (push) {
    const { rows } = await query(
      `select l.id, l.line_no, l.title, l.quantity, l.unit_price, l.net_price, l.resolution, i.code, i.name
         from inventory_push_lines l left join inventory_items i on i.id = l.inventory_item_id
        where l.push_id = $1 order by l.line_no`,
      [push.id]
    )
    lines = rows.map((row) => ({ ...row, unit_price: money(row.unit_price), net_price: money(row.net_price) }))
    // A refund that put stock back after Pro-Data had the sale needs the same
    // return recorded there — their API has no way to do it.
    if (push.sent_at) {
      const { rows: refunds } = await query(
        `select 1 from order_events where order_id = $1 and type = 'refunded'
            and (data->>'restock')::boolean and created_at > $2 limit 1`,
        [req.params.id, push.sent_at]
      )
      returnsToRecord = refunds.length > 0
    }
  }
  res.json({
    configured: prodata.isConfigured(),
    order_status: orders[0].status,
    push: push && {
      state: push.state,
      attempts: push.attempts,
      last_error: push.last_error,
      next_attempt_at: push.next_attempt_at,
      pro_data_order_id: push.pro_data_order_id,
      pro_data_status: push.pro_data_status,
      pro_data_status_at: push.pro_data_status_at,
      void_required: push.void_required && !push.void_done_at,
      void_done_at: push.void_done_at,
      sent_at: push.sent_at,
      canceled_in_prodata: push.pro_data_status === "A" && orders[0].status !== "canceled",
      returns_to_record: returnsToRecord,
    },
    lines,
  })
}

const sendOrder = async (req, res) => {
  const push = await inventory.pushes.sendNow(req.params.id)
  if (push?.state === "queued") scheduler.kick("push")
  res.json({ push })
}

const resolveOrder = async (req, res) => {
  await inventory.pushes.resolvePush(req.params.id, {
    action: req.body.action,
    proDataOrderId: req.body.pro_data_order_id,
  })
  if (req.body.action === "send_again") scheduler.kick("push")
  res.json({ success: true })
}

module.exports = {
  status,
  testConnection,
  runJob,
  updateSettings,
  warehouses,
  classifications,
  categoryMap,
  listItems,
  getItem,
  importItems,
  ignoreItems,
  listLinks,
  resolveLink,
  getProduct,
  linkVariant,
  updateVariant,
  getOrder,
  sendOrder,
  resolveOrder,
}
