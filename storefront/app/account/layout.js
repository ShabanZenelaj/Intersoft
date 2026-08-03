import { redirect } from "next/navigation"
import { AccountNav } from "@/components/account/account-nav"
import { LogoutButton } from "@/components/account/logout-button"
import { getCustomer } from "@/lib/data/customer"
import { getI18n } from "@/lib/i18n"
import { formatDate } from "@/lib/utils"

const initials = (customer) =>
  [customer.first_name, customer.last_name]
    .filter(Boolean)
    .map((name) => name.trim()[0])
    .join("")
    .toUpperCase() || customer.email[0].toUpperCase()

const AccountLayout = async ({ children }) => {
  const { locale, dict } = await getI18n()
  const customer = await getCustomer()
  if (!customer) redirect("/login")

  const navItems = [
    { key: "overview", href: "/account", label: dict.account.overview, exact: true },
    { key: "orders", href: "/account/orders", label: dict.account.orders },
    { key: "profile", href: "/account/profile", label: dict.account.profile },
    { key: "security", href: "/account/password", label: dict.account.security },
  ]

  return (
    <div className="mx-auto max-w-container-md px-4 py-8 md:py-12">
      <div className="grid gap-8 md:grid-cols-[248px_1fr] md:gap-10">
        {/* min-w-0 lets the nav scroll inside its column instead of widening the page. */}
        <aside className="h-fit min-w-0 space-y-4 md:sticky md:top-24">
          {/* Who you are signed in as — the panel should never leave that in doubt. */}
          <div className="rounded-xl border bg-secondary/20 p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {initials(customer)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold leading-tight">
                  {customer.first_name} {customer.last_name}
                </p>
                <p className="truncate text-xs text-muted-foreground">{customer.email}</p>
              </div>
            </div>
            {customer.created_at && (
              <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                {dict.account.member_since} {formatDate(customer.created_at, locale)}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <AccountNav items={navItems} />
            <div className="pt-1 md:border-t md:pt-2">
              <LogoutButton label={dict.account.logout} />
            </div>
          </div>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}

export default AccountLayout
