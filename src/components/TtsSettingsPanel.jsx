import { useEffect, useMemo, useState } from 'react'

const EMPTY_CREDENTIAL_DRAFT = {
  id: null,
  name: '',
  secret: '',
  defaultModel: 'eleven_flash_v2_5',
  isActive: true,
}

function mapCredentialToDraft(credential, defaultModel) {
  return {
    id: credential.id,
    name: credential.name || '',
    secret: '',
    defaultModel: credential.defaultModel || defaultModel,
    isActive: Boolean(credential.isActive),
  }
}

function getSecretPlaceholder(draft, selectedCredential) {
  if (!draft.id) {
    return 'Paste the ElevenLabs API key from your account'
  }

  if (selectedCredential && selectedCredential.secretReadable === false) {
    return 'Enter the API key again to repair this saved connection'
  }

  return 'Leave blank to keep the current key'
}

export default function TtsSettingsPanel({
  providers,
  credentials,
  busy,
  onSaveCredential,
  onDeleteCredential,
}) {
  const provider = providers[0] || {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    defaultModel: 'eleven_flash_v2_5',
    models: [],
  }
  const [selectedCredentialId, setSelectedCredentialId] = useState('')
  const [draft, setDraft] = useState({
    ...EMPTY_CREDENTIAL_DRAFT,
    defaultModel: provider.defaultModel,
  })
  const [isCreatingNew, setIsCreatingNew] = useState(false)

  const selectedCredential = useMemo(
    () => credentials.find((entry) => String(entry.id) === selectedCredentialId) || null,
    [credentials, selectedCredentialId],
  )

  useEffect(() => {
    if (isCreatingNew) {
      return
    }

    if (!selectedCredentialId && credentials[0]?.id) {
      setSelectedCredentialId(String(credentials[0].id))
    }
  }, [credentials, isCreatingNew, selectedCredentialId])

  useEffect(() => {
    if (selectedCredential) {
      setDraft(mapCredentialToDraft(selectedCredential, provider.defaultModel))
      return
    }

    setDraft({
      ...EMPTY_CREDENTIAL_DRAFT,
      defaultModel: provider.defaultModel,
    })
  }, [provider.defaultModel, selectedCredential])

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-white/45">Voice connections</div>
          <div className="mt-1 text-sm text-white/60">
            Save one or more ElevenLabs endpoints here first. After that, choose the endpoint and voice inside the selected avatar profile.
          </div>
        </div>
        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/60">
          {credentials.length} saved
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setIsCreatingNew(true)
              setSelectedCredentialId('')
              setDraft({
                ...EMPTY_CREDENTIAL_DRAFT,
                defaultModel: provider.defaultModel,
              })
            }}
            className="w-full rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/25"
          >
            New ElevenLabs key
          </button>

          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {credentials.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/60">
                No ElevenLabs connections saved yet.
              </div>
            ) : null}
            {credentials.map((credential) => (
              <button
                key={credential.id}
                type="button"
                onClick={() => {
                  setIsCreatingNew(false)
                  setSelectedCredentialId(String(credential.id))
                }}
                className={`block w-full rounded-2xl border px-3 py-3 text-left text-sm transition ${
                  selectedCredentialId === String(credential.id)
                    ? 'border-cyan-300/35 bg-cyan-300/12 text-cyan-100'
                    : 'border-white/10 bg-black/20 text-white/75 hover:border-cyan-300/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{credential.name}</div>
                    <div className="mt-1 text-xs text-white/45">{provider.label}</div>
                  </div>
                  <div className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${credential.isActive ? 'bg-emerald-300/12 text-emerald-100' : 'bg-white/8 text-white/55'}`}>
                    {credential.isActive ? 'Active' : 'Inactive'}
                  </div>
                </div>
                <div className="mt-2 text-xs text-white/45">{credential.maskedSecret}</div>
                <div className="mt-1 text-[11px] text-white/35">{credential.defaultModel || provider.defaultModel}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/10 px-3 py-3 text-sm text-cyan-100">
            Each user brings their own ElevenLabs key. Voice audio is streamed through the backend, and avatars can later reuse any saved active endpoint from the profile panel. If you use a restricted ElevenLabs key, it also needs permission to read voices.
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Connection name</div>
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Example: Personal ElevenLabs"
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
              />
            </label>

            <label className="space-y-2">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Default model</div>
              <select
                value={draft.defaultModel}
                onChange={(event) => setDraft((current) => ({ ...current, defaultModel: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
              >
                {provider.models?.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-2">
            <div className="text-xs uppercase tracking-[0.24em] text-white/45">API key</div>
            <input
              type="password"
              value={draft.secret}
              onChange={(event) => setDraft((current) => ({ ...current, secret: event.target.value }))}
              placeholder={getSecretPlaceholder(draft, selectedCredential)}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
            />
          </label>

          <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/70">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))}
              className="h-4 w-4 rounded border-white/20 bg-transparent text-cyan-300 focus:ring-cyan-300/40"
            />
            Keep this ElevenLabs connection active
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={async () => {
                const saved = await onSaveCredential({
                  credentialId: draft.id,
                  name: draft.name,
                  secret: draft.secret,
                  defaultModel: draft.defaultModel,
                  isActive: draft.isActive,
                })

                if (saved?.id) {
                  setIsCreatingNew(false)
                  setSelectedCredentialId(String(saved.id))
                  setDraft((current) => ({ ...current, id: saved.id, secret: '' }))
                }
              }}
              disabled={busy || !draft.name.trim() || (!draft.id && !draft.secret.trim())}
              className="rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Saving...' : 'Save connection'}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!draft.id) {
                  return
                }

                await onDeleteCredential(draft.id)
                setSelectedCredentialId('')
                setIsCreatingNew(false)
              }}
              disabled={busy || !draft.id}
              className="rounded-2xl border border-rose-300/30 bg-rose-300/10 px-4 py-2 text-sm font-medium text-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete connection
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
