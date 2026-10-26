"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Flame, Layers, LogOut, Moon, Search, Settings, Sun, Swords } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { Logo } from "@/components/logo"
import { SearchPalette, openSearch } from "@/components/search-palette"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"

interface Props {
  user: { name: string; email: string; image: string | null }
  due: number
}

export function TopBar({ user, due }: Props) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  async function signOut() {
    await authClient.signOut()
    router.replace("/login")
    router.refresh()
  }

  return (
    // Focus mode: hidden while a review runs (the session is marked data-focus). Its X still leads home.
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md [body:has([data-focus])_&]:hidden">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-4 sm:px-6">
        <Link href="/" aria-label="Home" className="mr-auto min-w-0">
          <Logo />
        </Link>

        <Button variant="outline" className="hidden w-56 justify-start text-muted-foreground md:flex" onClick={openSearch}>
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Menu">
              <Avatar className="size-8">
                {user.image && <AvatarImage src={user.image} alt="" />}
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="grid font-normal">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/mock">
                <Swords /> Mock interview
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/weak">
                <Flame /> Weak spots
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              {resolvedTheme === "dark" ? <Sun /> : <Moon />} {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut}>
              <LogOut /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <SearchPalette />
    </header>
  )
}
