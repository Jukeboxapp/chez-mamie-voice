import { useRef } from 'react'

export type Phase = 'idle' | 'listening' | 'processing'

interface Props {
  phase: Phase
  onStart(): void
  onEnd(): void
}

export function MicButton({ phase, onStart, onEnd }: Props) {
  const held = useRef(false)
  const end = () => {
    if (!held.current) return
    held.current = false
    onEnd()
  }
  return (
    <button
      className={`mic ${phase}`}
      disabled={phase === 'processing'}
      onPointerDown={(e) => {
        if (phase !== 'idle') return
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        held.current = true
        navigator.vibrate?.(15)
        onStart()
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="Maintenir pour dicter la commande"
    >
      <span className="ring" />
      <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
      </svg>
    </button>
  )
}
