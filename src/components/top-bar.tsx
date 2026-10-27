"use client"

import Link from "next/link"
import { Layers, Search } from "lucide-react"
import { Logo } from "@/components/logo"
import { SearchPalette, openSearch } from "@/components/search-palette"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"

interface Props {
  user: { name: string; email: string; image: string | null }
  due: number
}

export function TopBar({ user, due }: Props) {
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    // Focus mode: hidden while a review runs or a note is edited (marked data-focus). Their X still leads back.
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md [body:has([data-focus])_&]:hidden">
      <div className="flex h-15 items-center gap-2.5 px-4 sm:px-5">
        <Link href="/" aria-label="Home" className="mr-auto min-w-0">
          <Logo />
        </Link>

        <Button variant="outline" className="hidden w-56 justify-start font-normal text-muted-foreground md:flex" onClick={openSearch}>
          <Search /> Search…
          <Kbd className="ml-auto">Ctrl K</Kbd>
        </Button>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Search" onClick={openSearch}>
          <Search />
        </Button>

        <Button asChild variant={due > 0 ? "default" : "outline"}>
          <Link href="/review">
            <Layers /> Review
            <span className={due > 0 ? "rounded-full bg-primary-foreground/20 px-1.5 text-xs tabular-nums" : "text-xs tabular-nums text-muted-foreground"}>
              {due}
            </span>
          </Link>
        </Button>

        {/* No menu: everything personal (theme, log out) lives in Settings. */}
        <Link href="/settings" aria-label="Settings" className="rounded-full outline-ring focus-visible:outline-2 focus-visible:outline-offset-2">
          <Avatar className="size-8 border">
            {user.image && <AvatarImage src={user.image} alt="" />}
            <AvatarFallback className="bg-card text-xs font-bold">{initials}</AvatarFallback>
          </Avatar>
        </Link>
      </div>
      <SearchPalette />
    </header>
  )
}
