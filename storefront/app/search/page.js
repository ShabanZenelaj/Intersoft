import { SearchView } from "@/components/search-view"

export const metadata = {
  title: "Search",
  description: "Search Intersoft's catalog of PCs, components and peripherals.",
}

const SearchPage = async (props) => {
  const searchParams = await props.searchParams
  return <SearchView searchParams={searchParams} />
}

export default SearchPage
