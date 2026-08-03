import Image from "next/image"
import { notFound } from "next/navigation"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { bannerText } from "@/components/campaign-banner"
import { ProductCard } from "@/components/product-card"
import { getCampaign } from "@/lib/data/campaigns"
import { getI18n } from "@/lib/i18n"
import { formatPrice, translateProduct } from "@/lib/utils"

// Campaign visibility depends on the shopper's customer group.
export const dynamic = "force-dynamic"

export const generateMetadata = async (props) => {
  const params = await props.params
  const data = await getCampaign(params.handle)
  if (!data) return { title: "Campaign" }
  return { title: data.campaign.name }
}

/** Short human description of what the campaign gives, in the shopper's language. */
const describeOffer = (campaign, dict, locale) => {
  if (campaign.type === "free_shipping") return dict.cart.free_shipping
  const value =
    campaign.type === "percentage" ? `${Number(campaign.value)}%` : formatPrice(campaign.value, locale)
  return dict.campaign.offer.replace("{value}", value)
}

const CampaignPage = async (props) => {
  const params = await props.params
  const { locale, dict } = await getI18n()

  // Not found *and* not allowed both land here: a campaign limited to a group
  // simply does not exist for anyone outside it.
  const data = await getCampaign(params.handle)
  if (!data) return notFound()

  const { campaign, products } = data
  const { title, subtitle } = bannerText(campaign.banner, locale)

  return (
    <div className="mx-auto w-full max-w-container-md px-4 py-6 xl:px-0">
      <Breadcrumbs
        className="mb-6"
        items={[{ label: dict.nav.home, href: "/" }, { label: campaign.name }]}
      />

      {campaign.banner?.image ? (
        <div className="relative mb-8 aspect-[16/6] w-full overflow-hidden rounded-xl sm:aspect-[21/6]">
          <Image
            src={campaign.banner.image}
            alt={title || campaign.name}
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-center gap-2 p-6 text-white sm:p-10 lg:p-14">
            <h1 className="max-w-xl text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              {title || campaign.name}
            </h1>
            {subtitle && <p className="max-w-lg text-sm opacity-90 sm:text-base">{subtitle}</p>}
          </div>
        </div>
      ) : (
        <h1 className="mb-4 text-3xl font-bold tracking-tight">{campaign.name}</h1>
      )}

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
          {describeOffer(campaign, dict, locale)}
        </span>
        {campaign.code && (
          <span className="text-sm text-muted-foreground">
            {dict.campaign.use_code} <strong className="text-foreground">{campaign.code}</strong>
          </span>
        )}
        {campaign.is_automatic && <span className="text-sm text-muted-foreground">{dict.campaign.automatic}</span>}
        {campaign.min_subtotal > 0 && (
          <span className="text-sm text-muted-foreground">
            {dict.campaign.min_subtotal.replace("{value}", formatPrice(campaign.min_subtotal, locale))}
          </span>
        )}
        {campaign.min_quantity > 0 && (
          <span className="text-sm text-muted-foreground">
            {dict.campaign.min_quantity.replace("{value}", campaign.min_quantity)}
          </span>
        )}
      </div>

      <div className="mb-4 flex items-baseline gap-2">
        <h2 className="text-xl font-semibold tracking-tight">{dict.campaign.products}</h2>
        <span className="text-muted-foreground">({products.length})</span>
      </div>

      {products.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">{dict.plp.no_results}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={translateProduct(product, locale)}
              dict={dict}
              locale={locale}
              className="bg-secondary/10 hover:bg-secondary/20"
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default CampaignPage
