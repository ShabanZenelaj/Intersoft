"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { Banknote, Check, CreditCard, Smartphone, Truck } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { useCart } from "@/components/cart/cart-provider"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { initiatePayment, placeOrder, setCheckoutDetails } from "@/lib/actions/checkout"
import { cn, formatPrice, shipmentDescription, shipmentName } from "@/lib/utils"

const PAYMENT_META = {
  cod: { icon: Banknote, labelKey: "payment_cod", descKey: "payment_cod_desc" },
  pos: { icon: Smartphone, labelKey: "payment_pos", descKey: "payment_pos_desc" },
  card: { icon: CreditCard, labelKey: "payment_card", descKey: "payment_card_desc" },
}

const StepHeader = ({ index, title, done, active, onEdit, dict }) => (
  <div className="flex items-center justify-between">
    <h2 className={cn("flex items-center gap-3 text-lg font-semibold", !active && !done && "text-muted-foreground")}>
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-full border text-sm",
          done ? "border-green-600 bg-green-600 text-white" : active ? "border-black bg-black text-white" : ""
        )}
      >
        {done ? <Check className="size-4" /> : index}
      </span>
      {title}
    </h2>
    {done && !active && onEdit && (
      <button className="text-sm underline underline-offset-4 hover:no-underline" onClick={onEdit}>
        {dict.checkout.edit}
      </button>
    )}
  </div>
)

/**
 * Delivery is not chosen by the shopper: every product carries its own
 * shipping option (from its supplier), so the cart is split into one shipment
 * per distinct option and each is charged once.
 */
const DeliverySummary = ({ shipments, locale, dict }) => (
  <div className="space-y-3">
    <p className="text-sm text-muted-foreground">{dict.checkout.delivery_auto}</p>
    {shipments.map((shipment) => (
      <div key={shipment.shipping_method_id} className="flex items-start justify-between gap-4 rounded-md border p-4">
        <div className="flex gap-3">
          <Truck className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div>
            <span className="block text-sm font-medium">{shipmentName(shipment, locale)}</span>
            {shipmentDescription(shipment, locale) && (
              <span className="block text-xs text-muted-foreground">{shipmentDescription(shipment, locale)}</span>
            )}
            {!!shipment.products?.length && (
              <span className="mt-1 block text-xs text-muted-foreground">
                {dict.checkout.delivery_items}: {shipment.products.join(", ")}
              </span>
            )}
          </div>
        </div>
        <span className="whitespace-nowrap text-sm font-semibold">{formatPrice(shipment.amount, locale)}</span>
      </div>
    ))}
  </div>
)

export const CheckoutFlow = ({ initialCart, countries, paymentProviders, customer }) => {
  const { locale, dict } = useI18n()
  const router = useRouter()
  const { setCart: setGlobalCart } = useCart()
  const [cart, setCart] = useState(initialCart)
  const [step, setStep] = useState(1)
  const [pending, startTransition] = useTransition()

  // Prefill from the cart, then the customer's saved address, then their profile.
  const address = cart.shipping_address || customer?.address || {}
  const [form, setForm] = useState({
    email: cart.email || customer?.email || "",
    first_name: address.first_name || customer?.first_name || "",
    last_name: address.last_name || customer?.last_name || "",
    address_1: address.address_1 || "",
    city: address.city || "",
    postal_code: address.postal_code || "",
    country_code: address.country_code || countries[0]?.iso_2 || "al",
    phone: address.phone || customer?.phone || "",
  })

  const [selectedProvider, setSelectedProvider] = useState(cart.payment_method || paymentProviders[0] || null)

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  const submitDetails = (event) => {
    event.preventDefault()
    startTransition(async () => {
      const { email, ...addressFields } = form
      const result = await setCheckoutDetails({ email, address: addressFields })
      if (result.error) {
        toast.error(dict.checkout.error_generic)
        return
      }
      setCart(result.cart)
      setStep(2)
    })
  }

  const submitPayment = () => {
    if (!selectedProvider) return
    startTransition(async () => {
      const result = await initiatePayment(selectedProvider)
      if (result.error) {
        toast.error(dict.checkout.error_generic)
        return
      }
      setStep(3)
    })
  }

  const submitOrder = () => {
    startTransition(async () => {
      const result = await placeOrder()
      if (result.error) {
        toast.error(result.error)
        return
      }
      setGlobalCart(null)
      // Card orders finish at the bank's payment window, not here.
      if (result.paymentUrl) {
        window.location.href = result.paymentUrl
        return
      }
      router.push(`/order/confirmed/${result.order.id}`)
    })
  }

  const fieldClass = "space-y-1.5"
  const shipments = cart.shipping_methods || []

  return (
    <div className="grid gap-10 lg:grid-cols-3">
      <div className="space-y-8 lg:col-span-2">
        {/* Step 1: contact & address */}
        <section className="rounded-lg border p-6">
          <StepHeader index={1} title={dict.checkout.step_details} done={step > 1} active={step === 1} onEdit={() => setStep(1)} dict={dict} />
          {step === 1 && (
            <form onSubmit={submitDetails} className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className={cn(fieldClass, "sm:col-span-2")}>
                <Label htmlFor="co-email">{dict.checkout.email}</Label>
                <Input id="co-email" type="email" required value={form.email} onChange={update("email")} />
              </div>
              <div className={fieldClass}>
                <Label htmlFor="co-first">{dict.checkout.first_name}</Label>
                <Input id="co-first" required value={form.first_name} onChange={update("first_name")} />
              </div>
              <div className={fieldClass}>
                <Label htmlFor="co-last">{dict.checkout.last_name}</Label>
                <Input id="co-last" required value={form.last_name} onChange={update("last_name")} />
              </div>
              <div className={cn(fieldClass, "sm:col-span-2")}>
                <Label htmlFor="co-address">{dict.checkout.address}</Label>
                <Input id="co-address" required value={form.address_1} onChange={update("address_1")} />
              </div>
              <div className={fieldClass}>
                <Label htmlFor="co-city">{dict.checkout.city}</Label>
                <Input id="co-city" required value={form.city} onChange={update("city")} />
              </div>
              <div className={fieldClass}>
                <Label htmlFor="co-postal">{dict.checkout.postal_code}</Label>
                <Input id="co-postal" required value={form.postal_code} onChange={update("postal_code")} />
              </div>
              <div className={fieldClass}>
                <Label htmlFor="co-country">{dict.checkout.country}</Label>
                <select
                  id="co-country"
                  value={form.country_code}
                  onChange={update("country_code")}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  {countries.map((country) => (
                    <option key={country.iso_2} value={country.iso_2}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={fieldClass}>
                <Label htmlFor="co-phone">{dict.checkout.phone}</Label>
                <Input id="co-phone" value={form.phone} onChange={update("phone")} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" isLoading={pending}>
                  {dict.checkout.continue}
                </Button>
              </div>
            </form>
          )}
          {step > 1 && (
            <p className="mt-3 text-sm text-muted-foreground">
              {form.email} · {form.first_name} {form.last_name}, {form.address_1}, {form.city}
            </p>
          )}
        </section>

        {/* Delivery — informational, derived from the products */}
        <section className="rounded-lg border p-6">
          <h2 className="flex items-center gap-3 text-lg font-semibold">
            <Truck className="size-5 text-muted-foreground" />
            {dict.checkout.step_shipping}
          </h2>
          <div className="mt-4">
            <DeliverySummary shipments={shipments} locale={locale} dict={dict} />
          </div>
        </section>

        {/* Step 2: payment */}
        <section className="rounded-lg border p-6">
          <StepHeader index={2} title={dict.checkout.step_payment} done={step > 2} active={step === 2} onEdit={() => setStep(2)} dict={dict} />
          {step === 2 && (
            <div className="mt-6 space-y-3">
              {paymentProviders.map((providerId) => {
                const meta = PAYMENT_META[providerId]
                if (!meta) return null
                const Icon = meta.icon
                return (
                  <label
                    key={providerId}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md border p-4 transition-colors",
                      selectedProvider === providerId ? "border-black ring-1 ring-black" : "hover:border-black/40"
                    )}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={selectedProvider === providerId}
                      onChange={() => setSelectedProvider(providerId)}
                      className="accent-black"
                    />
                    <Icon className="size-5 shrink-0" />
                    <span>
                      <span className="block text-sm font-medium">{dict.checkout[meta.labelKey]}</span>
                      <span className="block text-xs text-muted-foreground">{dict.checkout[meta.descKey]}</span>
                    </span>
                  </label>
                )
              })}
              <Button onClick={submitPayment} disabled={!selectedProvider} isLoading={pending}>
                {dict.checkout.continue}
              </Button>
            </div>
          )}
          {step > 2 && selectedProvider && PAYMENT_META[selectedProvider] && (
            <p className="mt-3 text-sm text-muted-foreground">{dict.checkout[PAYMENT_META[selectedProvider].labelKey]}</p>
          )}
        </section>

        {/* Step 3: review */}
        {step === 3 && (
          <section className="rounded-lg border p-6">
            <StepHeader index={3} title={dict.checkout.step_review} done={false} active dict={dict} />
            <div className="mt-6">
              <Button size="lg" onClick={submitOrder} isLoading={pending}>
                {pending ? dict.checkout.placing_order : dict.checkout.place_order}
              </Button>
            </div>
          </section>
        )}
      </div>

      {/* Order summary */}
      <aside className="h-fit space-y-4 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">{dict.checkout.order_summary}</h2>
        <div className="divide-y">
          {(cart.items || []).map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-3">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-secondary/30">
                {item.thumbnail && <Image src={item.thumbnail} alt="" fill sizes="56px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium">{item.product_title}</p>
                <p className="text-xs text-muted-foreground">× {item.quantity}</p>
              </div>
              <span className="text-sm font-medium">{formatPrice(item.total, locale)}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{dict.cart.subtotal}</span>
            <span>{formatPrice(cart.item_total, locale)}</span>
          </div>
          {(cart.discounts || []).map((discount) => (
            <div key={discount.id} className="flex justify-between text-green-700">
              <span>{discount.is_shipping ? dict.cart.free_shipping : discount.name}</span>
              <span>-{formatPrice(discount.amount, locale)}</span>
            </div>
          ))}
          {shipments.map((shipment) => (
            <div key={shipment.shipping_method_id} className="flex justify-between">
              <span className="text-muted-foreground">
                {dict.cart.shipping} · {shipmentName(shipment, locale)}
              </span>
              <span>{formatPrice(shipment.amount, locale)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t pt-4 text-lg font-semibold">
          <span>{dict.cart.total}</span>
          <span>{formatPrice(cart.total, locale)}</span>
        </div>
      </aside>
    </div>
  )
}
