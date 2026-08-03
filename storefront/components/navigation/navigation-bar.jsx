"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, Menu, Search, ShoppingBag, User, X } from "lucide-react"
import { Suspense, useEffect, useState } from "react"
import { useCart } from "@/components/cart/cart-provider"
import { useI18n } from "@/components/i18n-provider"
import { LanguageSwitcher } from "./language-switcher"
import { cn } from "@/lib/utils"

const SearchBar = ({ className, onNavigate }) => {
  const { dict } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get("q") || "")

  const submit = (event) => {
    event.preventDefault()
    router.push(value ? `/search?q=${encodeURIComponent(value)}` : "/search")
    onNavigate?.()
  }

  return (
    <form onSubmit={submit} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={dict.nav.search_placeholder}
        className="h-9 w-full rounded-md border border-input bg-secondary/30 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-background"
        aria-label={dict.nav.search_placeholder}
      />
    </form>
  )
}

const CartButton = () => {
  const { itemCount, openCart } = useCart()
  const { dict } = useI18n()

  return (
    <button
      onClick={openCart}
      className="relative flex size-9 items-center justify-center rounded-md transition-transform hover:scale-105"
      aria-label={dict.nav.cart}
    >
      <ShoppingBag className="size-5" />
      {itemCount > 0 && (
        <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-black text-[11px] text-white">
          {itemCount}
        </span>
      )}
    </button>
  )
}

/**
 * Sticky navigation bar in the spirit of the Blazity template's mega nav:
 * top-level categories with hover dropdowns of their subcategories.
 * `categories` is the tree from getCategoryTree(), `customer` is null or the
 * logged-in customer.
 */
export const NavigationBar = ({ categories, isLoggedIn, customerName }) => {
  const { dict } = useI18n()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-black/10 bg-white">
      <div className="mx-auto flex h-[60px] w-full max-w-container-md items-center gap-4 px-4 xl:px-0">
        <button
          className="flex size-9 items-center justify-center rounded-md lg:hidden"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={dict.nav.menu}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>

        <Link href="/" className="mr-2 text-xl font-bold tracking-tight">
          Intersoft
        </Link>

        <nav className="hidden lg:block">
          <ul className="flex items-center gap-1">
            <li>
              <Link
                href="/search"
                className="block rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                {dict.nav.all_products}
              </Link>
            </li>
            {categories.map((category) => (
              <li key={category.id} className="group relative">
                <Link
                  href={`/category/${category.handle}`}
                  className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                >
                  {category.name}
                  {category.children.length > 0 && <ChevronDown className="size-3.5 opacity-60" />}
                </Link>
                {category.children.length > 0 && (
                  <div className="invisible absolute left-0 top-full z-50 min-w-[220px] rounded-b-lg border border-black/10 bg-white p-2 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
                    {category.children.map((child) => (
                      <Link
                        key={child.id}
                        href={`/category/${child.handle}`}
                        className="block rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Suspense>
            <SearchBar className="hidden w-56 md:block xl:w-72" />
          </Suspense>
          <LanguageSwitcher />
          <Link
            href={isLoggedIn ? "/account" : "/login"}
            className="flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors hover:bg-accent"
            title={isLoggedIn ? dict.nav.account : dict.nav.sign_in}
          >
            <User className="size-5 shrink-0" />
            <span className="hidden max-w-[9ch] truncate lg:inline">
              {isLoggedIn ? customerName || dict.nav.account : dict.nav.sign_in}
            </span>
          </Link>
          <CartButton />
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-black/10 bg-white px-4 pb-6 pt-3 lg:hidden">
          <Suspense>
            <SearchBar className="mb-3 md:hidden" onNavigate={() => setMobileOpen(false)} />
          </Suspense>
          <Link href="/search" className="block py-2 text-sm font-medium">
            {dict.nav.all_products}
          </Link>
          {categories.map((category) => (
            <div key={category.id} className="border-t border-black/5 py-2">
              <Link href={`/category/${category.handle}`} className="block py-1 text-sm font-medium">
                {category.name}
              </Link>
              {category.children.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 pl-3">
                  {category.children.map((child) => (
                    <Link
                      key={child.id}
                      href={`/category/${child.handle}`}
                      className="py-1 text-sm text-muted-foreground"
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </header>
  )
}
