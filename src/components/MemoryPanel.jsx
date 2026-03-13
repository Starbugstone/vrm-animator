import { useEffect, useState } from 'react'

export default function MemoryPanel({ memory, revisions, busy, onSave, onReset }) {
  const [draft, setDraft] = useState('')

  useEffect(() => {
    setDraft(memory?.markdownContent || '')
  }, [memory])

  if (!memory) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs uppercase tracking-[0.28em] text-white/45">Memory</div>
        <div className="mt-3 text-sm text-white/60">
          Select an avatar first, then save a few notes it should remember about the user or the relationship.
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-white/45">Memory</div>
          <div className="mt-1 text-sm text-white/60">
            Save facts the avatar should remember between chats. Revision {memory.revision} | Last updated by {memory.lastUpdatedBy}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSave({ markdownContent: draft, revision: memory.revision })}
          disabled={busy}
          className="rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Saving...' : 'Save memory'}
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={busy}
          className="rounded-2xl border border-amber-300/30 bg-amber-300/12 px-4 py-2 text-sm font-medium text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Working...' : 'Dev reset'}
        </button>
      </div>

      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={14}
        placeholder="- The user likes short answers.\n- The avatar should greet them warmly.\n- They talked about games yesterday."
        className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
      />

      <div className="mt-4 text-xs uppercase tracking-[0.24em] text-white/40">Recent revisions</div>
      <div className="mt-2 space-y-2">
        {revisions.slice(0, 5).map((entry) => (
          <div key={entry.id} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/65">
            Revision {entry.revision} | {entry.source} | {new Date(entry.createdAt).toLocaleString()}
          </div>
        ))}
      </div>
    </section>
  )
}
