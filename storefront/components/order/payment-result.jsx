"use client"

import { CheckCircle2, Clock, XCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useI18n } from "@/components/i18n-provider"
import { buttonVariants } from "@/components/ui/button"
import { checkPaymentStatus } from "@/lib/actions/checkout"
import { cn } from "@/lib/utils"

/**
 * Where the shopper lands after the RaiAccept payment window.
 *
 * The bank's redirect is only a hint — their documentation is explicit that it
 * does not reflect the real result — so a "paid" landing still asks our API,
 * which asks RaiAccept. The webhook usually settles the order first, but it can
 * arrive a moment later, so this polls briefly rather than guessing.
 */
export const PaymentResult = ({ orderId, outcome }) => {
  const { dict } = useI18n()
  const router = useRouter()
  const [state, setState] = useState(outcome === "paid" ? "checking" : outcome)

  useEffect(() => {
    if (outcome !== "paid") return undefined
    let alive = true
    let attempts = 0

    const poll = async () => {
      attempts += 1
      const result = await checkPaymentStatus(orderId)
      if (!alive) return
      if (result?.paid) {
        setState("paid")
        router.replace(`/order/confirmed/${orderId}`)
        return
      }
      // ~10 seconds is plenty for the webhook; after that show the pending
      // note rather than spinning forever.
      if (attempts >= 6) {
        setState("pending")
        return
      }
      setTimeout(poll, 1600)
    }

    poll()
    return () => {
      alive = false
    }
  }, [orderId, outcome, router])

  const views = {
    checking: {
      icon: Clock,
      tone: "text-muted-foreground",
      title: dict.payment.checking_title,
      body: dict.payment.checking_body,
    },
    pending: {
      icon: Clock,
      tone: "text-amber-600",
      title: dict.payment.pending_title,
      body: dict.payment.pending_body,
    },
    paid: {
      icon: CheckCircle2,
      tone: "text-green-600",
      title: dict.payment.paid_title,
      body: dict.payment.paid_body,
    },
    failed: {
      icon: XCircle,
      tone: "text-destructive",
      title: dict.payment.failed_title,
      body: dict.payment.failed_body,
    },
    canceled: {
      icon: XCircle,
      tone: "text-muted-foreground",
      title: dict.payment.canceled_title,
      body: dict.payment.canceled_body,
    },
  }

  const view = views[state] || views.pending
  const Icon = view.icon

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <Icon className={cn("mx-auto mb-5 size-12", view.tone, state === "checking" && "animate-pulse")} />
      <h1 className="text-2xl font-bold tracking-tight">{view.title}</h1>
      <p className="mt-2 text-muted-foreground">{view.body}</p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {(state === "failed" || state === "canceled") && (
          <Link href="/cart" className={buttonVariants()}>
            {dict.payment.try_again}
          </Link>
        )}
        {(state === "pending" || state === "paid") && (
          <Link href={`/order/confirmed/${orderId}`} className={buttonVariants()}>
            {dict.order.view_orders}
          </Link>
        )}
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          {dict.order.back_home}
        </Link>
      </div>
    </div>
  )
}
