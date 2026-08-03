import Image from "next/image"
import { OrderTimeline, StatusBadge } from "./order-timeline"
import { formatDate, formatPrice, shipmentName } from "@/lib/utils"

/**
 * Full order view shared by the confirmation page, account and tracking page.
 * `showHeader` is off where the page already titles itself with the order.
 */
export const OrderSummaryCard = ({ order, dict, locale, showTimeline = true, showHeader = true }) => {
  const address = order.shipping_address || {}

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6">
        {showHeader && (
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b pb-4">
            <h2 className="text-lg font-semibold">
              {dict.order.order_number} #{order.display_id}
            </h2>
            <div className="flex items-center gap-3">
              <StatusBadge status={order.status} dict={dict} />
              <span className="text-sm text-muted-foreground">
                {dict.order.placed_on} {formatDate(order.created_at, locale)}
              </span>
            </div>
          </div>
        )}

        <div className="divide-y">
          {(order.items || []).map((item) => (
            <div key={item.id} className="flex items-center gap-4 py-4">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-secondary/30">
                {item.thumbnail && <Image src={item.thumbnail} alt="" fill sizes="64px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 font-medium">{item.product_title || item.title}</p>
                <p className="text-sm text-muted-foreground">× {item.quantity}</p>
              </div>
              <span className="font-medium">{formatPrice(item.total, locale)}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{dict.cart.subtotal}</span>
            <span>{formatPrice(order.item_total ?? order.subtotal, locale)}</span>
          </div>
          {(order.discounts || []).length > 0
            ? order.discounts.map((discount, index) => (
                <div key={index} className="flex justify-between text-green-700">
                  <span>{discount.is_shipping ? dict.cart.free_shipping : discount.name}</span>
                  <span>−{formatPrice(discount.amount, locale)}</span>
                </div>
              ))
            : order.discount_total > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>
                    {dict.cart.discount} {order.promo_code ? `(${order.promo_code})` : ""}
                  </span>
                  <span>−{formatPrice(order.discount_total, locale)}</span>
                </div>
              )}
          {(order.shipping_methods || []).map((shipment, index) => (
            <div key={index} className="flex justify-between">
              <span className="text-muted-foreground">
                {dict.cart.shipping} · {shipmentName(shipment, locale)}
              </span>
              <span>{formatPrice(shipment.amount, locale)}</span>
            </div>
          ))}
          {order.refunded_total > 0 && (
            <div className="flex justify-between text-red-600">
              <span>{dict.order.event_refunded}</span>
              <span>−{formatPrice(order.refunded_total, locale)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-3 text-base font-semibold">
            <span>{dict.cart.total}</span>
            <span>{formatPrice(order.total, locale)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-6 text-sm">
          <h3 className="mb-2 font-semibold">{dict.checkout.step_details}</h3>
          <p className="text-muted-foreground">
            {address.first_name} {address.last_name}
            <br />
            {address.address_1}, {address.city} {address.postal_code}
            <br />
            {String(address.country_code || "").toUpperCase()}
            {address.phone ? ` · ${address.phone}` : ""}
          </p>
          <p className="mt-3 text-muted-foreground">
            <span className="font-medium text-foreground">{dict.checkout.step_payment}:</span>{" "}
            {dict.checkout[`payment_${order.payment_method === "card" ? "card" : order.payment_method}`]}
          </p>
        </div>

        {(order.shipping_methods || []).length > 0 && (
          <div className="rounded-xl border bg-white p-6 text-sm">
            <h3 className="mb-2 font-semibold">{dict.order.shipments}</h3>
            <ul className="space-y-2 text-muted-foreground">
              {order.shipping_methods.map((shipment, index) => (
                <li key={index}>
                  <span className="font-medium text-foreground">{shipmentName(shipment, locale)}</span>
                  {!!shipment.products?.length && <> — {shipment.products.join(", ")}</>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {showTimeline && !!order.events?.length && (
        <div className="rounded-xl border bg-white p-6">
          <h3 className="mb-4 font-semibold">{dict.order.timeline}</h3>
          <OrderTimeline events={order.events} dict={dict} locale={locale} />
        </div>
      )}
    </div>
  )
}
