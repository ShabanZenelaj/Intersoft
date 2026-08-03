import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { HomepageCarousel } from "@/components/homepage-carousel"
import { CampaignBanner } from "@/components/campaign-banner"
import { CategoryCard } from "@/components/category-card"
import { ProductCard } from "@/components/product-card"
import { listHomeBanners } from "@/lib/data/campaigns"
import { getCategoryTree, getCategoryByHandle } from "@/lib/data/categories"
import { getFeaturedProducts, getNewestProducts, getProductByHandle } from "@/lib/data/products"
import { getI18n } from "@/lib/i18n"
import { translateCategory, translateProduct } from "@/lib/utils"

// Prices and campaign visibility depend on who is shopping.
export const dynamic = "force-dynamic"

const AnnouncementBar = ({ dict }) => (
  <div className="flex h-[40px] w-full items-center justify-center text-nowrap bg-black px-2 text-center text-sm text-white sm:text-base/[18px]">
    <span className="truncate">{dict.home.announcement}</span>
    <Link prefetch={false} href="/search" className="ml-2 shrink-0 underline hover:no-underline">
      {dict.home.announcement_cta}
    </Link>
  </div>
)

const HERO_SLIDES = [
  { id: "components", categoryHandle: "components", productHandle: "geforce-rtx-4070-12gb", index: 1 },
  { id: "gaming", categoryHandle: "desktop-pcs", productHandle: "titan-gaming-pc", index: 2 },
  { id: "peripherals", categoryHandle: "peripherals", productHandle: "27-qhd-165hz-gaming-monitor", index: 3 },
]

const HomePage = async () => {
  const { locale, dict } = await getI18n()

  const [categoryTree, featured, newest, banners, ...heroData] = await Promise.all([
    getCategoryTree(),
    getFeaturedProducts(8),
    getNewestProducts(8),
    listHomeBanners(),
    ...HERO_SLIDES.map(async (slide) => ({
      category: await getCategoryByHandle(slide.categoryHandle).catch(() => null),
      product: await getProductByHandle(slide.productHandle).catch(() => null),
    })),
  ])

  // Several campaigns may want the home slot — rotate between them at random.
  const banner = banners.length ? banners[Math.floor(Math.random() * banners.length)] : null

  const slides = HERO_SLIDES.map((slide, index) => ({
    id: slide.id,
    imageUrl: heroData[index]?.category?.metadata?.image || null,
    title: dict.home[`hero_title_${slide.index}`],
    subtitle: dict.home[`hero_subtitle_${slide.index}`],
    ctaText: dict.home[`hero_cta_${slide.index}`],
    ctaHref: `/category/${slide.categoryHandle}`,
    product: heroData[index]?.product ? translateProduct(heroData[index].product, locale) : null,
  }))

  const featuredCategories = categoryTree.slice(0, 4).map((category) => translateCategory(category, locale))

  return (
    <div className="flex w-full flex-col">
      <AnnouncementBar dict={dict} />

      <div className="mb-8 w-full sm:mb-12 lg:mb-16">
        <HomepageCarousel slides={slides} />
      </div>

      {banner && (
        <section className="mx-auto mb-12 w-full max-w-[1400px] px-4 sm:px-6 lg:mb-16 lg:px-8">
          <CampaignBanner campaign={banner} locale={locale} dict={dict} />
        </section>
      )}

      {/* Featured products */}
      <section className="relative w-full py-8 sm:py-12">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {dict.home.featured_title}
            </h2>
            <p className="mt-2 text-base text-muted-foreground lg:text-lg">{dict.home.featured_subtitle}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
            {featured.map((product, index) => (
              <div key={product.id} className="group relative overflow-hidden rounded-lg bg-secondary/20 transition-all duration-300 hover:bg-secondary/40">
                <ProductCard
                  product={translateProduct(product, locale)}
                  dict={dict}
                  locale={locale}
                  priority={index < 4}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* New arrivals */}
      <section className="relative w-full py-8 sm:py-12">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {dict.home.new_title}
            </h2>
            <p className="mt-2 text-base text-muted-foreground lg:text-lg">{dict.home.new_subtitle}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
            {newest.map((product, index) => (
              <div key={product.id} className="group relative overflow-hidden rounded-lg bg-secondary/20 transition-all duration-300 hover:bg-secondary/40">
                {index < 3 && (
                  <div className="absolute left-3 top-3 z-10">
                    <span className="inline-flex items-center rounded-full bg-foreground px-2 py-1 text-xs font-medium text-background">
                      {dict.home.new_badge}
                    </span>
                  </div>
                )}
                <ProductCard product={translateProduct(product, locale)} dict={dict} locale={locale} />
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link
              href="/search?sort=newest"
              className="group inline-flex items-center gap-2 text-sm font-medium text-foreground underline-offset-4 transition-all hover:underline"
            >
              {dict.home.view_all}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* Featured categories */}
      <section className="relative w-full py-12 sm:py-16 lg:py-24">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {dict.home.categories_title}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{dict.home.categories_subtitle}</p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:gap-8">
            {featuredCategories.map((category, index) => (
              <div key={category.id} className="aspect-[4/3] w-full">
                <CategoryCard category={category} dict={dict} priority={index < 2} className="h-full" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default HomePage
