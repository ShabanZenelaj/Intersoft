import { Breadcrumbs } from "@/components/breadcrumbs"
import { FacetsDesktop, FacetsMobile } from "@/components/filters/facets-panel"
import { Pagination } from "@/components/filters/pagination"
import { Sorter } from "@/components/filters/sorter"
import { ProductCard } from "@/components/product-card"
import { searchCatalog } from "@/lib/data/catalog"
import { getI18n } from "@/lib/i18n"
import { translateCategory, translateProduct } from "@/lib/utils"

const parseList = (value) => (value ? String(value).split(",").filter(Boolean) : [])

/**
 * Shared listing view for /search and /category/[handle], following the
 * template's PLP layout: sticky facet sidebar, sorter, grid, pagination.
 */
export const SearchView = async ({ searchParams, categoryHandle }) => {
  const { locale, dict } = await getI18n()

  const result = await searchCatalog({
    q: searchParams.q,
    category: categoryHandle,
    categories: parseList(searchParams.categories),
    brands: parseList(searchParams.brands),
    minPrice: searchParams.minPrice,
    maxPrice: searchParams.maxPrice,
    inStock: searchParams.stock === "1",
    sort: searchParams.sort,
    page: searchParams.page,
  })

  const { hits, totalHits, totalPages, page } = result
  const scopeCategory = translateCategory(result.scopeCategory, locale)
  const facets = {
    ...result.facets,
    categories: result.facets.categories.map((facet) => ({
      ...facet,
      name: translateCategory(facet, locale).name,
    })),
  }

  const title = scopeCategory?.name || (searchParams.q ? `"${searchParams.q}"` : dict.plp.search)
  const breadcrumbs = [
    { label: dict.nav.home, href: "/" },
    scopeCategory
      ? { label: scopeCategory.name }
      : { label: dict.plp.search, href: "/search" },
  ]

  return (
    <div className="mx-auto w-full md:max-w-container-md">
      <div className="relative flex w-full items-center justify-center gap-10 p-4 md:px-0 md:pt-8">
        <div className="mx-auto w-full">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      </div>

      {scopeCategory?.description && (
        <p className="px-4 pb-2 text-muted-foreground md:px-0">{scopeCategory.description}</p>
      )}

      <div className="sticky top-[60px] z-40 flex items-center justify-between bg-white/80 p-4 backdrop-blur-lg lg:hidden">
        <div className="flex items-baseline gap-2 text-2xl font-semibold tracking-tight">
          <h1>{title}</h1>
          <span className="text-lg text-muted-foreground">({totalHits})</span>
        </div>
        <FacetsMobile facets={facets} hideCategories={false} />
      </div>

      <div className="flex gap-12 p-4 md:gap-12 xl:px-0">
        <aside className="sticky top-[84px] hidden h-fit max-h-[85dvh] w-full max-w-64 overflow-y-auto lg:block">
          <div className="flex items-baseline gap-2 pb-6 font-semibold tracking-tight">
            <h1 className="text-3xl lg:text-4xl">{title}</h1>
            <span className="text-xl text-muted-foreground">({totalHits})</span>
          </div>
          <FacetsDesktop facets={facets} hideCategories={false} />
        </aside>

        <div className="w-full">
          <div className="flex justify-end pb-4">
            <Sorter />
          </div>

          {hits.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground">{dict.plp.no_results}</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {hits.map((product) => (
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

          <Pagination page={page} totalPages={totalPages} />
        </div>
      </div>
    </div>
  )
}
