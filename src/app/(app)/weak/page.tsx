import { redirect } from "next/navigation"

/** Weak spots live in a pop-up on Home. */
export default function WeakSpotsPage() {
  redirect("/?open=weak")
}
