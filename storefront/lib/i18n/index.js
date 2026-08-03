import "server-only"
import en from "./en.json"
import sq from "./sq.json"
import { getLocale } from "@/lib/data/cookies"

const dictionaries = { en, sq }

export const getI18n = async () => {
  const locale = await getLocale()
  return { locale, dict: dictionaries[locale] || sq }
}
