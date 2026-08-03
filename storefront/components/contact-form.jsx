"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useI18n } from "@/components/i18n-provider"

/** Simple front-end contact form; wire it to email later if needed. */
export const ContactForm = () => {
  const { dict } = useI18n()
  const [sent, setSent] = useState(false)

  if (sent) {
    return <p className="mt-8 rounded-md bg-green-50 p-4 text-green-800">{dict.contact.sent}</p>
  }

  return (
    <form
      className="mt-8 max-w-lg space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        setSent(true)
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="contact-name">{dict.contact.name}</Label>
        <Input id="contact-name" name="name" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-email">{dict.contact.email}</Label>
        <Input id="contact-email" name="email" type="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-message">{dict.contact.message}</Label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <Button type="submit">{dict.contact.send}</Button>
    </form>
  )
}
