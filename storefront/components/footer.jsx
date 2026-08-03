import Link from "next/link"
import { Facebook, Instagram, Youtube } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/** Footer ported from the template, adapted for Intersoft. `dict` comes from the server layout. */
export const Footer = ({ dict, categories = [] }) => (
  <footer className="border-t bg-white text-muted-foreground">
    <div className="mx-auto max-w-container-md px-6 py-12">
      <div className="grid gap-8 sm:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-primary">{dict.footer.newsletter_title}</h3>
          <p>{dict.footer.newsletter_text}</p>
          <form className="space-y-2 sm:max-w-md">
            <Input type="email" placeholder={dict.footer.newsletter_placeholder} aria-label={dict.footer.newsletter_placeholder} />
            <Button type="submit" className="w-full transition-[transform,background] duration-200 hover:bg-black/85 active:scale-[0.99]">
              {dict.footer.newsletter_cta}
            </Button>
          </form>
        </div>
        <div className="flex justify-start gap-16 sm:justify-end lg:gap-24">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-primary">{dict.footer.shop}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/search" className="transition-colors hover:text-gray-700" prefetch={false}>
                  {dict.footer.all_products}
                </Link>
              </li>
              {categories.slice(0, 4).map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/category/${category.handle}`}
                    className="transition-colors hover:text-gray-700"
                    prefetch={false}
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-primary">{dict.footer.support}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="transition-colors hover:text-gray-700" prefetch={false}>
                  {dict.footer.about}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="transition-colors hover:text-gray-700" prefetch={false}>
                  {dict.footer.contact}
                </Link>
              </li>
              <li>
                <Link href="/track" className="transition-colors hover:text-gray-700" prefetch={false}>
                  {dict.order.track_title}
                </Link>
              </li>
              <li>
                <Link href="/account/orders" className="transition-colors hover:text-gray-700" prefetch={false}>
                  {dict.account.orders}
                </Link>
              </li>
              <li>
                <a href="mailto:support@intersoft-rks.com" className="transition-colors hover:text-gray-700">
                  support@intersoft-rks.com
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="mt-8 border-t border-muted-foreground/20 pt-8">
        <div className="flex flex-col items-center justify-between space-y-4 md:flex-row md:space-y-0">
          <div className="flex space-x-4">
            <a href="#" className="transition-colors hover:text-primary" aria-label="Facebook">
              <Facebook className="size-5" />
            </a>
            <a href="#" className="transition-colors hover:text-primary" aria-label="Instagram">
              <Instagram className="size-5" />
            </a>
            <a href="#" className="transition-colors hover:text-primary" aria-label="YouTube">
              <Youtube className="size-5" />
            </a>
          </div>
          <div className="text-sm">
            © {new Date().getFullYear()} Intersoft. {dict.footer.rights}
          </div>
        </div>
      </div>
    </div>
  </footer>
)
