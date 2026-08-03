"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { SlidersHorizontal } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/i18n-provider"
import { cn } from "@/lib/utils"

const parseList = (value) => (value ? value.split(",").filter(Boolean) : [])

const CheckboxRow = ({ label, count, checked, onChange }) => (
  <label className="flex cursor-pointer items-center gap-2 py-1 text-sm">
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="size-4 rounded border-input accent-black"
    />
    <span className="flex-1">{label}</span>
    {count !== undefined && <span className="text-xs text-muted-foreground">({count})</span>}
  </label>
)

const FacetsContent = ({ facets, hideCategories }) => {
  const { dict } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const selectedCategories = parseList(searchParams.get("categories"))
  const selectedBrands = parseList(searchParams.get("brands"))
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") || "")
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "")

  const updateParams = (updates) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || (Array.isArray(value) && !value.length)) {
        params.delete(key)
      } else {
        params.set(key, Array.isArray(value) ? value.join(",") : String(value))
      }
    }
    params.delete("page")
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const toggle = (list, value) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value])

  const hasActiveFilters =
    selectedCategories.length || selectedBrands.length || searchParams.get("minPrice") ||
    searchParams.get("maxPrice") || searchParams.get("stock")

  return (
    <div className="space-y-6">
      {!hideCategories && facets.categories.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {dict.plp.categories}
          </h3>
          <div className="max-h-64 overflow-y-auto pr-1">
            {facets.categories.map((facet) => (
              <CheckboxRow
                key={facet.handle}
                label={facet.name}
                count={facet.count}
                checked={selectedCategories.includes(facet.handle)}
                onChange={() => updateParams({ categories: toggle(selectedCategories, facet.handle) })}
              />
            ))}
          </div>
        </div>
      )}

      {facets.brands.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {dict.plp.brands}
          </h3>
          <div className="max-h-64 overflow-y-auto pr-1">
            {facets.brands.map((facet) => (
              <CheckboxRow
                key={facet.value}
                label={facet.value}
                count={facet.count}
                checked={selectedBrands.includes(facet.value)}
                onChange={() => updateParams({ brands: toggle(selectedBrands, facet.value) })}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{dict.plp.price}</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            placeholder={dict.plp.min}
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
            className="h-8 w-full rounded-md border border-input px-2 text-sm"
            aria-label={dict.plp.min}
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="number"
            min="0"
            placeholder={dict.plp.max}
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            className="h-8 w-full rounded-md border border-input px-2 text-sm"
            aria-label={dict.plp.max}
          />
          <Button size="sm" variant="outline" onClick={() => updateParams({ minPrice, maxPrice })}>
            {dict.plp.apply}
          </Button>
        </div>
      </div>

      <CheckboxRow
        label={dict.plp.in_stock_only}
        checked={searchParams.get("stock") === "1"}
        onChange={() => updateParams({ stock: searchParams.get("stock") === "1" ? null : "1" })}
      />

      {hasActiveFilters ? (
        <button
          className="text-sm font-medium underline underline-offset-4 hover:no-underline"
          onClick={() => {
            setMinPrice("")
            setMaxPrice("")
            updateParams({ categories: null, brands: null, minPrice: null, maxPrice: null, stock: null })
          }}
        >
          {dict.plp.clear_all}
        </button>
      ) : null}
    </div>
  )
}

export const FacetsDesktop = ({ facets, hideCategories, className }) => (
  <div className={cn("hidden lg:block", className)}>
    <FacetsContent facets={facets} hideCategories={hideCategories} />
  </div>
)

export const FacetsMobile = ({ facets, hideCategories }) => {
  const { dict } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <div className="lg:hidden">
      <Button variant="outline" size="sm" onClick={() => setOpen((value) => !value)}>
        <SlidersHorizontal className="size-4" />
        {dict.plp.filters}
      </Button>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-2xl bg-background p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{dict.plp.filters}</h2>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                ✕
              </Button>
            </div>
            <FacetsContent facets={facets} hideCategories={hideCategories} />
          </div>
        </div>
      )}
    </div>
  )
}
