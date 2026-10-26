"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface Providers {
  google: boolean
  github: boolean
}

function Card({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-6 rounded-3xl border bg-card p-6 sm:p-8">
      <div className="grid gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children, aside }: { label: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {aside}
      </div>
      {children}
    </div>
  )
}

function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-xl border border-foreground/30 bg-muted px-3 py-2.5 text-sm">
      {children}
    </p>
  )
}

function useSubmit() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run(fn: () => Promise<{ error?: { message?: string; code?: string } | null } | void>) {
    setPending(true)
    setError(null)
    try {
      const res = await fn()
      if (res && res.error) setError(res.error.message ?? "Something went wrong. Try again.")
      return res
    } finally {
      setPending(false)
    }
  }
  return { pending, error, setError, run }
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.7 14.55 2.75 12 2.75 6.9 2.75 2.75 6.9 2.75 12S6.9 21.25 12 21.25c5.34 0 8.88-3.75 8.88-9.04 0-.6-.07-1.06-.15-1.51Z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path fill="currentColor" d="M12 2.25a9.75 9.75 0 0 0-3.08 19c.49.09.67-.21.67-.47v-1.66c-2.71.59-3.28-1.31-3.28-1.31-.45-1.13-1.09-1.43-1.09-1.43-.89-.61.07-.6.07-.6.98.07 1.5 1.01 1.5 1.01.87 1.5 2.29 1.07 2.85.82.09-.63.34-1.07.62-1.31-2.17-.25-4.44-1.08-4.44-4.82 0-1.07.38-1.94 1.01-2.62-.1-.25-.44-1.24.1-2.59 0 0 .82-.26 2.68 1a9.3 9.3 0 0 1 4.88 0c1.86-1.26 2.68-1 2.68-1 .53 1.35.2 2.34.1 2.59.63.68 1.01 1.55 1.01 2.62 0 3.75-2.28 4.57-4.45 4.81.35.3.66.9.66 1.81v2.68c0 .26.18.57.68.47A9.75 9.75 0 0 0 12 2.25Z" />
    </svg>
  )
}

function SocialButtons({ providers }: { providers: Providers }) {
  const [busy, setBusy] = useState<string | null>(null)
  if (!providers.google && !providers.github) return null

  async function go(provider: "google" | "github") {
    setBusy(provider)
    await authClient.signIn.social({ provider, callbackURL: "/" })
  }

  return (
    <>
      <div className="grid gap-2.5">
        {providers.google && (
          <Button variant="outline" size="lg" className="h-11" onClick={() => go("google")} disabled={busy !== null}>
            {busy === "google" ? <Loader2 className="animate-spin" /> : <GoogleIcon />} Continue with Google
          </Button>
        )}
        {providers.github && (
          <Button variant="outline" size="lg" className="h-11" onClick={() => go("github")} disabled={busy !== null}>
            {busy === "github" ? <Loader2 className="animate-spin" /> : <GitHubIcon />} Continue with GitHub
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
      </div>
    </>
  )
}

export function LoginForm({ providers }: { providers: Providers }) {
  const router = useRouter()
  const { pending, error, setError, run } = useSubmit()

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const email = String(form.get("email"))
    const res = await run(() =>
      authClient.signIn.email({ email, password: String(form.get("password")), callbackURL: "/" }),
    )
    if (res && res.error?.code === "EMAIL_NOT_VERIFIED") {
      setError(null)
      router.push(`/check-email?email=${encodeURIComponent(email)}`)
    } else if (res && !res.error) {
      router.replace("/")
      router.refresh()
    }
  }

  return (
    <Card title="Welcome back" subtitle="Log in to your second brain.">
      <SocialButtons providers={providers} />
      <form onSubmit={onSubmit} className="grid gap-4">
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required className="h-11" />
        </Field>
        <Field
          label="Password"
          aside={
            <Link href="/forgot-password" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          }
        >
          <Input name="password" type="password" autoComplete="current-password" required className="h-11" />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Log in
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
          Create your second brain
        </Link>
      </p>
    </Card>
  )
}

export function SignupForm({ providers }: { providers: Providers }) {
  const router = useRouter()
  const { pending, error, run } = useSubmit()

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const email = String(form.get("email"))
    const res = await run(() =>
      authClient.signUp.email({
        name: String(form.get("name")),
        email,
        password: String(form.get("password")),
        callbackURL: "/",
      }),
    )
    if (res && !res.error) router.push(`/check-email?email=${encodeURIComponent(email)}`)
  }

  return (
    <Card title="Create your second brain" subtitle="Everything you learn, saved and reviewed so you never forget it.">
      <SocialButtons providers={providers} />
      <form onSubmit={onSubmit} className="grid gap-4">
        <Field label="Name">
          <Input name="name" autoComplete="name" required className="h-11" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required className="h-11" />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" autoComplete="new-password" minLength={8} required className="h-11" />
        </Field>
        <p className="-mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Create account
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have one?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Log in
        </Link>
      </p>
    </Card>
  )
}

export function CheckEmail() {
  const email = useSearchParams().get("email") ?? ""
  const [sent, setSent] = useState(false)
  const { pending, error, run } = useSubmit()

  async function resend() {
    const res = await run(() => authClient.sendVerificationEmail({ email, callbackURL: "/" }))
    if (res && !res.error) setSent(true)
  }

  return (
    <Card
      title="Check your inbox"
      subtitle={
        <>
          We sent a confirmation link to <span className="font-medium text-foreground">{email || "your email"}</span>.
          Tap it to open your second brain.
        </>
      }
    >
      <ErrorText>{error}</ErrorText>
      {email && (
        <Button variant="outline" size="lg" className="h-11" onClick={resend} disabled={pending || sent}>
          {pending && <Loader2 className="animate-spin" />} {sent ? "Sent again ✓" : "Send the link again"}
        </Button>
      )}
      <Link href="/login" className="text-center text-sm text-muted-foreground underline underline-offset-4">
        Back to log in
      </Link>
    </Card>
  )
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false)
  const { pending, error, run } = useSubmit()

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const email = String(new FormData(e.currentTarget).get("email"))
    const res = await run(() => authClient.requestPasswordReset({ email, redirectTo: "/reset-password" }))
    if (res && !res.error) setSent(true)
  }

  if (sent) {
    return (
      <Card title="Check your inbox" subtitle="If that email has an account, a reset link is on its way. It works for 1 hour.">
        <Link href="/login" className="text-center text-sm text-muted-foreground underline underline-offset-4">
          Back to log in
        </Link>
      </Card>
    )
  }

  return (
    <Card title="Forgot your password?" subtitle="Enter your email and we'll send you a reset link.">
      <form onSubmit={onSubmit} className="grid gap-4">
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required className="h-11" />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Send reset link
        </Button>
      </form>
      <Link href="/login" className="text-center text-sm text-muted-foreground underline underline-offset-4">
        Back to log in
      </Link>
    </Card>
  )
}

export function ResetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get("token")
  const { pending, error, run } = useSubmit()

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const newPassword = String(new FormData(e.currentTarget).get("password"))
    const res = await run(() => authClient.resetPassword({ newPassword, token: token ?? "" }))
    if (res && !res.error) router.push("/login")
  }

  if (!token || params.get("error")) {
    return (
      <Card title="This link has expired" subtitle="Reset links work for 1 hour. Ask for a new one.">
        <Button asChild size="lg" className="h-11">
          <Link href="/forgot-password">Get a new link</Link>
        </Button>
      </Card>
    )
  }

  return (
    <Card title="Choose a new password">
      <form onSubmit={onSubmit} className="grid gap-4">
        <Field label="New password">
          <Input name="password" type="password" autoComplete="new-password" minLength={8} required className="h-11" />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Save password
        </Button>
      </form>
    </Card>
  )
}
