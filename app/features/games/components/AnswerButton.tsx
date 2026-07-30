import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const ANSWER_STYLES = [
  { color: 'bg-[#E24B4B] hover:bg-[#d13d3d]', shape: 'triangle' as const },
  { color: 'bg-[#3B82C4] hover:bg-[#3374b0]', shape: 'diamond' as const },
  { color: 'bg-[#E0B23C] hover:bg-[#cc9f30]', shape: 'circle' as const },
  { color: 'bg-[#3FA45E] hover:bg-[#358f51]', shape: 'square' as const },
]

function Shape({ shape }: { shape: 'triangle' | 'diamond' | 'circle' | 'square' }) {
  if (shape === 'triangle') {
    return <span className="size-4 shrink-0 bg-white/90" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
  }
  if (shape === 'diamond') {
    return <span className="size-3.5 shrink-0 rotate-45 bg-white/90" />
  }
  if (shape === 'circle') {
    return <span className="size-4 shrink-0 rounded-full bg-white/90" />
  }
  return <span className="size-3.5 shrink-0 rounded-[3px] bg-white/90" />
}

interface AnswerButtonProps {
  index: number
  label: string
  onClick?: () => void
  disabled?: boolean
  selected?: boolean
  reveal?: 'correct' | 'incorrect' | 'neutral'
}

export function AnswerButton({ index, label, onClick, disabled, selected, reveal }: AnswerButtonProps) {
  const style = ANSWER_STYLES[index % ANSWER_STYLES.length]

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      animate={selected && !reveal ? { scale: 1.03 } : { scale: 1 }}
      className={cn(
        'relative flex min-h-16 items-center gap-3 rounded-xl px-5 py-4 text-left text-base font-semibold text-white shadow-md transition-opacity disabled:cursor-not-allowed',
        style.color,
        selected && !reveal && 'ring-4 ring-white/70',
        reveal === 'incorrect' && 'opacity-40',
        reveal === 'neutral' && 'opacity-60',
      )}
    >
      <Shape shape={style.shape} />
      <span className="flex-1">{label}</span>
      {reveal === 'correct' && (
        <span className="flex size-7 items-center justify-center rounded-full bg-white/90">
          <Check className="size-4 text-emerald-700" strokeWidth={3} />
        </span>
      )}
      {reveal === 'incorrect' && selected && (
        <span className="flex size-7 items-center justify-center rounded-full bg-white/90">
          <X className="size-4 text-destructive" strokeWidth={3} />
        </span>
      )}
    </motion.button>
  )
}
