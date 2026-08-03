import { redirect } from "next/navigation"
import { CheckoutFlow } from "@/components/checkout/checkout-flow"
import { COUNTRIES } from "@/lib/countries"
import { PAYMENT_METHODS, retrieveCart } from "@/lib/data/cart"
import { getCustomer } from "@/lib/data/customer"
import { getI18n } from "@/lib/i18n"

export const metadata = { title: "Checkout" }

const CheckoutPage = async () => {
  const { dict } = await getI18n()
  const [cart, customer] = await Promise.all([retrieveCart(), getCustomer()])

  if (!cart || !(cart.items || []).length) {
    redirect("/cart")
  }

  return (
    <div className="mx-auto max-w-container-md px-4 py-8 md:py-12">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">{dict.checkout.title}</h1>
      <CheckoutFlow
        initialCart={cart}
        countries={COUNTRIES}
        paymentProviders={PAYMENT_METHODS}
        customer={
          customer
            ? {
                email: customer.email,
                first_name: customer.first_name,
                last_name: customer.last_name,
                phone: customer.phone,
                address: customer.default_address || null,
              }
            : null
        }
      />
    </div>
  )
}

export default CheckoutPage
