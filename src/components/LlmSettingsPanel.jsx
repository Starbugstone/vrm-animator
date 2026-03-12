import { useEffect, useMemo, useState } from 'react'

const EMPTY_DRAFT = {
  id: null,
  name: '',
  provider: 'openrouter',
  secret: '',
  defaultModel: '',
  isActive: true,
}

function formatPricing(pricing) {
  if (!pricing) return 'n/a'

  return [`prompt ${pricing.prompt}`, `completion ${pricing.completion}`].join(' | ')
}

function mapCredentialToDraft(credential) {
  return {
    id: credential.id,
    name: credential.name || '',
    provider: credential.provider,
    secret: '',
    defaultModel: credential.defaultModel || '',
    isActive: Boolean(credential.isActive),
  }
}

export default function LlmSettingsPanel({
  providers,
  credentials,
  models,
  busy,
  modelsBusy,
  onLoadModels,
  onSaveCredential,
  onDeleteCredential,
}) {
  const [selectedCredentialId, setSelectedCredentialId] = useState('')
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [billingFilter, setBillingFilter] = useState('all')
  const [modelSearch, setModelSearch] = useState('')

  const selectedCredential = useMemo(
    () => credentials.find((entry) => String(entry.id) === selectedCredentialId) || null,
    [credentials, selectedCredentialId],
  )
  const providerOptions = useMemo(
    () => providers.map((provider) => ({ value: provider.id, label: provider.label })),
    [providers],
  )

  useEffect(() => {
    if (!selectedCredentialId && credentials[0]?.id) {
      setSelectedCredentialId(String(credentials[0].id))
    }
  }, [credentials, selectedCredentialId])

  useEffect(() => {
    if (selectedCredential) {
      setDraft(mapCredentialToDraft(selectedCredential))
      return
    }

    setDraft((current) => ({
      ...EMPTY_DRAFT,
      provider: providers[0]?.id || 'openrouter',
      name: current.id === null && current.name ? current.name : '',
    }))
  }, [providers, selectedCredential])

  useEffect(() => {
    if (draft.provider !== 'openrouter') {
      return
    }

    onLoadModels({
      search: modelSearch,
      billing: billingFilter,
    })
  }, [billingFilter, draft.provider, modelSearch, onLoadModels])

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-white/45">LLM credentials</div>
          <div className="mt-1 text-sm text-white/60">
            Save multiple named API connections per account, including multiple records for the same provider.
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
              setSelectedCredentialId('')
              setDraft({
                ...EMPTY_DRAFT,
                provider: providers[0]?.id || 'openrouter',
              })
            }}
            className="w-full rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/25"
          >
            New credential
          </button>

          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {credentials.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/60">
                No credentials saved yet.
              </div>
            ) : null}
            {credentials.map((credential) => (
              <button
                key={credential.id}
                type="button"
                onClick={() => setSelectedCredentialId(String(credential.id))}
                className={`block w-full rounded-2xl border px-3 py-3 text-left text-sm transition ${
                  selectedCredentialId === String(credential.id)
                    ? 'border-cyan-300/35 bg-cyan-300/12 text-cyan-100'
                    : 'border-white/10 bg-black/20 text-white/75 hover:border-cyan-300/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{credential.name}</div>
                    <div className="mt-1 text-xs text-white/45">{credential.provider}</div>
                  </div>
                  <div className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${credential.isActive ? 'bg-emerald-300/12 text-emerald-100' : 'bg-white/8 text-white/55'}`}>
                    {credential.isActive ? 'Active' : 'Inactive'}
                  </div>
                </div>
                <div className="mt-2 text-xs text-white/45">{credential.maskedSecret}</div>
                <div className="mt-1 text-[11px] text-white/35">{credential.defaultModel || 'No default model'}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Credential name</div>
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Personal label"
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
              />
            </label>

            <label className="space-y-2">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Provider</div>
              <select
                value={draft.provider}
                onChange={(event) => setDraft((current) => ({ ...current, provider: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
              >
                {providerOptions.map((provider) => (
                  <option key={provider.value} value={provider.value}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Default model</div>
              <input
                value={draft.defaultModel}
                onChange={(event) => setDraft((current) => ({ ...current, defaultModel: event.target.value }))}
                placeholder="Model id"
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
              />
            </label>

            <label className="space-y-2">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">
                {draft.id ? 'Replace API key' : 'API key'}
              </div>
              <input
                value={draft.secret}
                onChange={(event) => setDraft((current) => ({ ...current, secret: event.target.value }))}
                placeholder={draft.id ? 'Leave blank to keep the current key' : 'Paste provider API key'}
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
              />
            </label>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/75">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))}
              className="h-4 w-4 rounded border-white/20 bg-black/20"
            />
            Active credential
          </label>

          {selectedCredential ? (
            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100">
              Saved key: {selectedCredential.maskedSecret} | updated {new Date(selectedCredential.updatedAt).toLocaleString()}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/60">
              This new record will be attached to your account as its own credential entry.
            </div>
          )}

          {draft.provider === 'openrouter' ? (
            <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap gap-2">
                <input
                  value={modelSearch}
                  onChange={(event) => setModelSearch(event.target.value)}
                  placeholder="Search OpenRouter models"
                  className="min-w-[180px] flex-1 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
                />
                <select
                  value={billingFilter}
                  onChange={(event) => setBillingFilter(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
                >
                  <option value="all">All models</option>
                  <option value="free">Free only</option>
                  <option value="paid">Paid only</option>
                </select>
              </div>

              <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                {modelsBusy ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/60">Loading models...</div>
                ) : null}
                {!modelsBusy && models.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/60">No models match the current filter.</div>
                ) : null}
                {models.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setDraft((current) => ({ ...current, defaultModel: model.id }))}
                    className={`block w-full rounded-2xl border px-3 py-2 text-left text-sm transition ${
                      draft.defaultModel === model.id
                        ? 'border-cyan-300/40 bg-cyan-300/15 text-cyan-100'
                        : 'border-white/10 bg-black/25 text-white/75 hover:border-cyan-300/20 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{model.name}</div>
                      <div className={`text-[11px] uppercase tracking-[0.18em] ${model.isFree ? 'text-emerald-200/80' : 'text-amber-200/80'}`}>
                        {model.isFree ? 'Free' : 'Paid'}
                      </div>
                    </div>
                    <div className="mt-1 break-all text-xs text-white/45">{model.id}</div>
                    <div className="mt-1 text-xs text-white/55">{model.description || 'No description provided.'}</div>
                    <div className="mt-1 text-[11px] text-white/40">
                      Context {model.contextLength.toLocaleString()} | {formatPricing(model.pricing)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                onSaveCredential({
                  credentialId: draft.id,
                  name: draft.name,
                  provider: draft.provider,
                  secret: draft.secret,
                  defaultModel: draft.defaultModel,
                  isActive: draft.isActive,
                })
              }
              disabled={busy}
              className="rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Saving...' : draft.id ? 'Update credential' : 'Create credential'}
            </button>
            <button
              type="button"
              onClick={() => draft.id && onDeleteCredential(draft.id)}
              disabled={busy || !draft.id}
              className="rounded-2xl border border-rose-300/30 bg-rose-300/10 px-4 py-2 text-sm font-medium text-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete credential
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
