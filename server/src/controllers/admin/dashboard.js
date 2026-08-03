const { query } = require("../../db")
const { money } = require("../../lib/util")
const { orderToJson } = require("../../lib/serialize")

const stats = async (_req, res) => {
  const [orders30, revenue30, customers, awaiting, lowStock, recentOrders, byDay] = await Promise.all([
    query("select count(*)::int as count from orders where created_at > now() - interval '30 days'"),
    query(
      `select coalesce(sum(total), 0) as sum from orders
        where created_at > now() - interval '30 days' and status <> 'canceled'`
    ),
    query("select count(*)::int as count from customers"),
    query("select count(*)::int as count from orders where payment_status = 'awaiting' and status <> 'canceled'"),
    query(
      `select v.id, v.sku, v.stock, v.title as variant_title, p.id as product_id, p.title as product_title
         from variants v join products p on p.id = v.product_id
        where v.manage_stock and v.stock <= 5 and p.status = 'published'
        order by v.stock asc limit 10`
    ),
    query("select * from orders order by created_at desc limit 8"),
    query(
      `select date_trunc('day', created_at)::date as day,
              coalesce(sum(total), 0) as revenue, count(*)::int as orders
         from orders
        where created_at > now() - interval '14 days' and status <> 'canceled'
        group by 1 order by 1`
    ),
  ])
  res.json({
    orders_30d: orders30.rows[0].count,
    revenue_30d: money(revenue30.rows[0].sum),
    customers: customers.rows[0].count,
    awaiting_payment: awaiting.rows[0].count,
    low_stock: lowStock.rows,
    recent_orders: recentOrders.rows.map((order) => orderToJson(order)),
    revenue_by_day: byDay.rows.map((row) => ({
      day: row.day,
      revenue: money(row.revenue),
      orders: row.orders,
    })),
  })
}

module.exports = { stats }
