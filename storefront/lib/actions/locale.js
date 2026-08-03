"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { LOCALE_COOKIE_NAME } from "@/lib/data/cookies"

export const setLocale = async (locale) => {
  const store = await cookies()
  store.set(LOCALE_COOKIE_NAME, locale === "en" ? "en" : "sq", {
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  })
  revalidatePath("/", "layout")
}
