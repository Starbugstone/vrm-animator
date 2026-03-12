import { useEffect, useState } from 'react'

export default function AvatarIdentityPanel({
  avatar,
  credentialId = '',
  credentials,
  busy,
  onSave,
}) {
  const [draft, setDraft] = useState({
    name: '',
    backstory: '',
    personality: '',
    systemPrompt: '',
    llmCredentialId: '',
  })

  useEffect(() => {
    setDraft({
      name: avatar?.name || '',
      backstory: avatar?.backstory || '',
      personality: avatar?.personality || '',
      systemPrompt: avatar?.systemPrompt || '',
      llmCredentialId: credentialId ? String(credentialId) : '',
    })
  }, [avatar, credentialId])

  if (!avatar) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-[rgba(8,14,28,0.8)] p-5 shadow-[0_24px_80px_rgba(3,7,18,0.35)]">
        <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Avatar identity</div>
        <div className="mt-3 text-sm text-white/60">
          Create or select one avatar to edit its single attached identity, prompt, and LLM connection.
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-[rgba(8,14,28,0.8)] p-5 shadow-[0_24px_80px_rgba(3,7,18,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Avatar identity</div>
          <div className="mt-2 text-sm text-white/60">
            Each avatar uses one attached persona record behind the scenes. This editor keeps that identity and the avatar record aligned.
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSave({
            name: draft.name,
            backstory: draft.backstory,
            personality: draft.personality,
            systemPrompt: draft.systemPrompt,
            llmCredentialId: draft.llmCredentialId ? Number(draft.llmCredentialId) : null,
          })}
          disabled={busy}
          className="rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Saving...' : 'Save avatar'}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <input
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          placeholder="Avatar name"
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <textarea
          value={draft.backstory}
          onChange={(event) => setDraft((current) => ({ ...current, backstory: event.target.value }))}
          placeholder="Backstory"
          rows={4}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <textarea
          value={draft.personality}
          onChange={(event) => setDraft((current) => ({ ...current, personality: event.target.value }))}
          placeholder="Personality"
          rows={4}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <textarea
          value={draft.systemPrompt}
          onChange={(event) => setDraft((current) => ({ ...current, systemPrompt: event.target.value }))}
          placeholder="System prompt"
          rows={5}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <select
          value={draft.llmCredentialId}
          onChange={(event) => setDraft((current) => ({ ...current, llmCredentialId: event.target.value }))}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
        >
          <option value="">No LLM attached</option>
          {credentials.map((credential) => (
            <option key={credential.id} value={credential.id}>
              {credential.name} | {credential.provider} | {credential.defaultModel || 'no default model'}
            </option>
          ))}
        </select>
      </div>
    </section>
  )
}
