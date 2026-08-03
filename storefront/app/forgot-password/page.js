import { Suspense } from "react"
import { ForgotPasswordForm } from "@/components/auth/auth-forms"
import { getI18n } from "@/lib/i18n"

export const metadata = { title: "Reset password" }

const ForgotPasswordPage = async () => {
  const { dict } = await getI18n()

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">{dict.auth.forgot_title}</h1>
      <p className="mb-8 mt-2 text-muted-foreground">{dict.auth.forgot_subtitle}</p>
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </div>
  )
}

export default ForgotPasswordPage
