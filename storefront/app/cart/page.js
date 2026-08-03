import { CartView } from "@/components/cart/cart-view"
import { getI18n } from "@/lib/i18n"

export const metadata = { title: "Cart" }

const CartPage = async () => {
  const { dict } = await getI18n()

  return (
    <div className="mx-auto max-w-container-sm px-4 py-8 md:py-12">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">{dict.cart.title}</h1>
      <CartView />
    </div>
  )
}

export default CartPage
