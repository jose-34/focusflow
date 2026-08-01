import { cn } from '@/lib/utils'

interface OrganicBlobProps {
  /** A Tailwind background-color utility, e.g. "bg-accent/15". */
  colorClassName?: string
  className?: string
}

/**
 * A soft, slowly-morphing organic shape for decorating a section background
 * — deliberately not a rectangle or a generic radial gradient. Pure CSS
 * (an animated border-radius), no hand-authored SVG path data.
 *
 * Deliberately no negative z-index: a positioned ancestor without its own
 * z-index doesn't establish a new stacking context, so a negative z-index
 * here can escape further up the tree than intended and end up painted over
 * by an unrelated opaque ancestor — confirmed the hard way, this rendered
 * completely invisible on real pages until switched to relying on DOM order
 * instead (render this first, real content after — default stacking already
 * paints later siblings on top).
 */
export function OrganicBlob({ colorClassName = 'bg-accent/15', className }: OrganicBlobProps) {
  return <div aria-hidden className={cn('pointer-events-none absolute size-112 animate-blob-morph blur-3xl', colorClassName, className)} />
}
