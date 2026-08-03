import { PasswordForm } from "@/components/account/profile-forms"
import { PageHeader } from "@/components/account/ui"
import { getI18n } from "@/lib/i18n"

export const metadata = { title: "Password" }

const PasswordPage = async () => {
  const { dict } = await getI18n()

  return (
    <>
      {/* The card below repeats the rules next to the fields, so no subtitle here. */}
      <PageHeader title={dict.account.security} />
      <PasswordForm />
    </>
  )
}

export default PasswordPage
