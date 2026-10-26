"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

interface Props {
  title: string
  description?: string
  initial?: string
  placeholder?: string
  submitLabel: string
  /** Return an error message to keep the dialog open. */
  onSubmit: (name: string) => Promise<string | void>
  /** Opens the dialog on click. Leave out and pass `open` to control it from outside. */
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/** A small dialog that asks for one name: new section, rename topic, and so on. */
export function NameDialog({ title, description, initial = "", placeholder, submitLabel, onSubmit, trigger, ...control }: Props) {
  const [ownOpen, setOwnOpen] = useState(false)
  const open = control.open ?? ownOpen
  const [value, setValue] = useState(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setOpen(next: boolean) {
    if (next) {
      setValue(initial)
      setError(null)
    }
    setOwnOpen(next)
    control.onOpenChange?.(next)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const name = value.trim()
    if (!name) return setError("Give it a name.")
    if (name.length > 80) return setError("Keep it under 80 characters.")
    setPending(true)
    try {
      const problem = await onSubmit(name)
      if (problem) setError(problem)
      else setOpen(false)
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="grid gap-2">
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              aria-label={title}
              className="h-11"
            />
            {error && (
              <p role="alert" className="text-sm">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
