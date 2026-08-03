import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircle2, Mail } from "lucide-react"
import { Suspense } from "react"
import { RegisterForm } from "@/components/auth/auth-forms"
import { OrderSummaryCard } from "@/components/order/order-summary-card"
import { buttonVariants } from "@/components/ui/button"
import { getCustomer, getOrder } from "@/lib/data/customer"
import { getI18n } from "@/lib/i18n"

export const metadata = { title: "Order Confirmed" }

const OrderConfirmedPage = async (props) => {
  const params = await props.params
  const { locale, dict } = await getI18n()
  const [order, customer] = await Promise.all([getOrder(params.id), getCustomer()])
  if (!order) return notFound()

  const address = order.shipping_address || {}
  const isGuest = !customer && !order.customer_id

  return (
    <div className="mx-auto max-w-container-sm px-4 py-12 md:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="size-14 text-green-600" />
          <h1 className="text-3xl font-bold tracking-tight">{dict.order.confirmed_title}</h1>
          {order.email && (
            <p className="text-muted-foreground">
              {dict.order.confirmed_subtitle} <span className="font-medium text-foreground">{order.email}</span>
            </p>
          )}
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="size-4" />
            {dict.order.email_sent}
          </p>
        </div>

        <div className="mt-10">
          <OrderSummaryCard order={order} dict={dict} locale={locale} />
        </div>

        {isGuest && (
          <div className="mt-8 rounded-lg border bg-secondary/20 p-6">
            <h2 className="text-lg font-semibold">{dict.order.create_account_title}</h2>
            <p className="mb-5 mt-1 text-sm text-muted-foreground">{dict.order.create_account_text}</p>
            <Suspense>
              <RegisterForm
                compact
                claimOrderId={order.id}
                defaultEmail={order.email}
                defaultFirstName={address.first_name}
                defaultLastName={address.last_name}
                next="/account/orders"
              />
            </Suspense>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">{dict.order.support_note}</p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            {dict.order.back_home}
          </Link>
          <Link href={customer ? "/account/orders" : "/track"} className={buttonVariants()}>
            {customer ? dict.order.view_orders : dict.order.track_title}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default OrderConfirmedPage
