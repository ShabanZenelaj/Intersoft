import { MapPin, Package, ShoppingBag, Truck, Wallet } from "lucide-react"
import Link from "next/link"
import { Card, EmptyState, PageHeader, StatTile } from "@/components/account/ui"
import { StatusBadge } from "@/components/order/order-timeline"
import { buttonVariants } from "@/components/ui/button"
import { getCustomer, getOrderSummary, listOrders } from "@/lib/data/customer"
import { getI18n } from "@/lib/i18n"
import { cn, formatDate, formatPrice, itemCount } from "@/lib/utils"

export const metadata = { title: "My Account" }

const AccountPage = async () => {
  const { locale, dict } = await getI18n()
  const [customer, summary, { orders }] = await Promise.all([
    getCustomer(),
    getOrderSummary(),
    listOrders({ limit: 1 }),
  ])

  const latest = orders[0]
  const address = customer.default_address || {}
  const hasAddress = Boolean(address.address_1 && address.city)

  return (
    <>
      <PageHeader title={`${dict.account.welcome}, ${customer.first_name}`} />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile icon={Package} label={dict.account.stat_orders} value={summary.orders_count} href="/account/orders" />
        <StatTile
          icon={Truck}
          label={dict.account.stat_active}
          value={summary.active_count}
          href={summary.active_count ? "/account/orders?status=active" : undefined}
        />
        <StatTile icon={Wallet} label={dict.account.stat_spent} value={formatPrice(summary.total_spent, locale)} />
      </div>

      <div className="mt-6 space-y-6">
        <Card
          title={dict.account.latest_order}
          footer={
            latest && (
              <Link href="/account/orders" className="text-sm font-medium underline underline-offset-4 hover:no-underline">
                {dict.account.all_orders}
              </Link>
            )
          }
        >
          {latest ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <p className="font-semibold">
                    {dict.order.order_number} #{latest.display_id}
                  </p>
                  <StatusBadge status={latest.status} dict={dict} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(latest.created_at, locale)} · {itemCount((latest.items || []).length, dict)} ·{" "}
                  {formatPrice(latest.total, locale)}
                </p>
              </div>
              <Link href={`/account/orders/${latest.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                {dict.account.view}
              </Link>
            </div>
          ) : (
            <EmptyState
              icon={ShoppingBag}
              title={dict.account.no_orders}
              hint={dict.account.no_orders_hint}
              actionLabel={dict.account.keep_shopping}
              actionHref="/search"
            />
          )}
        </Card>

        <Card
          title={dict.account.saved_address}
          description={dict.account.saved_address_hint}
          footer={
            <Link
              href="/account/profile"
              className="text-sm font-medium underline underline-offset-4 hover:no-underline"
            >
              {hasAddress ? dict.account.edit_address : dict.account.add_address}
            </Link>
          }
        >
          {hasAddress ? (
            <div className="flex items-start gap-3 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {address.first_name} {address.last_name}
                </span>
                <br />
                {address.address_1}, {address.city} {address.postal_code}
                <br />
                {String(address.country_code || "").toUpperCase()}
                {address.phone ? ` · ${address.phone}` : ""}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{dict.account.no_address}</p>
          )}
        </Card>

        <div className="flex flex-wrap gap-2">
          <Link href="/search" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <ShoppingBag className="size-4" />
            {dict.account.keep_shopping}
          </Link>
          <Link href="/account/orders" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <Package className="size-4" />
            {dict.account.all_orders}
          </Link>
        </div>
      </div>
    </>
  )
}

export default AccountPage
