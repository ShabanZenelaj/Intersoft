"use client"

import useEmblaCarousel from "embla-carousel-react"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { buttonVariants } from "@/components/ui/button"
import { Price } from "@/components/price"
import { useI18n } from "@/components/i18n-provider"
import { cn, getProductPrice, productImage } from "@/lib/utils"

/** Compact product card overlaid on the hero image (template's CompactProductCard). */
const CompactProductCard = ({ product, locale }) => {
  const { amount, originalAmount, onSale } = getProductPrice(product)
  return (
    <Link
      href={`/product/${product.handle}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-background/20 bg-background/95 p-3 shadow-xl backdrop-blur transition-all duration-300 hover:scale-105 hover:shadow-2xl"
    >
      <div className="relative mb-3 aspect-square overflow-hidden rounded-md">
        <Image
          src={productImage(product)}
          alt={product.title}
          fill
          className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          sizes="240px"
        />
      </div>
      <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-foreground">{product.title}</h3>
      <Price amount={amount} originalAmount={originalAmount} onSale={onSale} locale={locale} className="text-sm" />
    </Link>
  )
}

/**
 * Hero carousel ported from the Blazity template's HomepageCarousel.
 * slides: [{ id, imageUrl, title, subtitle, ctaText, ctaHref, product }]
 */
export const HomepageCarousel = ({ slides = [], className }) => {
  const { locale, dict } = useI18n()
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start", inViewThreshold: 0.7 })
  const [selectedIndex, setSelectedIndex] = useState(0)

  const scrollTo = useCallback((index) => emblaApi?.scrollTo(index), [emblaApi])
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on("select", onSelect)
    emblaApi.on("reInit", onSelect)
    return () => {
      emblaApi.off("select", onSelect)
      emblaApi.off("reInit", onSelect)
    }
  }, [emblaApi, onSelect])

  if (!slides.length) return null

  return (
    <div className={cn("relative bg-secondary/20", className)} role="region" aria-roledescription="carousel">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {slides.map((slide, index) => (
            <div key={slide.id} className="relative min-w-full flex-[0_0_100%]">
              <div className="container mx-auto">
                <div className="relative min-h-[480px] px-4 py-12 sm:min-h-[520px] sm:py-16 lg:grid lg:min-h-0 lg:grid-cols-2 lg:items-center lg:gap-12 lg:py-16 xl:gap-16">
                  <div className="absolute inset-0 -z-10 lg:hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/75 to-background/90" />
                    {slide.imageUrl && (
                      <Image
                        src={slide.imageUrl}
                        alt=""
                        width={768}
                        height={500}
                        className="size-full object-cover object-center opacity-25"
                        priority={index === 0}
                        quality={30}
                      />
                    )}
                  </div>

                  <div className="relative flex flex-col justify-center space-y-6 text-center lg:px-4 lg:text-left">
                    <div className="space-y-4">
                      <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl xl:text-6xl">
                        {slide.title}
                      </h2>
                      <p className="mx-auto max-w-md text-balance text-base text-muted-foreground sm:text-lg lg:mx-0 lg:text-xl">
                        {slide.subtitle}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                      <Link href={slide.ctaHref} className={buttonVariants({ className: "w-full sm:w-auto lg:px-8 lg:py-6 lg:text-lg" })}>
                        {slide.ctaText}
                      </Link>
                      <Link
                        href="/search"
                        className={buttonVariants({ variant: "outline", className: "w-full sm:w-auto lg:px-8 lg:py-6 lg:text-lg" })}
                      >
                        {dict.home.browse_all}
                      </Link>
                    </div>
                  </div>

                  <div className="relative hidden lg:block lg:px-4">
                    <div className="relative h-[400px] w-full overflow-hidden rounded-lg bg-white lg:h-[460px] xl:h-[520px]">
                      {slide.imageUrl && (
                        <Image
                          src={slide.imageUrl}
                          alt={slide.title}
                          width={600}
                          height={600}
                          className="size-full object-cover"
                          priority={index === 0}
                          quality={85}
                        />
                      )}
                      {slide.product && (
                        <div className="absolute bottom-4 right-4 hidden w-[200px] md:block lg:bottom-8 lg:right-8 lg:w-[220px]">
                          <CompactProductCard product={slide.product} locale={locale} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {slides.length > 1 && (
        <>
          <div className="absolute inset-x-0 bottom-8 hidden lg:block">
            <div className="container mx-auto px-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-2" role="tablist">
                  {slides.map((_, index) => (
                    <button
                      key={index}
                      className={cn(
                        "h-2 rounded-full transition-all duration-300",
                        selectedIndex === index ? "w-8 bg-foreground" : "w-2 bg-foreground/30 hover:bg-foreground/50"
                      )}
                      onClick={() => scrollTo(index)}
                      role="tab"
                      aria-selected={selectedIndex === index}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    className="flex size-10 items-center justify-center rounded-full border border-border bg-background/80 backdrop-blur transition-all hover:scale-110 hover:bg-background hover:shadow-md"
                    onClick={scrollPrev}
                    aria-label="Previous slide"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    className="flex size-10 items-center justify-center rounded-full border border-border bg-background/80 backdrop-blur transition-all hover:scale-110 hover:bg-background hover:shadow-md"
                    onClick={scrollNext}
                    aria-label="Next slide"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-6 flex justify-center gap-3 lg:hidden">
            {slides.map((_, index) => (
              <button
                key={index}
                className={cn(
                  "h-2.5 rounded-full transition-all duration-300",
                  selectedIndex === index ? "w-8 bg-foreground" : "w-2.5 bg-foreground/40"
                )}
                onClick={() => scrollTo(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
