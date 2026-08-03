import { cn, formatPrice } from "@/lib/utils"

/** Price display with sale support: current price + struck-through original. */
export const Price = ({ amount, originalAmount, onSale, locale = "en", className, size = "base" }) => {
  if (amount === null || amount === undefined) return null
  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span className={cn("font-semibold", onSale && "text-red-600", size === "lg" ? "text-2xl" : "text-base")}>
        {formatPrice(amount, locale)}
      </span>
      {onSale && originalAmount !== null && (
        <span className={cn("text-muted-foreground line-through", size === "lg" ? "text-lg" : "text-sm")}>
          {formatPrice(originalAmount, locale)}
        </span>
      )}
    </span>
  )
}
