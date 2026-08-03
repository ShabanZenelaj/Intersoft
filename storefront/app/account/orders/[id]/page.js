import { ArrowLeft, LifeBuoy } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { OrderSummaryCard } from "@/components/order/order-summary-card"
import { StatusBadge } from "@/components/order/order-timeline"
import { ReorderButton } from "@/components/order/reorder-button"
import { getCustomer, getOrder } from "@/lib/data/customer"
import { getI18n } from "@/lib/i18n"
import { formatDate } from "@/lib/utils"

export const metadata = { title: "Order Details" }

const OrderDetailPage = async (props) => {
  const params = await props.params
  const { locale, dict } = await getI18n()
  const [order, customer] = await Promise.all([getOrder(params.id), getCustomer()])

  // Only the owner may open an order from the account area.
  if (!order || (order.customer_id && customer && order.customer_id !== customer.id)) return notFound()

  return (
    <>
      <Link
        href="/account/orders"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {dict.account.orders}
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">
              {dict.order.order_number} #{order.display_id}
            </h1>
            <StatusBadge status={order.status} dict={dict} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {dict.order.placed_on} {formatDate(order.created_at, locale)}
          </p>
        </div>
        <ReorderButton orderId={order.id} />
      </div>

      <OrderSummaryCard order={order} dict={dict} locale={locale} showHeader={false} />

      <p className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-dashed px-5 py-4 text-sm text-muted-foreground">
        <LifeBuoy className="size-4 shrink-0" />
        {dict.order.support_note}
      </p>
    </>
  )
}

export default OrderDetailPage
