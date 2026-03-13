import { useCallback, useRef, useState } from 'react'

export default function FloatingWindow({
  title,
  subtitle,
  restoreTitle,
  initialPosition = { x: 16, y: 88 },
  widthClass = 'w-[250px]',
  children,
}) {
  const [open, setOpen] = useState(true)
  const [minimized, setMinimized] = useState(false)
  const [position, setPosition] = useState(initialPosition)
  const draggingRef = useRef(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })

  const handlePointerDown = useCallback((event) => {
    if (event.button !== 0) return
    draggingRef.current = true
    dragOffsetRef.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [position.x, position.y])

  const handlePointerMove = useCallback((event) => {
    if (!draggingRef.current) return
    setPosition({
      x: Math.max(12, event.clientX - dragOffsetRef.current.x),
      y: Math.max(12, event.clientY - dragOffsetRef.current.y),
    })
  }, [])

  const handlePointerUp = useCallback((event) => {
    draggingRef.current = false
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }, [])

  const stopEvent = useCallback((event) => {
    event.stopPropagation()
  }, [])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setMinimized(false)
        }}
        className="absolute right-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-cyan-300/20 bg-black/45 text-lg text-cyan-100 shadow-[0_14px_30px_rgba(0,0,0,0.3)] backdrop-blur transition hover:bg-black/65"
        title={restoreTitle}
      >
        +
      </button>
    )
  }

  return (
    <div
      className={`absolute z-30 flex max-w-[calc(100%-2rem)] flex-col gap-3 rounded-[22px] border border-cyan-300/15 bg-[rgba(3,7,18,0.68)] p-3.5 shadow-[0_18px_40px_rgba(0,0,0,0.38)] backdrop-blur-[14px] ${widthClass}`}
      style={{ left: position.x, top: position.y }}
    >
      <div
        className="flex cursor-grab items-center justify-between gap-3 active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/90">{title}</div>
          <div className="mt-1 text-[11px] text-white/45">{subtitle}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onPointerDown={stopEvent}
            onClick={() => setMinimized((previous) => !previous)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white/80"
            aria-label={minimized ? `Restore ${title.toLowerCase()}` : `Minimize ${title.toLowerCase()}`}
            title={minimized ? 'Restore panel' : 'Minimize panel'}
          >
            {minimized ? '+' : '-'}
          </button>
          <button
            type="button"
            onPointerDown={stopEvent}
            onClick={() => setOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white/80"
            aria-label={`Hide ${title.toLowerCase()}`}
            title="Hide panel"
          >
            x
          </button>
        </div>
      </div>

      {minimized ? null : children}
    </div>
  )
}
