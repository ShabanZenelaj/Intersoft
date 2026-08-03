import { notFound } from "next/navigation"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { ProductCard } from "@/components/product-card"
import { ProductGallery } from "@/components/product/product-gallery"
import { PurchasePanel } from "@/components/product/purchase-panel"
import { getProductByHandle, getSimilarProducts } from "@/lib/data/products"
import { getI18n } from "@/lib/i18n"
import { formatPrice, shipmentName, translateCategory, translateProduct } from "@/lib/utils"

export const generateMetadata = async (props) => {
  const params = await props.params
  const product = await getProductByHandle(params.handle)
  if (!product) return { title: "Product" }
  return { title: product.title, description: product.description?.slice(0, 160) }
}

const Accordion = ({ title, children, defaultOpen = false }) => (
  <details className="group border-b py-4" open={defaultOpen}>
    <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
      {title}
      <span className="transition-transform group-open:rotate-45 text-lg leading-none">+</span>
    </summary>
    <div className="pt-3 text-sm text-muted-foreground">{children}</div>
  </details>
)

const ProductPage = async (props) => {
  const params = await props.params
  const { locale, dict } = await getI18n()

  const rawProduct = await getProductByHandle(params.handle)
  if (!rawProduct) return notFound()

  const product = translateProduct(rawProduct, locale)
  const similar = await getSimilarProducts(rawProduct, 4)
  const category = translateCategory((product.categories || [])[0], locale)
  const brand = product.metadata?.brand
  const tags = (product.tags || []).map((tag) => tag.value)

  return (
    <div className="relative mx-auto max-w-container-md px-4 xl:px-0">
      <div className="relative flex w-full items-center justify-center gap-10 py-4 md:pt-12">
        <div className="mx-auto w-full max-w-container-sm">
          <Breadcrumbs
            className="mb-2"
            items={[
              { label: dict.nav.home, href: "/" },
              category
                ? { label: category.name, href: `/category/${category.handle}` }
                : { label: dict.nav.all_products, href: "/search" },
              { label: product.title },
            ]}
          />
        </div>
      </div>

      <main className="mx-auto max-w-container-sm">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          <ProductGallery images={product.images || []} title={product.title} />

          <div className="flex flex-col gap-6 md:col-span-5">
            <div>
              {!!brand && <p className="text-sm text-muted-foreground">{brand}</p>}
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{product.title}</h1>
            </div>

            <PurchasePanel product={product} />

            <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>

            <div>
              <Accordion title={dict.pdp.details} defaultOpen>
                <ul className="space-y-1">
                  {!!brand && (
                    <li>
                      <span className="font-medium text-foreground">{dict.pdp.brand}:</span> {brand}
                    </li>
                  )}
                  {!!product.variants?.[0]?.sku && (
                    <li>
                      <span className="font-medium text-foreground">{dict.pdp.sku}:</span> {product.variants[0].sku}
                    </li>
                  )}
                  {tags.length > 0 && (
                    <li>
                      <span className="font-medium text-foreground">{dict.pdp.tags}:</span> {tags.join(", ")}
                    </li>
                  )}
                </ul>
              </Accordion>
              <Accordion title={dict.pdp.delivery_title}>
                {product.shipping_method && (
                  <p className="mb-2 font-medium text-foreground">
                    {shipmentName(product.shipping_method, locale)} — {formatPrice(product.shipping_method.price, locale)}
                  </p>
                )}
                {dict.pdp.delivery_text}
              </Accordion>
              <Accordion title={dict.pdp.payment_title}>{dict.pdp.payment_text}</Accordion>
            </div>
          </div>
        </div>

        {similar.length > 0 && (
          <section className="py-16">
            <h2 className="mb-8 text-2xl font-semibold tracking-tight md:text-3xl">{dict.pdp.similar}</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {similar.map((item) => (
                <ProductCard
                  key={item.id}
                  product={translateProduct(item, locale)}
                  dict={dict}
                  locale={locale}
                  className="bg-secondary/10 hover:bg-secondary/20"
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default ProductPage
