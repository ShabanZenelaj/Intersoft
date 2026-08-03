import { redirect } from "next/navigation"
import { Suspense } from "react"
import { LoginForm } from "@/components/auth/auth-forms"
import { getCustomer } from "@/lib/data/customer"
import { getI18n } from "@/lib/i18n"

export const metadata = { title: "Sign In" }

const LoginPage = async () => {
  const { dict } = await getI18n()
  const customer = await getCustomer()
  if (customer) redirect("/account")

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">{dict.auth.login_title}</h1>
      <p className="mb-8 mt-2 text-muted-foreground">{dict.auth.login_subtitle}</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}

export default LoginPage
