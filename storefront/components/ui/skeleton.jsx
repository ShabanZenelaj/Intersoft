import { cn } from "@/lib/utils"

export const Skeleton = ({ className, ...props }) => (
  <div className={cn("animate-pulse rounded-md bg-primary/10", className)} {...props} />
)
