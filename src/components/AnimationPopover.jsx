import FloatingWindow from './FloatingWindow.jsx'

export default function AnimationPopover({
  idleItems,
  actionItems,
  expressionItems,
  selectedIdleId,
  selectedActionId,
  selectedExpressionId,
  onIdleSelect,
  onActionSelect,
  onExpressionSelect,
  onSetIdle,
  onPlayAction,
  onPlayExpression,
}) {
  return (
    <FloatingWindow
      title="Animation controls"
      subtitle="Drag this bar to reposition"
      restoreTitle="Show animation controls"
      initialPosition={{ x: 16, y: 196 }}
      widthClass="w-[320px]"
    >
      <div className="space-y-3 text-sm">
        <AnimationSection
          title="Idle"
          items={idleItems}
          value={selectedIdleId}
          onChange={onIdleSelect}
          onAction={onSetIdle}
          actionLabel="Set idle"
        />
        <AnimationSection
          title="Action"
          items={actionItems}
          value={selectedActionId}
          onChange={onActionSelect}
          onAction={onPlayAction}
          actionLabel="Play action"
        />
        <AnimationSection
          title="Expression"
          items={expressionItems}
          value={selectedExpressionId}
          onChange={onExpressionSelect}
          onAction={onPlayExpression}
          actionLabel="Play expression"
        />
      </div>
    </FloatingWindow>
  )
}

function AnimationSection({ title, items, value, onChange, onAction, actionLabel }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 text-xs uppercase tracking-[0.24em] text-white/45">{title}</div>
      <select
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
      >
        {items.length === 0 ? <option value="">No animations available</option> : null}
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onAction}
        disabled={items.length === 0 || !value}
        className="mt-2 w-full rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15"
      >
        {actionLabel}
      </button>
    </section>
  )
}
