import { Clock, Mail, MapPin, Phone } from "lucide-react"
import { getI18n } from "@/lib/i18n"

export const metadata = { title: "About Us" }

const AboutPage = async () => {
  const { dict } = await getI18n()

  const rows = [
    { icon: MapPin, value: dict.about.address },
    { icon: Mail, value: dict.about.email, href: `mailto:${dict.about.email}` },
    { icon: Phone, value: dict.about.phone, href: `tel:${dict.about.phone.replace(/\s/g, "")}` },
    { icon: Clock, value: dict.about.hours },
  ]

  return (
    <div className="mx-auto max-w-container-sm px-4 py-12 md:py-20">
      <h1 className="text-4xl font-bold tracking-tight">{dict.about.title}</h1>
      <div className="mt-6 space-y-4 text-lg leading-relaxed text-muted-foreground">
        <p>{dict.about.body_1}</p>
        <p>{dict.about.body_2}</p>
      </div>

      <h2 className="mt-12 text-2xl font-semibold">{dict.about.contact_title}</h2>
      <ul className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <li key={index} className="flex items-center gap-3 text-muted-foreground">
            <row.icon className="size-5 shrink-0" />
            {row.href ? (
              <a href={row.href} className="hover:text-foreground hover:underline">
                {row.value}
              </a>
            ) : (
              <span>{row.value}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default AboutPage
