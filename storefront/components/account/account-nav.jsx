"use client"

import { KeyRound, LayoutGrid, Package, User } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useI18n } from "@/components/i18n-provider"
import { cn } from "@/lib/utils"

const ICONS = { overview: LayoutGrid, orders: Package, profile: User, security: KeyRound }

/**
 * Account sidebar links. Highlights the section the shopper is in — /account
 * only when it is exactly the overview, the rest on any nested route.
 */
export const AccountNav = ({ items }) => {
  const pathname = usePathname()
  const { dict } = useI18n()

  return (
    <nav aria-label={dict.account.title} className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {items.map((item) => {
        const Icon = ICONS[item.key] || LayoutGrid
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
