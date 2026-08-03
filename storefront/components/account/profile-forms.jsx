"use client"

import { Eye, EyeOff } from "lucide-react"
import { useActionState, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updatePassword, updateProfile } from "@/lib/actions/auth"

/**
 * Success is a toast (it survives the page scroll position); errors stay next
 * to the button that caused them so they are never missed.
 */
const useFormFeedback = (state, successMessage) => {
  const { dict } = useI18n()
  const seen = useRef(state)

  useEffect(() => {
    if (state !== seen.current && state?.success) toast.success(successMessage)
    seen.current = state
  }, [state, successMessage])

  if (!state?.error) return null
  return <p className="text-sm font-medium text-destructive">{dict.account[state.error] || dict.common.error}</p>
}

const Field = ({ id, label, hint, children }) => (
  <div className="space-y-1.5">
    <Label htmlFor={id}>{label}</Label>
    {children}
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
)

const CardShell = ({ title, description, children }) => (
  <section className="rounded-xl border bg-white">
    <div className="border-b px-6 py-4">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
    </div>
    {children}
  </section>
)

export const ProfileForm = ({ customer, countries = [] }) => {
  const { dict } = useI18n()
  const [state, action, pending] = useActionState(updateProfile, {})
  const feedback = useFormFeedback(state, dict.account.saved)
  const address = customer.default_address || {}

  return (
    <form action={action} className="space-y-6">
      <CardShell title={dict.account.personal_data} description={dict.account.personal_data_hint}>
        <div className="space-y-4 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pf-first" label={dict.auth.first_name}>
              <Input id="pf-first" name="first_name" defaultValue={customer.first_name || ""} required />
            </Field>
            <Field id="pf-last" label={dict.auth.last_name}>
              <Input id="pf-last" name="last_name" defaultValue={customer.last_name || ""} required />
            </Field>
          </div>
          <Field id="pf-email" label={dict.auth.email} hint={dict.account.email_locked}>
            <Input id="pf-email" type="email" defaultValue={customer.email} disabled className="bg-secondary/40" />
          </Field>
          <Field id="pf-phone" label={dict.auth.phone}>
            <Input id="pf-phone" name="phone" type="tel" defaultValue={customer.phone || ""} />
          </Field>
        </div>
      </CardShell>

      {/* Saved address — prefills checkout next time. */}
      <CardShell title={dict.account.saved_address} description={dict.account.saved_address_hint}>
        <div className="space-y-4 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ad-first" label={dict.checkout.first_name}>
              <Input
                id="ad-first"
                name="address_first_name"
                defaultValue={address.first_name || customer.first_name || ""}
              />
            </Field>
            <Field id="ad-last" label={dict.checkout.last_name}>
              <Input
                id="ad-last"
                name="address_last_name"
                defaultValue={address.last_name || customer.last_name || ""}
              />
            </Field>
          </div>
          <Field id="ad-address" label={dict.checkout.address}>
            <Input id="ad-address" name="address_1" defaultValue={address.address_1 || ""} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ad-city" label={dict.checkout.city}>
              <Input id="ad-city" name="city" defaultValue={address.city || ""} />
            </Field>
            <Field id="ad-postal" label={dict.checkout.postal_code}>
              <Input id="ad-postal" name="postal_code" defaultValue={address.postal_code || ""} />
            </Field>
            <Field id="ad-country" label={dict.checkout.country}>
              <select
                id="ad-country"
                name="country_code"
                defaultValue={address.country_code || "xk"}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {countries.map((country) => (
                  <option key={country.iso_2} value={country.iso_2}>
                    {country.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="ad-phone" label={dict.checkout.phone}>
              <Input id="ad-phone" name="address_phone" defaultValue={address.phone || ""} />
            </Field>
          </div>
        </div>
      </CardShell>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" isLoading={pending}>
          {dict.account.save}
        </Button>
        {feedback}
      </div>
    </form>
  )
}

export const PasswordForm = () => {
  const { dict } = useI18n()
  const [state, action, pending] = useActionState(updatePassword, {})
  const feedback = useFormFeedback(state, dict.account.password_updated)
  const [visible, setVisible] = useState(false)
  const formRef = useRef(null)

  // A saved password should leave empty boxes behind, not the one just set.
  useEffect(() => {
    if (state?.success) formRef.current?.reset()
  }, [state])

  return (
    <form action={action} ref={formRef}>
      <CardShell title={dict.account.change_password} description={dict.account.password_hint}>
        <div className="space-y-4 px-6 py-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="pw-new">{dict.account.new_password}</Label>
              <button
                type="button"
                onClick={() => setVisible((current) => !current)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                {visible ? dict.account.hide_password : dict.account.show_password}
              </button>
            </div>
            <Input
              id="pw-new"
              name="password"
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
          <Field id="pw-confirm" label={dict.auth.confirm_password}>
            <Input
              id="pw-confirm"
              name="confirm_password"
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              required
            />
          </Field>
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <Button type="submit" isLoading={pending}>
              {dict.account.change_password}
            </Button>
            {feedback}
          </div>
        </div>
      </CardShell>
    </form>
  )
}
