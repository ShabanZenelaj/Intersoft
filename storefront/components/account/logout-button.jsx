"use client"

import { LogOut } from "lucide-react"
import { useEffect, useRef, useState, useTransition } from "react"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { logout } from "@/lib/actions/auth"

/**
 * Signing out is one click away from losing your place, so it asks first.
 * Escape and a click on the backdrop both cancel.
 */
export const LogoutButton = ({ label }) => {
  const { dict } = useI18n()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const confirmRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    confirmRef.current?.focus()
    const onKey = (event) => event.key === "Escape" && setOpen(false)
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <LogOut className="size-4 shrink-0" />
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(event) => event.target === event.currentTarget && setOpen(false)}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="logout-title" className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 id="logout-title" className="text-lg font-semibold">
              {dict.account.logout_confirm_title}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{dict.account.logout_confirm_text}</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                {dict.account.cancel}
              </Button>
              <Button
                ref={confirmRef}
                variant="destructive"
                isLoading={pending}
                onClick={() => startTransition(() => logout())}
              >
                {dict.account.logout}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
