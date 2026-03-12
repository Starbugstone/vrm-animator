function toneClasses(status) {
  if (status === 'done') {
    return {
      badge: 'border-emerald-300/25 bg-emerald-300/12 text-emerald-100',
      card: 'border-emerald-300/12 bg-emerald-300/6',
      label: 'Done',
    }
  }

  if (status === 'current') {
    return {
      badge: 'border-cyan-300/25 bg-cyan-300/14 text-cyan-100',
      card: 'border-cyan-300/15 bg-cyan-300/8',
      label: 'Now',
    }
  }

  return {
    badge: 'border-white/12 bg-white/6 text-white/65',
    card: 'border-white/10 bg-black/18',
    label: 'Next',
  }
}

export default function SetupGuideCard({
  eyebrow = 'Guided setup',
  title,
  description,
  steps,
  compact = false,
}) {
  return (
    <section className="rounded-[28px] border border-cyan-300/16 bg-[rgba(8,14,28,0.86)] p-5 shadow-[0_24px_80px_rgba(3,7,18,0.35)]">
      <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">{eyebrow}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</div>
      {description ? (
        <div className="mt-3 max-w-3xl text-sm leading-6 text-white/62">{description}</div>
      ) : null}

      <div className={`mt-5 grid gap-3 ${compact ? '' : 'xl:grid-cols-2'}`}>
        {steps.map((step, index) => {
          const tone = toneClasses(step.status)

          return (
            <div
              key={step.id}
              className={`rounded-3xl border p-4 ${tone.card}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-medium text-white">
                  {index + 1}. {step.title}
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${tone.badge}`}>
                  {tone.label}
                </span>
              </div>

              <div className="mt-2 text-sm leading-6 text-white/62">{step.detail}</div>

              {step.actionLabel && step.onAction ? (
                <button
                  type="button"
                  onClick={step.onAction}
                  className="mt-4 rounded-2xl border border-cyan-300/25 bg-cyan-300/12 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/20"
                >
                  {step.actionLabel}
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
