import { useEffect, useRef, useState } from 'react'

export default function HelpPopover({ title = 'Help', content, className = '' }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-cyan-200/35 bg-cyan-300/10 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Open help for ${title}`}
      >
        ?
      </button>

      {open ? (
        <div
          role="dialog"
          className="absolute right-0 z-20 mt-2 w-[min(92vw,360px)] rounded-2xl border border-cyan-200/25 bg-[rgba(8,15,28,0.96)] p-4 text-sm shadow-[0_18px_60px_rgba(0,0,0,0.45)]"
        >
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">{title}</div>
          <div className="mt-2 whitespace-pre-line leading-6 text-white/80">{content}</div>
        </div>
      ) : null}
    </div>
  )
}

