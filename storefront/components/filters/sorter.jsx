"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useI18n } from "@/components/i18n-provider"

export const Sorter = () => {
  const { dict } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const onChange = (event) => {
    const params = new URLSearchParams(searchParams.toString())
    if (event.target.value) {
      params.set("sort", event.target.value)
    } else {
      params.delete("sort")
    }
    params.delete("page")
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{dict.plp.sort}:</span>
      <select
        value={searchParams.get("sort") || ""}
        onChange={onChange}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none transition-colors hover:bg-accent focus:border-ring"
      >
        <option value="">{dict.plp.sort_relevance}</option>
        <option value="newest">{dict.plp.sort_newest}</option>
        <option value="price_asc">{dict.plp.sort_price_asc}</option>
        <option value="price_desc">{dict.plp.sort_price_desc}</option>
        <option value="title">{dict.plp.sort_title}</option>
      </select>
    </label>
  )
}
