import { ContactForm } from "@/components/contact-form"
import { getI18n } from "@/lib/i18n"

export const metadata = { title: "Contact" }

const ContactPage = async () => {
  const { dict } = await getI18n()

  return (
    <div className="mx-auto max-w-container-sm px-4 py-12 md:py-20">
      <h1 className="text-4xl font-bold tracking-tight">{dict.contact.title}</h1>
      <p className="mt-2 text-lg text-muted-foreground">{dict.contact.subtitle}</p>
      <ContactForm />
    </div>
  )
}

export default ContactPage
