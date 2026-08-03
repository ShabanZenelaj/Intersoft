import Link from "next/link"
import { cn } from "@/lib/utils"

/** items: array of { label, href } — the last item is the current page (no href needed). */
export const Breadcrumbs = ({ items, className }) => (
  <nav aria-label="Breadcrumb" className={cn("text-sm text-muted-foreground", className)}>
    <ol className="flex flex-wrap items-center gap-1">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <li key={index} className="flex items-center gap-1">
            {item.href && !isLast ? (
              <Link href={item.href} className="transition-colors hover:text-foreground" prefetch={false}>
                {item.label}
              </Link>
            ) : (
              <span className={cn(isLast && "text-foreground")}>{item.label}</span>
            )}
            {!isLast && <span aria-hidden>/</span>}
          </li>
        )
      })}
    </ol>
  </nav>
)
