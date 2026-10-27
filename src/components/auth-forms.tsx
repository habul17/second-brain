"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"

export interface Providers {
  google: boolean
  github: boolean
}

function Screen({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-3.5">
      <div className="mb-2.5 grid gap-2 text-center">
        <h1 className="text-[1.6rem] font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

/** A soft grey box with its name inside as the placeholder (and as its label for screen readers). */
function Soft({ label, ...props }: { label: string } & React.ComponentProps<"input">) {
  return (
    <input
      aria-label={label}
      placeholder={label}
      className="h-12 w-full min-w-0 rounded-[11px] border border-transparent bg-accent px-3.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus:border-foreground focus:bg-background"
      {...props}
    />
  )
}

function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="text-center text-sm text-bad">
      {children}
    </p>
  )
}

/** The one line of links under a form. */
function Links({ children }: { children: ReactNode }) {
  return <div className="mt-1 flex flex-wrap justify-center gap-x-[22px] gap-y-2 text-[0.92rem] text-muted-foreground">{children}</div>
}

const strong = "font-semibold text-foreground underline-offset-4 hover:underline"
const go = "mt-1 h-12 rounded-xl text-base"

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

  async function signIn(provider: "google" | "github") {
    setBusy(provider)
    await authClient.signIn.social({ provider, callbackURL: "/" })
  }

  return (
    <>
      <div className="grid gap-2.5">
        {providers.google && (
          <Button variant="outline" size="lg" className="h-12 rounded-xl text-base" onClick={() => signIn("google")} disabled={busy !== null}>
            {busy === "google" ? <Loader2 className="animate-spin" /> : <GoogleIcon />} Continue with Google
          </Button>
        )}
        {providers.github && (
          <Button variant="outline" size="lg" className="h-12 rounded-xl text-base" onClick={() => signIn("github")} disabled={busy !== null}>
            {busy === "github" ? <Loader2 className="animate-spin" /> : <GitHubIcon />} Continue with GitHub
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
    </>
  )
}

export function LoginForm({ providers, canReset }: { providers: Providers; canReset: boolean }) {
  const router = useRouter()
  const { pending, error, run } = useSubmit()

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const res = await run(() =>
      authClient.signIn.email({ email: String(form.get("email")), password: String(form.get("password")), callbackURL: "/" }),
    )
    if (res && !res.error) {
      router.replace("/")
      router.refresh()
    }
  }

  return (
    <Screen title="Log in">
      <SocialButtons providers={providers} />
      <form onSubmit={onSubmit} className="grid gap-3.5">
        <Soft label="Email" name="email" type="email" autoComplete="email" required />
        <Soft label="Password" name="password" type="password" autoComplete="current-password" required />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" className={go} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Log in
        </Button>
      </form>
      <Links>
        {canReset && (
          <Link href="/forgot-password" className="underline-offset-4 hover:text-foreground hover:underline">
            Forgot password
          </Link>
        )}
        <Link href="/signup" className={strong}>
          Create account
        </Link>
      </Links>
    </Screen>
  )
}

export function SignupForm({ providers }: { providers: Providers }) {
  const router = useRouter()
  const { pending, error, run } = useSubmit()

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const res = await run(() =>
      authClient.signUp.email({
        name: String(form.get("name")),
        email: String(form.get("email")),
        password: String(form.get("password")),
        callbackURL: "/",
      }),
    )
    if (res && !res.error) {
      router.replace("/")
      router.refresh()
    }
  }

  return (
    <Screen title="Create account">
      <SocialButtons providers={providers} />
      <form onSubmit={onSubmit} className="grid gap-3.5">
        <Soft label="Name" name="name" autoComplete="name" required />
        <Soft label="Email" name="email" type="email" autoComplete="email" required />
        <Soft label="Password (8 or more characters)" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" className={go} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Create account
        </Button>
      </form>
      <Links>
        <span>
          Have an account?{" "}
          <Link href="/login" className={strong}>
            Log in
          </Link>
        </span>
      </Links>
    </Screen>
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
      <Screen title="Check your inbox" subtitle="If that email has an account, a reset link is on its way. It works for 1 hour.">
        <Links>
          <Link href="/login" className={strong}>
            Back to log in
          </Link>
        </Links>
      </Screen>
    )
  }

  return (
    <Screen title="Reset password" subtitle="We'll email you a link to choose a new one.">
      <form onSubmit={onSubmit} className="grid gap-3.5">
        <Soft label="Email" name="email" type="email" autoComplete="email" required />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" className={go} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Send reset link
        </Button>
      </form>
      <Links>
        <Link href="/login" className={strong}>
          Back to log in
        </Link>
      </Links>
    </Screen>
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
      <Screen title="This link has expired" subtitle="Reset links work for 1 hour. Ask for a new one.">
        <Button asChild size="lg" className={go}>
          <Link href="/forgot-password">Get a new link</Link>
        </Button>
      </Screen>
    )
  }

  return (
    <Screen title="Choose a new password">
      <form onSubmit={onSubmit} className="grid gap-3.5">
        <Soft label="New password (8 or more characters)" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" className={go} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Save password
        </Button>
      </form>
    </Screen>
  )
}
