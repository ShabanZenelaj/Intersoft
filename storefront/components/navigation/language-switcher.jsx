"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { useI18n } from "@/components/i18n-provider"
import { setLocale } from "@/lib/actions/locale"
import { cn } from "@/lib/utils"

export const LanguageSwitcher = () => {
  const { locale } = useI18n()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const switchTo = (next) => {
    if (next === locale) return
    startTransition(async () => {
      await setLocale(next)
      router.refresh()
    })
  }

  return (
    <div
      className={cn("flex items-center rounded-md border text-xs font-semibold", pending && "opacity-50")}
      role="group"
      aria-label="Language"
    >
      {["sq", "en"].map((code) => (
        <button
          key={code}
          onClick={() => switchTo(code)}
          className={cn(
            "px-2 py-1.5 uppercase transition-colors first:rounded-l-md last:rounded-r-md",
            locale === code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
          )}
        >
          {code}
        </button>
      ))}
    </div>
  )
}
