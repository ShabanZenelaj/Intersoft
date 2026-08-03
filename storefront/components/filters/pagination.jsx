"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/i18n-provider"

export const Pagination = ({ page, totalPages }) => {
  const { dict } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (totalPages <= 1) return null

  const goTo = (nextPage) => {
    const params = new URLSearchParams(searchParams.toString())
    if (nextPage <= 1) {
      params.delete("page")
    } else {
      params.set("page", String(nextPage))
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center justify-center gap-4 py-8">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goTo(page - 1)}>
        {dict.plp.previous}
      </Button>
      <span className="text-sm text-muted-foreground">
        {dict.plp.page} {page} {dict.plp.of} {totalPages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => goTo(page + 1)}>
        {dict.plp.next}
      </Button>
    </div>
  )
}
