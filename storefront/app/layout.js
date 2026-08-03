import { Inter } from "next/font/google"
import { Toaster } from "sonner"
import "./globals.css"

import { CartProvider } from "@/components/cart/cart-provider"
import { CartSheet } from "@/components/cart/cart-sheet"
import { Footer } from "@/components/footer"
import { I18nProvider } from "@/components/i18n-provider"
import { NavigationBar } from "@/components/navigation/navigation-bar"
import { retrieveCart } from "@/lib/data/cart"
import { getCategoryTree } from "@/lib/data/categories"
import { getCustomer } from "@/lib/data/customer"
import { getI18n } from "@/lib/i18n"
import { translateCategory } from "@/lib/utils"

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter" })

export const generateMetadata = async () => {
  const { dict } = await getI18n()
  return {
    title: { default: dict.meta.title, template: "%s | Intersoft" },
    description: dict.meta.description,
  }
}

const RootLayout = async ({ children }) => {
  const { locale, dict } = await getI18n()
  const [categoryTree, cart, customer] = await Promise.all([getCategoryTree(), retrieveCart(), getCustomer()])
  const categories = categoryTree.map((category) => translateCategory(category, locale))

  return (
    <html lang={locale}>
      <body className={`${inter.variable} font-sans`}>
        <I18nProvider locale={locale} dict={dict}>
          <CartProvider initialCart={cart}>
            <NavigationBar categories={categories} isLoggedIn={!!customer} customerName={customer?.first_name} />
            <main className="min-h-[60vh]">{children}</main>
            <Footer dict={dict} categories={categories} />
            <CartSheet />
            <Toaster position="bottom-left" />
          </CartProvider>
        </I18nProvider>
      </body>
    </html>
  )
}

export default RootLayout
