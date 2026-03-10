import { useEffect, useState } from 'react'

export default function AvatarProfilePanel({ avatar, busy, onSave }) {
  const [draft, setDraft] = useState({
    name: '',
    backstory: '',
    personality: '',
    systemPrompt: '',
  })

  useEffect(() => {
    setDraft({
      name: avatar?.name || '',
      backstory: avatar?.backstory || '',
      personality: avatar?.personality || '',
      systemPrompt: avatar?.systemPrompt || '',
    })
  }, [avatar])

  if (!avatar) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs uppercase tracking-[0.28em] text-white/45">Avatar profile</div>
        <div className="mt-3 text-sm text-white/60">Select one of your uploaded avatars to edit its persisted profile.</div>
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 text-xs uppercase tracking-[0.28em] text-white/45">Avatar profile</div>
      <div className="space-y-3">
        <input
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          placeholder="Avatar name"
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <textarea
          value={draft.backstory}
          onChange={(event) => setDraft((current) => ({ ...current, backstory: event.target.value }))}
          placeholder="Backstory"
          rows={4}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <textarea
          value={draft.personality}
          onChange={(event) => setDraft((current) => ({ ...current, personality: event.target.value }))}
          placeholder="Personality"
          rows={4}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <textarea
          value={draft.systemPrompt}
          onChange={(event) => setDraft((current) => ({ ...current, systemPrompt: event.target.value }))}
          placeholder="System prompt"
          rows={4}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <button
          type="button"
          onClick={() => onSave(draft)}
          disabled={busy}
          className="rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </section>
  )
}
