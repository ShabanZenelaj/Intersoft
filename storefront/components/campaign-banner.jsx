import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

/** Banner headline/subtitle in the shopper's language, with a sensible fallback. */
export const bannerText = (banner, locale) => ({
  title: (locale === "sq" && banner?.title_sq) || banner?.title || "",
  subtitle: (locale === "sq" && banner?.subtitle_sq) || banner?.subtitle || "",
})

/**
 * Home-page campaign banner. The whole banner is a link to the campaign's
 * catalogue page.
 */
export const CampaignBanner = ({ campaign, locale, dict, className }) => {
  if (!campaign?.banner?.image) return null
  const { title, subtitle } = bannerText(campaign.banner, locale)

  return (
    <Link
      href={`/campaign/${campaign.handle}`}
      className={cn(
        "group relative block w-full overflow-hidden rounded-xl bg-secondary/30",
        "transition-shadow duration-300 hover:shadow-xl",
        className
      )}
      aria-label={title || campaign.name}
    >
      <div className="relative aspect-[16/6] w-full sm:aspect-[21/6]">
        <Image
          src={campaign.banner.image}
          alt={title || campaign.name}
          fill
          priority
          sizes="(max-width: 1400px) 100vw, 1400px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
        {(title || subtitle) && (
          <>
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-center gap-2 p-6 text-white sm:p-10 lg:p-14">
              {title && (
                <h2 className="max-w-xl text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">{title}</h2>
              )}
              {subtitle && <p className="max-w-lg text-sm opacity-90 sm:text-base">{subtitle}</p>}
              <span className="mt-2 inline-flex items-center gap-2 text-sm font-semibold">
                {dict.home.shop_now}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </>
        )}
      </div>
    </Link>
  )
}
