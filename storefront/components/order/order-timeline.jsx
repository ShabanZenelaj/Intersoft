import { Check, CircleDot } from "lucide-react"
import { cn, formatDateTime, formatPrice } from "@/lib/utils"

/** Customer-facing wording for the order events recorded by the backend. */
const describe = (event, dict, locale) => {
  const data = event.data || {}
  switch (event.type) {
    case "placed":
      return dict.order.event_placed
    case "status_changed":
      return dict.order[`event_${data.to}`] || data.to
    case "payment_captured":
      return dict.order.event_paid
    case "refunded":
      return `${dict.order.event_refunded} · ${formatPrice(data.amount, locale)}`
    default:
      return null
  }
}

export const OrderTimeline = ({ events = [], dict, locale }) => {
  const entries = events
    .map((event) => ({ label: describe(event, dict, locale), at: event.created_at }))
    .filter((entry) => entry.label)

  if (!entries.length) return null

  return (
    <ol className="space-y-3">
      {entries.map((entry, index) => (
        <li key={index} className="flex items-start gap-3 text-sm">
          <span
            className={cn(
              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
              index === 0 ? "bg-green-600 text-white" : "bg-secondary text-muted-foreground"
            )}
          >
            {index === 0 ? <Check className="size-3" /> : <CircleDot className="size-3" />}
          </span>
          <span className={cn(index === 0 ? "font-medium" : "text-muted-foreground")}>
            {entry.label}
            <span className="ml-2 text-xs text-muted-foreground">{formatDateTime(entry.at, locale)}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  canceled: "bg-red-100 text-red-800",
}

export const StatusBadge = ({ status, dict, className }) => (
  <span
    className={cn(
      "inline-block rounded-full px-2.5 py-1 text-xs font-semibold",
      STATUS_STYLES[status] || "bg-secondary text-muted-foreground",
      className
    )}
  >
    {dict.order[`event_${status}`] || status}
  </span>
)
