import { useCallback, useRef, useState } from 'react'

const COMMANDS = ['idle', 'clap', 'jump', 'dance', 'spin']

const SLIDERS = [
  { key: 'yaw', label: 'Yaw', min: -180, max: 180, step: 1, unit: 'deg' },
  { key: 'tilt', label: 'Tilt', min: 26, max: 88, step: 1, unit: 'deg' },
  { key: 'zoom', label: 'Zoom', min: 1.8, max: 12, step: 0.05, unit: '' },
  { key: 'height', label: 'Height', min: -5, max: 5, step: 0.01, unit: '' },
  { key: 'shift', label: 'Shift', min: -1.5, max: 1.5, step: 0.01, unit: '' },
]

const VIEWER_OPTIONS = [
  {
    key: 'autoBlink',
    label: 'Auto blink',
    description: 'Use VRM blink expressions for natural idle blinking.',
  },
  {
    key: 'lookAtCamera',
    label: 'Eyes follow camera',
    description: 'Bind the VRM look-at target to the active camera.',
  },
]

function formatSliderValue(step, value, unit) {
  const numericValue = typeof value === 'number' ? value : Number(value || 0)
  const text = Number.isInteger(step) ? numericValue.toFixed(0) : numericValue.toFixed(2)
  return unit ? `${text} ${unit}` : text
}

export default function CameraPopover({
  framingValues,
  viewerOptions,
  activeCommand,
  onFramingChange,
  onOptionChange,
  onCommand,
}) {
  const [open, setOpen] = useState(true)
  const [minimized, setMinimized] = useState(false)
  const [position, setPosition] = useState({ x: 16, y: 88 })
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
        title="Show camera controls"
      >
        +
      </button>
    )
  }

  return (
    <div
      className="absolute z-30 flex w-[250px] flex-col gap-3 rounded-[22px] border border-cyan-300/15 bg-[rgba(3,7,18,0.68)] p-3.5 shadow-[0_18px_40px_rgba(0,0,0,0.38)] backdrop-blur-[14px]"
      style={{ left: position.x, top: position.y }}
    >
      <div
        className="camera-popover-header flex cursor-grab items-center justify-between gap-3 active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/90">Camera controls</div>
          <div className="mt-1 text-[11px] text-white/45">Drag this bar to reposition</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onPointerDown={stopEvent}
            onClick={() => setMinimized((previous) => !previous)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white/80"
            aria-label={minimized ? 'Restore camera controls' : 'Minimize camera controls'}
            title={minimized ? 'Restore panel' : 'Minimize panel'}
          >
            {minimized ? '+' : '-'}
          </button>
          <button
            type="button"
            onPointerDown={stopEvent}
            onClick={() => setOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white/80"
            aria-label="Hide camera controls"
            title="Hide panel"
          >
            x
          </button>
        </div>
      </div>

      {minimized ? null : (
        <>
          <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-cyan-100/80">
            Active motion: {activeCommand}
          </div>

          {SLIDERS.map(({ key, label, min, max, step, unit }) => {
            const value = framingValues[key] ?? 0
            return (
              <label key={key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-white/80">
                  <span>{label}</span>
                  <span className="font-[tabular-nums] text-cyan-200">
                    {formatSliderValue(step, value, unit)}
                  </span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={value}
                  onChange={(event) => onFramingChange(key, Number(event.target.value))}
                  className="w-full accent-cyan-400"
                />
              </label>
            )
          })}

          <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-100/80">Viewer assists</div>
            {VIEWER_OPTIONS.map(({ key, label, description }) => (
              <label key={key} className="flex items-start justify-between gap-3 rounded-2xl border border-white/8 bg-white/5 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm text-white/85">{label}</div>
                  <div className="mt-1 text-[11px] leading-5 text-white/45">{description}</div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(viewerOptions[key])}
                  onChange={(event) => onOptionChange(key, event.target.checked)}
                  className="mt-1 h-4 w-4 accent-cyan-400"
                />
              </label>
            ))}
          </div>

          <div className="mt-1 flex flex-wrap gap-1.5">
            {COMMANDS.map((command) => (
              <button
                key={command}
                type="button"
                onClick={() => onCommand(command)}
                className={`rounded-xl border px-2.5 py-1 text-[11px] font-medium transition ${
                  activeCommand === command
                    ? 'border-cyan-300 bg-cyan-300/20 text-cyan-100'
                    : 'border-white/10 bg-white/5 text-white/70 hover:border-cyan-300/30 hover:text-white'
                }`}
              >
                {command}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
