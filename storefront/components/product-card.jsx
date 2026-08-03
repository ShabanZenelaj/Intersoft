import Image from "next/image"
import Link from "next/link"
import { Price } from "@/components/price"
import { cn, getProductPrice, productImage } from "@/lib/utils"

/**
 * Product card ported from the Blazity template: square image, gradient body,
 * variant count and "From" price. `dict`/`locale` come from the server page.
 */
export const ProductCard = ({ product, dict, locale = "en", priority = false, prefetch = false, className }) => {
  const { amount, originalAmount, onSale } = getProductPrice(product)
  const noOfVariants = product.variants?.length || 0
  const brand = product.metadata?.brand

  return (
    <Link
      className={cn("group flex h-full w-full flex-col overflow-hidden rounded-lg", className)}
      aria-label={`Visit product: ${product.title}`}
      href={`/product/${product.handle}`}
      prefetch={prefetch}
    >
      <div className="relative aspect-square overflow-hidden rounded-lg bg-secondary/20">
        <Image
          priority={priority}
          src={productImage(product)}
          alt={product.title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
        />
        {onSale && (
          <span className="absolute left-3 top-3 rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white">
            {dict.common.sale}
          </span>
        )}
      </div>
      <div className="flex shrink-0 grow flex-col text-pretty bg-gradient-to-b from-transparent to-primary/5 p-4 transition-all duration-200">
        <h3 className="line-clamp-2 text-lg font-semibold transition-colors">{product.title}</h3>
        {!!brand && <p className="pt-1 text-sm text-gray-500">{brand}</p>}
        {amount !== null && (
          <div className="mt-auto flex flex-col pt-8">
            {noOfVariants > 1 && (
              <p className="text-sm text-gray-500">
                {noOfVariants} {noOfVariants > 1 ? dict.plp.variants : dict.plp.variant}
              </p>
            )}
            <div className="flex w-full items-baseline justify-between text-sm">
              <span className="text-primary/50">{dict.plp.from}</span>
              <Price amount={amount} originalAmount={originalAmount} onSale={onSale} locale={locale} />
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}
