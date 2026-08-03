import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Title + one line of context, on top of every account screen. */
export const PageHeader = ({ title, description, action }) => (
  <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
    {action}
  </div>
)

export const Card = ({ title, description, children, className, footer }) => (
  <section className={cn("rounded-xl border bg-white", className)}>
    {(title || description) && (
      <div className="border-b px-6 py-4">
        {title && <h2 className="font-semibold">{title}</h2>}
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
    )}
    <div className="px-6 py-5">{children}</div>
    {footer && <div className="border-t bg-secondary/20 px-6 py-3">{footer}</div>}
  </section>
)

/** Always says what to do next, never just "nothing here". */
export const EmptyState = ({ icon: Icon, title, hint, actionLabel, actionHref }) => (
  <div className="rounded-xl border border-dashed px-6 py-12 text-center">
    {Icon && (
      <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-secondary/50 text-muted-foreground">
        <Icon className="size-6" />
      </span>
    )}
    <p className="font-medium">{title}</p>
    {hint && <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{hint}</p>}
    {actionLabel && actionHref && (
      <Link href={actionHref} className={cn(buttonVariants({ size: "sm" }), "mt-5")}>
        {actionLabel}
      </Link>
    )}
  </div>
)

export const StatTile = ({ icon: Icon, label, value, href }) => {
  const body = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary/60 text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
        <span className="block truncate text-lg font-semibold leading-tight">{value}</span>
      </span>
    </>
  )

  const className = cn(
    "flex items-center gap-3 rounded-xl border bg-white px-4 py-3.5",
    href && "transition-colors hover:border-foreground/20 hover:bg-accent/40"
  )

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}
