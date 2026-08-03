import { PaymentResult } from "@/components/order/payment-result"

export const metadata = { title: "Payment" }

/** RaiAccept sends the shopper here after the payment window closes. */
const Page = async (props) => {
  const params = await props.params
  return <PaymentResult orderId={params.id} outcome="paid" />
}

export default Page
