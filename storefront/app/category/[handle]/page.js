import { notFound } from "next/navigation"
import { SearchView } from "@/components/search-view"
import { getCategoryByHandle } from "@/lib/data/categories"

export const generateMetadata = async (props) => {
  const params = await props.params
  const category = await getCategoryByHandle(params.handle)
  if (!category) return { title: "Category" }
  return { title: category.name, description: category.description }
}

const CategoryPage = async (props) => {
  const [params, searchParams] = await Promise.all([props.params, props.searchParams])
  const category = await getCategoryByHandle(params.handle)
  if (!category) return notFound()
  return <SearchView searchParams={searchParams} categoryHandle={params.handle} />
}

export default CategoryPage
