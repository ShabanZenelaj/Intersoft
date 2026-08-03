const fs = require("fs")
const path = require("path")
const nodemailer = require("nodemailer")
const { money } = require("../lib/util")

/**
 * Transactional email. Configure SMTP_* in .env to send for real; without it
 * every message is written to server/tmp/mail as .html so a single developer
 * can see exactly what customers would receive.
 */

const MAIL_DIR = path.join(__dirname, "..", "..", "tmp", "mail")
const FROM = process.env.MAIL_FROM || "Intersoft <no-reply@intersoft.al>"
const STORE_URL = (process.env.STORE_ORIGIN || "http://localhost:3000").split(",")[0]

const smtpConfigured = () => Boolean(process.env.SMTP_HOST)

let transporter = null
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  }
  return transporter
}

// ------------------------------------------------------------------ i18n

const T = {
  sq: {
    hello: "Përshëndetje",
    order_confirmed_subject: (id) => `Porosia #${id} u konfirmua — Intersoft`,
    order_confirmed_title: "Faleminderit për porosinë!",
    order_confirmed_intro: "E morëm porosinë tënde dhe po e përgatisim. Më poshtë i ke detajet.",
    paid_subject: (id) => `Pagesa u konfirmua për porosinë #${id}`,
    paid_title: "Pagesa u konfirmua",
    paid_intro: "Pagesa jote u konfirmua me sukses — faleminderit!",
    processing_subject: (id) => `Porosia #${id} është në përgatitje`,
    processing_title: "Porosia jote është në përgatitje",
    processing_intro: "Po e përgatisim porosinë tënde për dërgesë.",
    shipped_subject: (id) => `Porosia #${id} u nis për dërgesë`,
    shipped_title: "Nisëm porosinë tënde!",
    shipped_intro: "Porosia jote është rrugës dhe vjen shpejt.",
    delivered_subject: (id) => `Porosia #${id} u dorëzua`,
    delivered_title: "Mbërriti porosia jote!",
    delivered_intro: "Shpresojmë të jesh i kënaqur me blerjen. Faleminderit që zgjodhe Intersoft!",
    canceled_subject: (id) => `Porosia #${id} u anulua`,
    canceled_title: "Porosia jote u anulua",
    canceled_intro: "Porosia jote u anulua. Nëse s'e ke kërkuar ti këtë, na kontakto menjëherë.",
    refunded_subject: (id) => `Rimbursim për porosinë #${id}`,
    refunded_title: "Rimbursimi u krye",
    refunded_intro: (amount) => `Kemi rimbursuar ${amount} për porosinë tënde.`,
    welcome_subject: "Mirë se na erdhe në Intersoft!",
    welcome_title: "Llogaria jote është gati!",
    welcome_intro:
      "Tash mund t'i ndjekësh porositë e tua, ta ruash adresën dhe të paguash më shpejt herës tjetër.",
    reset_subject: "Rivendos fjalëkalimin — Intersoft",
    reset_title: "Rivendosje e fjalëkalimit",
    reset_intro:
      "Kemi marrë një kërkesë për të rivendosur fjalëkalimin tënd. Kliko butonin këtu poshtë — lidhja skadon pas 1 ore.",
    reset_cta: "Rivendos fjalëkalimin",
    reset_ignore: "Nëse s'e ke kërkuar ti, thjesht injoroje këtë email.",
    order: "Porosia",
    placed_on: "Porositur më",
    product: "Produkti",
    qty: "Sasia",
    total: "Totali",
    subtotal: "Nëntotali",
    discount: "Zbritja",
    shipping: "Dërgesa",
    delivery_address: "Adresa e dërgesës",
    payment_method: "Mënyra e pagesës",
    view_order: "Shiko porosinë",
    shop: "Vazhdo blerjet",
    help: "Për çdo pyetje na shkruaj te",
    payment: { cod: "Para në dorë në dorëzim", pos: "Terminal POS në dorëzim", card: "Kartë online" },
  },
  en: {
    hello: "Hello",
    order_confirmed_subject: (id) => `Order #${id} confirmed — Intersoft`,
    order_confirmed_title: "Thank you for your order!",
    order_confirmed_intro: "We received your order and are preparing it. Here are the details.",
    paid_subject: (id) => `Payment confirmed for order #${id}`,
    paid_title: "Payment confirmed",
    paid_intro: "We can confirm the payment for your order has been recorded.",
    processing_subject: (id) => `Order #${id} is being prepared`,
    processing_title: "Your order is being prepared",
    processing_intro: "We are getting your order ready for delivery.",
    shipped_subject: (id) => `Order #${id} is on its way`,
    shipped_title: "Your order has shipped",
    shipped_intro: "Your order is on its way and will arrive shortly.",
    delivered_subject: (id) => `Order #${id} was delivered`,
    delivered_title: "Your order was delivered",
    delivered_intro: "We hope you enjoy your purchase. Thank you for choosing Intersoft!",
    canceled_subject: (id) => `Order #${id} was canceled`,
    canceled_title: "Your order was canceled",
    canceled_intro: "Your order has been canceled. If you did not request this, please contact us right away.",
    refunded_subject: (id) => `Refund for order #${id}`,
    refunded_title: "Refund processed",
    refunded_intro: (amount) => `We processed a refund of ${amount} for your order.`,
    welcome_subject: "Welcome to Intersoft",
    welcome_title: "Your account is ready",
    welcome_intro: "You can now track your orders, save your address and check out faster next time.",
    reset_subject: "Reset your password — Intersoft",
    reset_title: "Password reset",
    reset_intro:
      "We received a request to reset your password. Use the button below — the link expires in 1 hour.",
    reset_cta: "Reset password",
    reset_ignore: "If you did not request this, you can safely ignore this email.",
    order: "Order",
    placed_on: "Placed on",
    product: "Product",
    qty: "Qty",
    total: "Total",
    subtotal: "Subtotal",
    discount: "Discount",
    shipping: "Shipping",
    delivery_address: "Delivery address",
    payment_method: "Payment method",
    view_order: "View order",
    shop: "Continue shopping",
    help: "Questions? Write to us at",
    payment: { cod: "Cash on delivery", pos: "POS terminal on delivery", card: "Card online" },
  },
}

const dict = (locale) => T[locale === "en" ? "en" : "sq"]

const eur = (amount, locale) => {
  const [int, dec] = Number(amount || 0).toFixed(2).split(".")
  return locale === "en"
    ? `€${int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${dec}`
    : `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec} €`
}

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]))

// ------------------------------------------------------------------ templates

const layout = ({ title, intro, body = "", cta, locale }) => {
  const t = dict(locale)
  return `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
    <div style="padding:20px 28px;border-bottom:1px solid #e2e8f0">
      <span style="font-size:19px;font-weight:700;letter-spacing:-0.01em">Intersoft</span>
    </div>
    <div style="padding:28px">
      <h1 style="margin:0 0 12px;font-size:21px">${escapeHtml(title)}</h1>
      <p style="margin:0 0 20px;color:#475569;line-height:1.55">${escapeHtml(intro)}</p>
      ${body}
      ${
        cta
          ? `<p style="margin:26px 0 0"><a href="${cta.href}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:11px 22px;border-radius:6px;font-weight:600">${escapeHtml(cta.label)}</a></p>`
          : ""
      }
    </div>
    <div style="padding:18px 28px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12.5px;line-height:1.6">
      ${escapeHtml(t.help)} <a href="mailto:support@intersoft.al" style="color:#4f46e5">support@intersoft.al</a><br />
      © ${new Date().getFullYear()} Intersoft
    </div>
  </div>
</body></html>`
}

const orderTable = (order, locale) => {
  const t = dict(locale)
  const address = order.shipping_address || {}
  const shipments = Array.isArray(order.shipping_method) ? order.shipping_method : []
  const rows = (order.items || [])
    .map(
      (item) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9">${escapeHtml(item.product_title)}
          ${item.variant_title && item.variant_title !== "Default" ? `<span style="color:#64748b"> · ${escapeHtml(item.variant_title)}</span>` : ""}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:center;color:#64748b">${item.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap">${eur(item.total, locale)}</td>
      </tr>`
    )
    .join("")

  const totalRow = (label, value, bold = false) =>
    `<tr><td colspan="2" style="padding:4px 0;color:#64748b${bold ? ";font-weight:700;color:#0f172a" : ""}">${escapeHtml(label)}</td>
      <td style="padding:4px 0;text-align:right;white-space:nowrap${bold ? ";font-weight:700;font-size:16px" : ""}">${value}</td></tr>`

  return `
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:18px">
      <div style="display:block;margin-bottom:12px">
        <strong>${escapeHtml(t.order)} #${order.display_id}</strong>
        <span style="color:#64748b"> · ${escapeHtml(t.placed_on)} ${new Date(order.created_at).toLocaleDateString(locale === "en" ? "en-GB" : "sq-AL")}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr>
          <th align="left" style="padding-bottom:6px;color:#64748b;font-weight:500;font-size:12px;text-transform:uppercase">${escapeHtml(t.product)}</th>
          <th align="center" style="padding-bottom:6px;color:#64748b;font-weight:500;font-size:12px;text-transform:uppercase">${escapeHtml(t.qty)}</th>
          <th align="right" style="padding-bottom:6px;color:#64748b;font-weight:500;font-size:12px;text-transform:uppercase">${escapeHtml(t.total)}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          ${totalRow(t.subtotal, eur(order.subtotal, locale))}
          ${Number(order.discount_total) > 0 ? totalRow(t.discount, `−${eur(order.discount_total, locale)}`) : ""}
          ${shipments
            .map((shipment) =>
              totalRow(
                `${t.shipping} · ${locale === "en" ? shipment.name : shipment.name_sq || shipment.name}`,
                eur(shipment.price, locale)
              )
            )
            .join("")}
          ${totalRow(t.total, eur(order.total, locale), true)}
        </tfoot>
      </table>
    </div>
    <p style="margin:18px 0 0;font-size:13.5px;color:#475569;line-height:1.6">
      <strong style="color:#0f172a">${escapeHtml(t.delivery_address)}</strong><br />
      ${escapeHtml(`${address.first_name || ""} ${address.last_name || ""}`)}<br />
      ${escapeHtml(address.address_1 || "")}, ${escapeHtml(address.city || "")} ${escapeHtml(address.postal_code || "")}<br />
      ${escapeHtml(String(address.country_code || "").toUpperCase())}${address.phone ? ` · ${escapeHtml(address.phone)}` : ""}
    </p>
    <p style="margin:10px 0 0;font-size:13.5px;color:#475569">
      <strong style="color:#0f172a">${escapeHtml(t.payment_method)}:</strong>
      ${escapeHtml(dict(locale).payment[order.payment_method] || order.payment_method)}
    </p>`
}

// ------------------------------------------------------------------ sending

const send = async ({ to, subject, html }) => {
  if (!to) return
  try {
    if (smtpConfigured()) {
      await getTransporter().sendMail({ from: FROM, to, subject, html })
      return
    }
    // Dev fallback: keep a readable copy so nothing is silently lost.
    fs.mkdirSync(MAIL_DIR, { recursive: true })
    const name = `${new Date().toISOString().replace(/[:.]/g, "-")}-${to.replace(/[^\w@.-]/g, "_")}.html`
    fs.writeFileSync(path.join(MAIL_DIR, name), `<!-- To: ${to}\n     Subject: ${subject} -->\n${html}`)
    console.log(`[mail] ${subject} → ${to} (saved to tmp/mail/${name}; set SMTP_HOST to send for real)`)
  } catch (error) {
    // Never let a mail failure break a customer's order.
    console.error(`[mail] failed to send "${subject}" to ${to}: ${error.message}`)
  }
}

const orderUrl = (order) => `${STORE_URL}/order/confirmed/${order.id}`

const sendOrderConfirmation = (order) => {
  const locale = order.locale || "sq"
  const t = dict(locale)
  return send({
    to: order.email,
    subject: t.order_confirmed_subject(order.display_id),
    html: layout({
      locale,
      title: t.order_confirmed_title,
      intro: t.order_confirmed_intro,
      body: orderTable(order, locale),
      cta: { href: orderUrl(order), label: t.view_order },
    }),
  })
}

/** status: processing | shipped | delivered | canceled */
const sendOrderStatus = (order, status) => {
  const locale = order.locale || "sq"
  const t = dict(locale)
  const map = {
    processing: [t.processing_subject, t.processing_title, t.processing_intro],
    shipped: [t.shipped_subject, t.shipped_title, t.shipped_intro],
    delivered: [t.delivered_subject, t.delivered_title, t.delivered_intro],
    canceled: [t.canceled_subject, t.canceled_title, t.canceled_intro],
  }
  const entry = map[status]
  if (!entry) return Promise.resolve()
  const [subject, title, intro] = entry
  return send({
    to: order.email,
    subject: subject(order.display_id),
    html: layout({
      locale,
      title,
      intro,
      body: orderTable(order, locale),
      cta: { href: orderUrl(order), label: t.view_order },
    }),
  })
}

const sendPaymentCaptured = (order) => {
  const locale = order.locale || "sq"
  const t = dict(locale)
  return send({
    to: order.email,
    subject: t.paid_subject(order.display_id),
    html: layout({
      locale,
      title: t.paid_title,
      intro: t.paid_intro,
      body: orderTable(order, locale),
      cta: { href: orderUrl(order), label: t.view_order },
    }),
  })
}

const sendRefund = (order, amount) => {
  const locale = order.locale || "sq"
  const t = dict(locale)
  return send({
    to: order.email,
    subject: t.refunded_subject(order.display_id),
    html: layout({
      locale,
      title: t.refunded_title,
      intro: t.refunded_intro(eur(money(amount), locale)),
      body: orderTable(order, locale),
      cta: { href: orderUrl(order), label: t.view_order },
    }),
  })
}

const sendWelcome = (customer, locale = "sq") => {
  const t = dict(locale)
  return send({
    to: customer.email,
    subject: t.welcome_subject,
    html: layout({
      locale,
      title: t.welcome_title,
      intro: `${t.hello} ${customer.first_name}, ${t.welcome_intro}`,
      cta: { href: `${STORE_URL}/account`, label: t.view_order },
    }),
  })
}

const sendPasswordReset = (customer, token, locale = "sq") => {
  const t = dict(locale)
  return send({
    to: customer.email,
    subject: t.reset_subject,
    html: layout({
      locale,
      title: t.reset_title,
      intro: t.reset_intro,
      body: `<p style="margin:0;color:#64748b;font-size:13px">${escapeHtml(t.reset_ignore)}</p>`,
      cta: { href: `${STORE_URL}/reset-password?token=${encodeURIComponent(token)}`, label: t.reset_cta },
    }),
  })
}

module.exports = {
  smtpConfigured,
  sendOrderConfirmation,
  sendOrderStatus,
  sendPaymentCaptured,
  sendRefund,
  sendWelcome,
  sendPasswordReset,
}
