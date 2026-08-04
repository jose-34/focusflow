// The FocusFlow mark: an F built from a stem+arm (progress/focus) with
// ascending bars (growth) and a gold arc (momentum/flow). Inline SVG, not
// a raster image — stays crisp at any size and adapts to the badge vs.
// bare-mark contexts below without shipping two separate asset files.
function LogoMark({ id, stemColor, className }: { id: string; stemColor: string; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bars`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#1E7D4F" />
          <stop offset="100%" stopColor="#3DBE7A" />
        </linearGradient>
      </defs>
      <path d="M 14 32 A 38 38 0 0 1 66 10" stroke="#F2B134" strokeWidth="7" strokeLinecap="round" fill="none" />
      <rect x="58" y="58" width="9" height="20" rx="2.5" fill={`url(#${id}-bars)`} />
      <rect x="70" y="46" width="9" height="32" rx="2.5" fill={`url(#${id}-bars)`} />
      <rect x="82" y="34" width="9" height="44" rx="2.5" fill={`url(#${id}-bars)`} />
      <rect x="27" y="21" width="12" height="57" rx="3" fill={stemColor} />
      <rect x="27" y="21" width="35" height="12" rx="3" fill={stemColor} />
      <rect x="27" y="45" width="27" height="11" rx="3" fill={stemColor} />
    </svg>
  )
}

// The mark alone, colored for use directly on the app's own light/dark
// background (nav, headers) — no boxed background needed since the dark
// teal stem already carries enough contrast on cream, and reads fine
// against the app's dark-mode surface too (see globals.css's dark palette).
export function Logo({ className }: { className?: string }) {
  return <LogoMark id="logo" stemColor="#0D3B34" className={className} />
}

// The boxed variant (dark teal rounded square, white stem) — for contexts
// that need a self-contained badge regardless of surrounding background,
// e.g. the small nav badge and any future app-icon/share-image use.
export function LogoBadge({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <rect width="100" height="100" rx="22" fill="#0D3B34" />
      <g transform="translate(6 4) scale(0.88)">
        <LogoMark id="logo-badge" stemColor="#FFF4E0" />
      </g>
    </svg>
  )
}
