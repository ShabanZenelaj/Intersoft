import { ProfileForm } from "@/components/account/profile-forms"
import { PageHeader } from "@/components/account/ui"
import { COUNTRIES } from "@/lib/countries"
import { getCustomer } from "@/lib/data/customer"
import { getI18n } from "@/lib/i18n"

export const metadata = { title: "Profile" }

const ProfilePage = async () => {
  const { dict } = await getI18n()
  const customer = await getCustomer()

  return (
    <>
      {/* Each card carries its own explanation, so the header stays a plain title. */}
      <PageHeader title={dict.account.profile} />
      <ProfileForm customer={customer} countries={COUNTRIES} />
    </>
  )
}

export default ProfilePage
