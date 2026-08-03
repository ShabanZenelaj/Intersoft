import { TrackOrderView } from "@/components/order/track-order-view"
import { getI18n } from "@/lib/i18n"

export const metadata = { title: "Track your order" }

const TrackPage = async () => {
  const { dict } = await getI18n()

  return (
    <div className="mx-auto max-w-container-sm px-4 py-12 md:py-16">
      <h1 className="text-3xl font-bold tracking-tight">{dict.order.track_title}</h1>
      <p className="mb-8 mt-2 text-muted-foreground">{dict.order.track_subtitle}</p>
      <TrackOrderView />
    </div>
  )
}

export default TrackPage
