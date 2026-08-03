"use client"

import { createContext, useContext } from "react"

const I18nContext = createContext({ locale: "en", dict: {} })

export const I18nProvider = ({ locale, dict, children }) => (
  <I18nContext.Provider value={{ locale, dict }}>{children}</I18nContext.Provider>
)

export const useI18n = () => useContext(I18nContext)
