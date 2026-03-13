import FloatingWindow from './components/FloatingWindow.jsx'

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
  onFramingChange,
  onOptionChange,
}) {
  return (
    <FloatingWindow
      title="Camera controls"
      subtitle="Drag this bar to reposition"
      restoreTitle="Show camera controls"
      initialPosition={{ x: 16, y: 88 }}
      widthClass="w-[250px]"
    >
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
    </FloatingWindow>
  )
}
