import confetti from "canvas-confetti"

/** Grey confetti, to match the black-and-white look. Skipped when the user prefers less motion. */
export function celebrate() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
  const colors = ["#111111", "#555555", "#999999", "#d4d4d4"]
  void confetti({ particleCount: 90, spread: 75, startVelocity: 38, origin: { y: 0.65 }, colors })
  setTimeout(() => void confetti({ particleCount: 50, spread: 110, startVelocity: 28, origin: { y: 0.6 }, colors }), 180)
}
