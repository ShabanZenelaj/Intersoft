"use client"

import { useActionState } from "react"
import { useI18n } from "@/components/i18n-provider"
import { OrderSummaryCard } from "@/components/order/order-summary-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trackOrder } from "@/lib/actions/checkout"

export const TrackOrderView = () => {
  const { locale, dict } = useI18n()
  const [state, action, pending] = useActionState(trackOrder, {})

  if (state?.order) {
    return (
      <div className="space-y-6">
        <OrderSummaryCard order={state.order} dict={dict} locale={locale} />
        <p className="text-sm text-muted-foreground">{dict.order.support_note}</p>
      </div>
    )
  }

  return (
    <form action={action} className="max-w-md space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="track-number">{dict.order.track_number}</Label>
        <Input id="track-number" name="display_id" inputMode="numeric" placeholder="1234" required />
        <p className="text-xs text-muted-foreground">{dict.order.track_hint}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="track-email">{dict.order.track_email}</Label>
        <Input id="track-email" name="email" type="email" required />
      </div>
      {state?.error && (
        <p className="text-sm text-destructive">
          {state.error === "not_found" ? dict.order.track_not_found : dict.auth.missing_fields}
        </p>
      )}
      <Button type="submit" isLoading={pending}>
        {dict.order.track_cta}
      </Button>
    </form>
  )
}
