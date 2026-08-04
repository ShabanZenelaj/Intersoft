const { query, tx } = require("../../db")
const { check, isUuid, money } = require("../../lib/util")
const { logError } = require("../../lib/error-log")
const { orderToJson } = require("../../lib/serialize")
const { getCart, cartContext } = require("../../services/cart")
const campaignService = require("../../services/campaigns")
const { getCustomerGroupIds } = require("../../lib/pricing")
const payments = require("../../services/payments")
const raiaccept = require("../../services/raiaccept")
const mail = require("../../services/mail")

/** Loads a cart that can still be modified, 404-ing on unknown/completed ones. */
const loadOpenCart = async (cartId) => {
  check(isUuid(cartId), "Invalid cart id.")
  const cart = await getCart(cartId)
  if (!cart || cart.status !== "open") {
    const error = new Error("Cart not found")
    error.status = 404
    throw error
  }
  return cart
}

const create = async (req, res) => {
  const { rows } = await query("insert into carts (customer_id, email) values ($1, $2) returning id", [
    req.customer?.id || null,
    req.customer?.email || null,
  ])
  res.status(201).json({ cart: await getCart(rows[0].id) })
}

const get = async (req, res) => {
  res.json({ cart: await loadOpenCart(req.params.id) })
}

const addItem = async (req, res) => {
  const cart = await loadOpenCart(req.params.id)
  const { variant_id, quantity: qty } = req.body

  const { rows: variants } = await query("select * from variants where id = $1", [variant_id])
  check(variants.length, "Variant not found.")
  const variant = variants[0]

  const existing = cart.items.find((item) => item.variant_id === variant_id)
  const newQty = (existing?.quantity || 0) + qty
  if (variant.manage_stock && newQty > variant.stock) {
    return res.status(400).json({ message: "Not enough stock available." })
  }

  await query(
    `insert into cart_items (cart_id, variant_id, quantity) values ($1, $2, $3)
     on conflict (cart_id, variant_id) do update set quantity = cart_items.quantity + $3`,
    [cart.id, variant_id, qty]
  )
  await query("update carts set updated_at = now() where id = $1", [cart.id])
  res.json({ cart: await getCart(cart.id) })
}

const updateItem = async (req, res) => {
  const cart = await loadOpenCart(req.params.id)
  const qty = req.body.quantity

  const item = cart.items.find((entry) => entry.id === req.params.itemId)
  check(item, "Item not found.")
  if (item.stock !== null && qty > item.stock) {
    return res.status(400).json({ message: "Not enough stock available." })
  }

  await query("update cart_items set quantity = $1 where id = $2 and cart_id = $3", [qty, item.id, cart.id])
  res.json({ cart: await getCart(cart.id) })
}

const removeItem = async (req, res) => {
  const cart = await loadOpenCart(req.params.id)
  await query("delete from cart_items where id = $1 and cart_id = $2", [req.params.itemId, cart.id])
  res.json({ cart: await getCart(cart.id) })
}

const applyPromotion = async (req, res) => {
  const cart = await loadOpenCart(req.params.id)
  const { code } = req.body

  const groupIds = await getCustomerGroupIds(cart.customer_id)
  const result = await campaignService.checkCode(code, cartContext(cart), {
    groupIds,
    shippingTotal: cart.shipping_total,
  })
  if (result.error) {
    // reason is a key the storefront translates (invalid_code, expired,
    // min_subtotal, min_quantity, not_eligible, already_used, ...).
    return res.status(400).json({ message: result.error, min: result.min, cart })
  }

  await query("update carts set promo_code = $1, updated_at = now() where id = $2", [result.campaign.code, cart.id])
  res.json({ cart: await getCart(cart.id) })
}

const removePromotion = async (req, res) => {
  await loadOpenCart(req.params.id)
  await query("update carts set promo_code = null, updated_at = now() where id = $1", [req.params.id])
  res.json({ cart: await getCart(req.params.id) })
}

const setDetails = async (req, res) => {
  const cart = await loadOpenCart(req.params.id)
  const { email, address, locale } = req.body
  // Shape and lengths are already enforced by the schema; this just fills the
  // blanks the form may have left out so the stored address is uniform.
  const clean = {
    first_name: address.first_name,
    last_name: address.last_name,
    address_1: address.address_1,
    city: address.city,
    postal_code: address.postal_code || "",
    country_code: String(address.country_code || "al").toLowerCase(),
    phone: address.phone || "",
  }
  await query(
    `update carts set email = $1, shipping_address = $2, customer_id = coalesce(customer_id, $3),
            locale = $4, updated_at = now() where id = $5`,
    [email, JSON.stringify(clean), req.customer?.id || null, locale === "en" ? "en" : "sq", cart.id]
  )

  // Logged-in shoppers get the address remembered for next time.
  if (req.customer) {
    await query("update customers set default_address = $1 where id = $2", [JSON.stringify(clean), req.customer.id])
  }
  res.json({ cart: await getCart(cart.id) })
}

const setPayment = async (req, res) => {
  const cart = await loadOpenCart(req.params.id)
  const method = String(req.body?.method || "")
  const paymentData = await payments.initiate(method, cart)
  await query("update carts set payment_method = $1, updated_at = now() where id = $2", [method, cart.id])
  res.json({ cart: await getCart(cart.id), payment_data: paymentData })
}

/**
 * Opens a RaiAccept payment window for an order that has just been placed.
 *
 * The reference must be unique per *attempt*, not per order — a shopper whose
 * card is declined comes back and tries again, and RaiAccept rejects a repeated
 * merchantOrderReference as a duplicate (code 1007).
 *
 * Signed-in shoppers are identified to RaiAccept by `customerReference`, which
 * is what makes one-click checkout work: the payment window offers to store
 * the card, and shows it again next time.
 */
const startCardPayment = async (order, req) => {
  const reference = `${order.display_id}-${Date.now().toString(36)}`
  const shopUrl = (process.env.STORE_ORIGIN || "http://localhost:3000").split(",")[0].replace(/\/$/, "")
  const publicApi = (process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 9000}`).replace(/\/$/, "")

  const checkout = await raiaccept.createCheckout({
    order: { ...order, ip_address: req.ip },
    reference,
    customerReference: order.customer_id || null,
    urls: {
      successUrl: `${shopUrl}/order/paid/${order.id}`,
      failUrl: `${shopUrl}/order/failed/${order.id}`,
      cancelUrl: `${shopUrl}/order/canceled/${order.id}`,
      notificationUrl: `${publicApi}/api/store/payments/raiaccept/webhook`,
    },
  })

  await query(
    `update orders set payment_reference = $1, raiaccept_order_id = $2,
            payment_data = coalesce(payment_data, '{}'::jsonb) || $3::jsonb, updated_at = now()
      where id = $4`,
    [
      reference,
      checkout.orderIdentification,
      JSON.stringify({
        raiaccept_order_id: checkout.orderIdentification,
        raiaccept_session_id: checkout.sessionId,
        is_production: checkout.isProduction,
      }),
      order.id,
    ]
  )
  return checkout
}

/**
 * Undoes a placed order whose payment session could never be created.
 *
 * The order is committed before RaiAccept is called — it has to be, because
 * their merchantOrderReference is built from the display_id. So when their API
 * rejects the payload or is unreachable, an order exists that the shopper has no
 * way to pay for and no webhook will ever settle: `markFailed` only runs from
 * the notification, and there is no notification for an order they never
 * created. Left alone it holds stock forever.
 *
 * Three pieces of state have to come back, or the retry is worse than the
 * failure: stock, the campaign redemption (a `usage_limit: 1` code would
 * otherwise be spent on the attempt that failed), and the cart itself.
 */
const unwindUnpaidOrder = async (order, cartId) => {
  await tx(async (client) => {
    // Guard on the current status so this cannot double-restock if it is ever
    // reached twice for the same order.
    const { rows } = await client.query(
      "update orders set status = 'canceled', updated_at = now() where id = $1 and status = 'pending' returning id",
      [order.id]
    )
    if (!rows.length) return

    for (const item of order.items || []) {
      await client.query("update variants set stock = stock + $1 where id = $2 and manage_stock", [
        item.quantity,
        item.variant_id,
      ])
    }

    // Release the redemptions this attempt recorded, and give back the usage.
    const { rows: released } = await client.query(
      "delete from campaign_redemptions where order_id = $1 returning campaign_id",
      [order.id]
    )
    for (const row of released) {
      await client.query(
        "update campaigns set used_count = greatest(used_count - 1, 0) where id = $1",
        [row.campaign_id]
      )
    }

    await client.query("update carts set status = 'open', updated_at = now() where id = $1", [cartId])
    await client.query("insert into order_events (order_id, type, data) values ($1, 'status_changed', $2)", [
      order.id,
      JSON.stringify({ from: "pending", to: "canceled", reason: "payment_session_failed", restocked: true }),
    ])
  })
}

const complete = async (req, res) => {
  const cart = await loadOpenCart(req.params.id)
  check(cart.items.length, "The cart is empty.")
  check(cart.email && cart.shipping_address, "Contact details are missing.")
  check(cart.payment_method, "Select a payment method.")

  const paymentData = await payments.authorize(cart.payment_method, {})

  const order = await tx(async (client) => {
    // Re-check and decrement stock atomically.
    for (const item of cart.items) {
      const { rows } = await client.query(
        "update variants set stock = stock - $1 where id = $2 and (not manage_stock or stock >= $1) returning id",
        [item.quantity, item.variant_id]
      )
      if (!rows.length) {
        const error = new Error(`"${item.product_title}" no longer has enough stock.`)
        error.status = 400
        throw error
      }
    }

    const orderItems = cart.items.map((item) => ({
      variant_id: item.variant_id,
      product_id: item.product_id,
      product_title: item.product_title,
      product_handle: item.product_handle,
      variant_title: item.variant_title,
      title: item.product_title,
      sku: item.sku,
      thumbnail: item.thumbnail,
      unit_price: item.unit_price,
      quantity: item.quantity,
      total: item.total,
    }))

    const shipments = cart.shipping_methods.map((shipment) => ({
      name: shipment.name,
      name_sq: shipment.name_sq,
      price: shipment.amount,
      products: shipment.products,
    }))
    // A guest who already has an account (same email) gets the order linked.
    let customerId = cart.customer_id || req.customer?.id || null
    if (!customerId) {
      const { rows: existing } = await client.query("select id from customers where lower(email) = lower($1)", [
        cart.email,
      ])
      customerId = existing[0]?.id || null
    }

    const { rows: orderRows } = await client.query(
      `insert into orders (customer_id, email, payment_method, payment_data, shipping_address,
                           shipping_method, items, subtotal, discount_total, discounts, promo_code,
                           shipping_total, total, locale)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       returning *`,
      [
        customerId,
        cart.email,
        cart.payment_method,
        JSON.stringify(paymentData),
        JSON.stringify(cart.shipping_address),
        JSON.stringify(shipments),
        JSON.stringify(orderItems),
        cart.item_total,
        cart.discount_total,
        JSON.stringify(cart.discounts || []),
        cart.promo_code || null,
        money(cart.shipping_total - (cart.shipping_discount || 0)),
        cart.total,
        cart.locale || "sq",
      ]
    )

    await campaignService.recordRedemptions(client, {
      discounts: cart.discounts || [],
      orderId: orderRows[0].id,
      customerId,
      email: cart.email,
    })
    await client.query("update carts set status = 'completed', updated_at = now() where id = $1", [cart.id])
    await client.query("insert into order_events (order_id, type, data) values ($1, 'placed', $2)", [
      orderRows[0].id,
      JSON.stringify({ payment_method: cart.payment_method }),
    ])
    return orderRows[0]
  })

  // A card order is not finished yet: the shopper still has to pay at
  // RaiAccept. Hand back the payment window instead of a confirmation, and
  // hold the email until the webhook says the money actually moved.
  if (payments.isRedirectMethod(order.payment_method)) {
    let checkout
    try {
      checkout = await startCardPayment(order, req)
    } catch (error) {
      // Put everything back before answering, so the shopper can simply try
      // again — with their cart, their stock and their promo code intact.
      await unwindUnpaidOrder(order, cart.id)

      // Answered here rather than rethrown. The central handler replaces every
      // 5xx body with "Internal server error", which would hide the one thing
      // worth telling the shopper — that their cart survived. It also records
      // only message and stack, so wrapping this in a friendlier error would
      // discard the RaiAccept detail saying *why* the session failed. Log the
      // original, answer with the useful one.
      console.error(error)
      logError({ kind: "server_error", error, req, status: 502 })
      return res.status(502).json({
        message: "We could not open the payment window. Your cart is unchanged — please try again.",
      })
    }
    return res.json({
      type: "payment_required",
      order: orderToJson(order),
      payment_url: checkout.paymentUrl,
    })
  }

  mail.sendOrderConfirmation(order)
  res.json({ type: "order", order: orderToJson(order) })
}

/** Attaches a guest cart to the logged-in customer (called after login). */
const attachCustomer = async (req, res) => {
  const cart = await loadOpenCart(req.params.id)
  await query("update carts set customer_id = $1, email = coalesce(email, $2), updated_at = now() where id = $3", [
    req.customer.id,
    req.customer.email,
    cart.id,
  ])
  res.json({ cart: await getCart(cart.id) })
}

module.exports = {
  create,
  get,
  addItem,
  updateItem,
  removeItem,
  applyPromotion,
  removePromotion,
  setDetails,
  setPayment,
  complete,
  attachCustomer,
}
