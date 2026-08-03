"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useActionState } from "react"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { login, register, requestPasswordReset, resetPassword } from "@/lib/actions/auth"

const FormError = ({ error, dict }) => {
  if (!error) return null
  const known = dict.auth[error] || dict.account[error]
  return <p className="text-sm text-destructive">{known || dict.auth.registration_failed}</p>
}

export const LoginForm = () => {
  const { dict } = useI18n()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") || ""
  const [state, action, pending] = useActionState(login, {})

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1.5">
        <Label htmlFor="login-email">{dict.auth.email}</Label>
        <Input id="login-email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="login-password">{dict.auth.password}</Label>
          <Link href="/forgot-password" className="text-xs text-muted-foreground underline underline-offset-4">
            {dict.auth.forgot_password}
          </Link>
        </div>
        <Input id="login-password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <FormError error={state?.error} dict={dict} />
      <Button type="submit" className="w-full" isLoading={pending}>
        {dict.auth.sign_in}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {dict.auth.no_account}{" "}
        <Link
          href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
          className="font-medium text-foreground underline underline-offset-4"
        >
          {dict.auth.sign_up}
        </Link>
      </p>
      <p className="text-center text-sm">
        <Link href="/track" className="text-muted-foreground underline underline-offset-4">
          {dict.auth.track_order}
        </Link>
      </p>
    </form>
  )
}

/**
 * Also used on the order confirmation page: `claimOrderId` attaches that order
 * to the new account, and `defaultEmail` prefills the address they ordered with.
 */
export const RegisterForm = ({ claimOrderId, defaultEmail, defaultFirstName, defaultLastName, next, compact }) => {
  const { dict } = useI18n()
  const searchParams = useSearchParams()
  const [state, action, pending] = useActionState(register, {})
  const redirectTo = next || searchParams.get("next") || ""

  return (
    <form action={action} className="space-y-4">
      {claimOrderId && <input type="hidden" name="claim_order_id" value={claimOrderId} />}
      <input type="hidden" name="next" value={redirectTo} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="reg-first">{dict.auth.first_name}</Label>
          <Input id="reg-first" name="first_name" autoComplete="given-name" defaultValue={defaultFirstName} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reg-last">{dict.auth.last_name}</Label>
          <Input id="reg-last" name="last_name" autoComplete="family-name" defaultValue={defaultLastName} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reg-email">{dict.auth.email}</Label>
        <Input id="reg-email" name="email" type="email" autoComplete="email" defaultValue={defaultEmail} required />
      </div>
      {!compact && (
        <div className="space-y-1.5">
          <Label htmlFor="reg-phone">{dict.auth.phone}</Label>
          <Input id="reg-phone" name="phone" type="tel" autoComplete="tel" />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="reg-password">{dict.auth.password}</Label>
        <Input id="reg-password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <FormError error={state?.error} dict={dict} />
      <Button type="submit" className="w-full" isLoading={pending}>
        {compact ? dict.order.create_account_cta : dict.auth.sign_up}
      </Button>
      {!compact && (
        <p className="text-center text-sm text-muted-foreground">
          {dict.auth.have_account}{" "}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            {dict.auth.sign_in}
          </Link>
        </p>
      )}
    </form>
  )
}

export const ForgotPasswordForm = () => {
  const { dict } = useI18n()
  const [state, action, pending] = useActionState(requestPasswordReset, {})

  if (state?.success) {
    return <p className="rounded-md bg-green-50 p-4 text-sm text-green-800">{dict.auth.forgot_sent}</p>
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="forgot-email">{dict.auth.email}</Label>
        <Input id="forgot-email" name="email" type="email" autoComplete="email" required />
      </div>
      <FormError error={state?.error} dict={dict} />
      <Button type="submit" className="w-full" isLoading={pending}>
        {dict.auth.forgot_cta}
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-muted-foreground underline underline-offset-4">
          {dict.auth.sign_in}
        </Link>
      </p>
    </form>
  )
}

export const ResetPasswordForm = ({ token }) => {
  const { dict } = useI18n()
  const [state, action, pending] = useActionState(resetPassword, {})

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-1.5">
        <Label htmlFor="reset-password">{dict.account.new_password}</Label>
        <Input id="reset-password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reset-confirm">{dict.auth.confirm_password}</Label>
        <Input id="reset-confirm" name="confirm_password" type="password" autoComplete="new-password" required />
      </div>
      <FormError error={state?.error} dict={dict} />
      <Button type="submit" className="w-full" isLoading={pending}>
        {dict.auth.reset_cta}
      </Button>
    </form>
  )
}
