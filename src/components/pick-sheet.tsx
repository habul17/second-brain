"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "cn"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface SheetProps {
  title: React.ReactNode
  /** Read by screen readers only; the sheet itself stays quiet. */
  description: string
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

/** A calm pop-up list: centered near the top on a laptop, a bottom sheet on a phone. */
export function PickSheet({ title, description, trigger, open, onOpenChange, children }: SheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        showCloseButton={false}
        className={cn(
          "grid-cols-[minmax(0,1fr)] gap-1.5 px-2 pt-5.5 pb-2.5 sm:top-[110px] sm:max-w-[400px] sm:translate-y-0",
          "max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:px-1 max-sm:pb-7",
        )}
      >
        <span className="-mt-2 mb-2 h-1 w-10 justify-self-center rounded-full bg-border sm:hidden" aria-hidden />
        <DialogTitle className="px-5 pb-1.5 text-lg leading-snug font-bold">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  )
}

/** One row in a PickSheet: name (and an optional detail under it), a quiet value on the right, a chevron. */
export function PickRow({ href, name, detail, value, onClick }: { href: string; name: string; detail?: string; value?: string; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="mx-1.5 flex items-center gap-3 p-3.5 transition-colors hover:bg-accent [&+&]:border-t"
    >
      <span className="grid min-w-0 flex-1 gap-0.5">
        <b className="truncate font-bold">{name}</b>
        {detail && <span className="text-sm text-muted-foreground">{detail}</span>}
      </span>
      {value && <span className="shrink-0 text-muted-foreground tabular-nums">{value}</span>}
      <ChevronRight className="size-[18px] shrink-0 text-muted-foreground" />
    </Link>
  )
}

/** A small uppercase label that groups PickRows. */
export function PickGroup({ children }: { children: React.ReactNode }) {
  return <p className="px-5 pt-3.5 pb-0.5 text-xs font-bold tracking-wider text-muted-foreground uppercase first:pt-0.5">{children}</p>
}
