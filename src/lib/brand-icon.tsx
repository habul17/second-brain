const PATHS = [
  "M12 18V5",
  "M15 13a4.17 4.17 0 01-3-4 4.17 4.17 0 01-3 4",
  "M17.707 6.294A3 3 0 1012 5a3 3 0 10-5.707 1.294",
  "M17.996 5.125a4 4 0 012.526 5.77",
  "M18 18a4 4 0 002-7.465",
  "M19.967 17.482a4 4 0 11-7.967.517 4 4 0 11-7.967-.517",
  "M6 18a4 4 0 01-2-7.465",
  "M6.004 5.125a4 4 0 00-2.526 5.77",
]

/**
 * The app icon (white brain on black) as JSX for `ImageResponse`.
 * `padded` leaves the safe zone Android needs for "maskable" icons.
 */
export function BrandIcon({ size, padded = false }: { size: number; padded?: boolean }) {
  const glyph = Math.round(size * (padded ? 0.5 : 0.62))
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#111111" }}>
      <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="#fafafa" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </div>
  )
}
