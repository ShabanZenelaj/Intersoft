import { ChevronRight, Package, ShoppingBag } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { EmptyState, PageHeader } from "@/components/account/ui"
import { StatusBadge } from "@/components/order/order-timeline"
import { buttonVariants } from "@/components/ui/button"
import { listOrders } from "@/lib/data/customer"
import { getI18n } from "@/lib/i18n"
import { cn, formatDate, formatPrice, itemCount } from "@/lib/utils"

export const metadata = { title: "My Orders" }

const PAGE_SIZE = 10
const FILTERS = [
  { value: "", key: "filter_all" },
  { value: "active", key: "filter_active" },
  { value: "delivered", key: "filter_delivered" },
  { value: "canceled", key: "filter_canceled" },
]

const hrefFor = (status, page) => {
  const params = new URLSearchParams()
  if (status) params.set("status", status)
  if (page > 1) params.set("page", String(page))
  const query = params.toString()
  return `/account/orders${query ? `?${query}` : ""}`
}

const OrdersPage = async (props) => {
  const searchParams = await props.searchParams
  const { locale, dict } = await getI18n()

  const status = FILTERS.some((filter) => filter.value && filter.value === searchParams?.status)
    ? searchParams.status
    : ""
  const page = Math.max(1, Number(searchParams?.page) || 1)
  const { orders, count } = await listOrders({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, status })

  const lastPage = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const from = count === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, count)

  return (
    <>
      <PageHeader title={dict.account.orders} />

      <div className="mb-5 flex gap-1 overflow-x-auto border-b pb-px">
        {FILTERS.map((filter) => {
          const active = filter.value === status
          return (
            <Link
              key={filter.key}
              href={hrefFor(filter.value, 1)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px shrink-0 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              {dict.account[filter.key]}
            </Link>
          )
        })}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={status ? dict.account.no_orders_filter : dict.account.no_orders}
          hint={status ? undefined : dict.account.no_orders_hint}
          actionLabel={status ? dict.account.filter_all : dict.account.keep_shopping}
          actionHref={status ? "/account/orders" : "/search"}
        />
      ) : (
        <>
          <ul className="space-y-3">
            {orders.map((order) => {
              const items = order.items || []
              return (
                <li key={order.id}>
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="group flex items-center gap-4 rounded-xl border bg-white p-4 transition-colors hover:border-foreground/20 hover:bg-accent/30 sm:p-5"
                  >
                    <div className="flex -space-x-3">
                      {items.slice(0, 3).map((item) => (
                        <span
                          key={item.id}
                          className="relative size-12 shrink-0 overflow-hidden rounded-lg border-2 border-white bg-secondary/40"
                        >
                          {item.thumbnail && (
                            <Image
                              src={item.thumbnail}
                              alt={item.product_title || item.title || ""}
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          )}
                        </span>
                      ))}
                      {items.length > 3 && (
                        <span className="relative flex size-12 shrink-0 items-center justify-center rounded-lg border-2 border-white bg-secondary text-xs font-semibold text-muted-foreground">
                          +{items.length - 3}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className="font-semibold">
                          {dict.order.order_number} #{order.display_id}
                        </span>
                        <StatusBadge status={order.status} dict={dict} />
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {items
                          .slice(0, 2)
                          .map((item) => item.product_title || item.title)
                          .join(", ")}
                        {items.length > 2 && ` +${items.length - 2}`}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(order.created_at, locale)} · {itemCount(items.length, dict)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 sm:gap-4">
                      <span className="font-semibold">{formatPrice(order.total, locale)}</span>
                      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {dict.account.showing
                .replace("{from}", from)
                .replace("{to}", to)
                .replace("{total}", count)}
            </p>
            {lastPage > 1 && (
              <div className="flex gap-2">
                <Link
                  href={hrefFor(status, page - 1)}
                  aria-disabled={page <= 1}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    page <= 1 && "pointer-events-none opacity-50"
                  )}
                >
                  {dict.plp.previous}
                </Link>
                <Link
                  href={hrefFor(status, page + 1)}
                  aria-disabled={page >= lastPage}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    page >= lastPage && "pointer-events-none opacity-50"
                  )}
                >
                  {dict.plp.next}
                </Link>
              </div>
            )}
          </div>
        </>
      )}

      {orders.length > 0 && (
        <Link
          href="/search"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-6")}
        >
          <Package className="size-4" />
          {dict.account.keep_shopping}
        </Link>
      )}
    </>
  )
}

export default OrdersPage
