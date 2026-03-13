import { useEffect, useState } from 'react'

const SPEECH_LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto detect' },
  { value: 'en-US', label: 'English' },
  { value: 'fr-FR', label: 'French' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'de-DE', label: 'German' },
  { value: 'it-IT', label: 'Italian' },
]

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
    speechVoiceGender: '',
    speechLanguage: 'auto',
  })

  useEffect(() => {
    setDraft({
      name: avatar?.name || '',
      backstory: avatar?.backstory || '',
      personality: avatar?.personality || '',
      systemPrompt: avatar?.systemPrompt || '',
      llmCredentialId: credentialId ? String(credentialId) : '',
      speechVoiceGender: avatar?.speechVoiceGender || '',
      speechLanguage: avatar?.speechLanguage || 'auto',
    })
  }, [avatar, credentialId])

  if (!avatar) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-[rgba(8,14,28,0.8)] p-5 shadow-[0_24px_80px_rgba(3,7,18,0.35)]">
        <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Avatar profile</div>
        <div className="mt-3 text-sm text-white/60">
          Pick an avatar first, then fill in its profile and choose which AI connection it should use.
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-[rgba(8,14,28,0.8)] p-5 shadow-[0_24px_80px_rgba(3,7,18,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Avatar profile</div>
          <div className="mt-2 text-sm text-white/60">
            This is the personality sheet for the selected avatar. Keep it short and clear so the character stays consistent.
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
            speechVoiceGender: draft.speechVoiceGender || null,
            speechLanguage: draft.speechLanguage || 'auto',
          })}
          disabled={busy}
          className="rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Saving...' : 'Save avatar'}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <label className="block space-y-2">
          <div className="text-xs uppercase tracking-[0.24em] text-white/45">Name</div>
          <input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="Example: Luna, Atlas, Mira..."
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
          />
        </label>
        <label className="block space-y-2">
          <div className="text-xs uppercase tracking-[0.24em] text-white/45">Backstory</div>
          <textarea
            value={draft.backstory}
            onChange={(event) => setDraft((current) => ({ ...current, backstory: event.target.value }))}
            placeholder="Who is this avatar? Keep it short and concrete."
            rows={4}
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
          />
        </label>
        <label className="block space-y-2">
          <div className="text-xs uppercase tracking-[0.24em] text-white/45">Personality</div>
          <textarea
            value={draft.personality}
            onChange={(event) => setDraft((current) => ({ ...current, personality: event.target.value }))}
            placeholder="Example: warm, patient, playful, direct..."
            rows={4}
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
          />
        </label>
        <label className="block space-y-2">
          <div className="text-xs uppercase tracking-[0.24em] text-white/45">Special instructions (advanced)</div>
          <textarea
            value={draft.systemPrompt}
            onChange={(event) => setDraft((current) => ({ ...current, systemPrompt: event.target.value }))}
            placeholder="Optional extra rules for how the avatar should answer."
            rows={5}
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
          />
        </label>
        <label className="block space-y-2">
          <div className="text-xs uppercase tracking-[0.24em] text-white/45">AI connection</div>
          <select
            value={draft.llmCredentialId}
            onChange={(event) => setDraft((current) => ({ ...current, llmCredentialId: event.target.value }))}
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
          >
            <option value="">No AI attached yet</option>
            {credentials.map((credential) => (
              <option key={credential.id} value={credential.id}>
                {credential.name} | {credential.provider} | {credential.defaultModel || 'no default model'}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-2">
            <div className="text-xs uppercase tracking-[0.24em] text-white/45">Speech voice</div>
            <select
              value={draft.speechVoiceGender}
              onChange={(event) => setDraft((current) => ({ ...current, speechVoiceGender: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
            >
              <option value="">No preference</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </label>
          <label className="block space-y-2">
            <div className="text-xs uppercase tracking-[0.24em] text-white/45">Speech language</div>
            <select
              value={draft.speechLanguage}
              onChange={(event) => setDraft((current) => ({ ...current, speechLanguage: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
            >
              {SPEECH_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </section>
  )
}
