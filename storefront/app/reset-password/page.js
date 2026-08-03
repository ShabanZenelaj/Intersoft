import Link from "next/link"
import { Suspense } from "react"
import { ResetPasswordForm } from "@/components/auth/auth-forms"
import { buttonVariants } from "@/components/ui/button"
import { getI18n } from "@/lib/i18n"

export const metadata = { title: "New password" }

const ResetPasswordPage = async (props) => {
  const searchParams = await props.searchParams
  const { dict } = await getI18n()
  const token = searchParams?.token

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">{dict.auth.reset_title}</h1>
      {token ? (
        <Suspense>
          <ResetPasswordForm token={token} />
        </Suspense>
      ) : (
        <div className="space-y-4">
          <p className="text-destructive">{dict.auth.reset_link_invalid}</p>
          <Link href="/forgot-password" className={buttonVariants()}>
            {dict.auth.forgot_cta}
          </Link>
        </div>
      )}
    </div>
  )
}

export default ResetPasswordPage
