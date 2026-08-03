import { redirect } from "next/navigation"
import { Suspense } from "react"
import { RegisterForm } from "@/components/auth/auth-forms"
import { getCustomer } from "@/lib/data/customer"
import { getI18n } from "@/lib/i18n"

export const metadata = { title: "Create Account" }

const RegisterPage = async () => {
  const { dict } = await getI18n()
  const customer = await getCustomer()
  if (customer) redirect("/account")

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">{dict.auth.register_title}</h1>
      <p className="mb-8 mt-2 text-muted-foreground">{dict.auth.register_subtitle}</p>
      <Suspense>
        <RegisterForm />
      </Suspense>
    </div>
  )
}

export default RegisterPage
