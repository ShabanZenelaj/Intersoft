import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

/** Large category card with image, gradient overlay and "Shop Now" — ported from the template. */
export const CategoryCard = ({ category, dict, priority = false, className }) => {
  const imageUrl = category.metadata?.image

  return (
    <Link
      href={`/category/${category.handle}`}
      className={cn(
        "group relative block h-full overflow-hidden rounded-2xl bg-background transition-all duration-500",
        "hover:scale-[1.02] hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-primary/20",
        className
      )}
    >
      <div className="relative size-full overflow-hidden bg-secondary/5">
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={category.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 700px"
            className="object-cover transition-all duration-700 group-hover:scale-110"
            priority={priority}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-80" />
        <div className="absolute inset-0 flex flex-col justify-end p-8 text-white lg:p-12">
          <h3 className="mb-2 text-2xl font-bold tracking-tight transition-transform duration-300 group-hover:translate-y-[-4px] lg:text-3xl">
            {category.name}
          </h3>
          {category.description && (
            <p className="mb-4 line-clamp-2 text-base opacity-90 transition-opacity duration-300 group-hover:opacity-100">
              {category.description}
            </p>
          )}
          <div className="flex items-center gap-2 text-base font-semibold">
            <span className="relative">
              {dict.home.shop_now}
              <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-white transition-all duration-300 group-hover:w-full" />
            </span>
            <ArrowRight className="size-5 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2.5} />
          </div>
        </div>
      </div>
    </Link>
  )
}
