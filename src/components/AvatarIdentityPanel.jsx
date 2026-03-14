import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { filterVoicesForAvatar, getEffectiveVoiceGender, normalizeGenderTag } from '../lib/ttsVoices.js'
import { playStreamedAudioResponse } from '../lib/streamingAudio.js'

const SPEECH_LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto detect' },
  { value: 'en-US', label: 'English' },
  { value: 'fr-FR', label: 'French' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'de-DE', label: 'German' },
  { value: 'it-IT', label: 'Italian' },
]

function buildVoicePreviewText(name) {
  const safeName = String(name || '').trim()

  if (safeName) {
    return `Hello, I'm ${safeName}. This is a quick preview of my voice.`
  }

  return 'Hello. This is a quick preview of my voice.'
}

export default function AvatarIdentityPanel({
  avatar,
  credentialId = '',
  credentials,
  ttsCredentials = [],
  ttsVoicesByCredential = {},
  onLoadTtsVoices,
  onPreviewTts,
  busy,
  onSave,
}) {
  const [ttsLoadError, setTtsLoadError] = useState('')
  const [previewText, setPreviewText] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [previewingVoiceId, setPreviewingVoiceId] = useState('')
  const previewAudioRef = useRef(typeof Audio !== 'undefined' ? new Audio() : null)
  const previewAbortRef = useRef(null)
  const [draft, setDraft] = useState({
    name: '',
    backstory: '',
    personality: '',
    llmCredentialId: '',
    presentationGender: '',
    speechVoiceGender: '',
    speechLanguage: 'auto',
    ttsCredentialId: '',
    ttsVoiceId: '',
    showAllVoices: false,
  })

  useEffect(() => {
    setDraft({
      name: avatar?.name || '',
      backstory: avatar?.backstory || '',
      personality: avatar?.personality || '',
      llmCredentialId: credentialId ? String(credentialId) : '',
      presentationGender: avatar?.presentationGender || '',
      speechVoiceGender: avatar?.speechVoiceGender || '',
      speechLanguage: avatar?.speechLanguage || 'auto',
      ttsCredentialId: avatar?.ttsCredentialId ? String(avatar.ttsCredentialId) : '',
      ttsVoiceId: avatar?.ttsVoiceId || '',
      showAllVoices: false,
    })
    setTtsLoadError('')
    setPreviewText(buildVoicePreviewText(avatar?.name))
    setPreviewError('')
    setPreviewingVoiceId('')
  }, [avatar, credentialId])

  const stopPreviewPlayback = useCallback(() => {
    previewAbortRef.current?.abort?.()
    previewAbortRef.current = null
    setPreviewingVoiceId('')

    const audio = previewAudioRef.current
    if (!audio) {
      return
    }

    audio.pause()
    audio.removeAttribute('src')
    audio.load?.()
  }, [])

  useEffect(() => {
    if (!draft.ttsCredentialId || !onLoadTtsVoices) {
      setTtsLoadError('')
      return
    }

    setTtsLoadError('')
    onLoadTtsVoices(Number(draft.ttsCredentialId)).catch((error) => {
      setTtsLoadError(error?.message || 'Unable to load voices for this endpoint.')
    })
  }, [draft.ttsCredentialId, onLoadTtsVoices])

  useEffect(() => {
    setPreviewError('')
    stopPreviewPlayback()
  }, [draft.ttsCredentialId, stopPreviewPlayback])

  useEffect(() => (
    () => {
      stopPreviewPlayback()
    }
  ), [stopPreviewPlayback])

  const availableVoices = draft.ttsCredentialId
    ? ttsVoicesByCredential[Number(draft.ttsCredentialId)] || []
    : []
  const effectiveVoiceGender = getEffectiveVoiceGender(draft)
  const filteredVoices = useMemo(() => {
    if (draft.showAllVoices) {
      return availableVoices
    }

    const visible = filterVoicesForAvatar(availableVoices, draft)
    const selectedVoice = availableVoices.find((voice) => voice.id === draft.ttsVoiceId)

    if (selectedVoice && !visible.some((voice) => voice.id === selectedVoice.id)) {
      return [selectedVoice, ...visible]
    }

    return visible
  }, [availableVoices, draft])

  const handlePreviewVoice = useCallback(async (voice) => {
    if (!avatar?.id || !draft.ttsCredentialId || !onPreviewTts) {
      return
    }

    if (previewingVoiceId === voice.id) {
      stopPreviewPlayback()
      return
    }

    const demoText = String(previewText || '').trim() || buildVoicePreviewText(draft.name || avatar.name)
    const audio = previewAudioRef.current
    if (!audio || !demoText) {
      return
    }

    setPreviewError('')
    stopPreviewPlayback()

    const controller = new AbortController()
    previewAbortRef.current = controller
    setPreviewingVoiceId(voice.id)

    try {
      const response = await onPreviewTts({
        text: demoText,
        speechLanguage: draft.speechLanguage || 'auto',
        ttsCredentialId: Number(draft.ttsCredentialId),
        ttsVoiceId: voice.id,
      }, {
        signal: controller.signal,
      })

      await playStreamedAudioResponse(response, audio, {
        signal: controller.signal,
      })
    } catch (error) {
      if (!controller.signal.aborted) {
        setPreviewError(error?.message || 'Unable to play this voice preview.')
      }
    } finally {
      if (previewAbortRef.current === controller) {
        previewAbortRef.current = null
      }

      setPreviewingVoiceId((current) => (current === voice.id ? '' : current))
    }
  }, [
    avatar,
    draft.name,
    draft.speechLanguage,
    draft.ttsCredentialId,
    onPreviewTts,
    previewText,
    previewingVoiceId,
    stopPreviewPlayback,
  ])

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
            llmCredentialId: draft.llmCredentialId ? Number(draft.llmCredentialId) : null,
            presentationGender: draft.presentationGender || null,
            speechVoiceGender: draft.speechVoiceGender || null,
            speechLanguage: draft.speechLanguage || 'auto',
            ttsCredentialId: draft.ttsCredentialId ? Number(draft.ttsCredentialId) : null,
            ttsVoiceId: draft.ttsVoiceId || null,
          })}
          disabled={busy}
          className="rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Saving...' : 'Save profile'}
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
        <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Voice & speech</div>
              <div className="mt-1 text-sm text-white/60">
                Pick the speech defaults for this avatar. The endpoint comes from your saved voice connections, just like AI connections work.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDraft((current) => ({ ...current, showAllVoices: !current.showAllVoices }))}
              className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-xs text-white/70 transition hover:bg-white/10"
            >
              {draft.showAllVoices ? 'Match avatar tag' : 'Show all voices'}
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block space-y-2">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Avatar sex</div>
              <select
                value={draft.presentationGender}
                onChange={(event) => setDraft((current) => ({ ...current, presentationGender: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
              >
                <option value="">No tag yet</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </label>

            <label className="block space-y-2">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Voice override</div>
              <select
                value={draft.speechVoiceGender}
                onChange={(event) => setDraft((current) => ({ ...current, speechVoiceGender: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
              >
                <option value="">Follow avatar sex</option>
                <option value="female">Female voice</option>
                <option value="male">Male voice</option>
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

            <label className="block space-y-2">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Voice endpoint</div>
              <select
                value={draft.ttsCredentialId}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  ttsCredentialId: event.target.value,
                  ttsVoiceId: '',
                }))}
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
              >
                <option value="">Use browser speech only</option>
                {ttsCredentials.filter((credential) => credential.isActive).map((credential) => (
                  <option key={credential.id} value={credential.id}>
                    {credential.name} | {credential.defaultModel || 'default model'}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-white/45">Voice selection</div>
                <div className="mt-1 text-sm text-white/60">
                  {effectiveVoiceGender
                    ? `Voices tagged ${effectiveVoiceGender} are shown first for this avatar.`
                    : 'No voice filter yet. Add an avatar sex or override to narrow the list.'}
                </div>
              </div>
              <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
                {draft.ttsVoiceId ? 'Remote voice selected' : 'Browser fallback'}
              </div>
            </div>

            {!draft.ttsCredentialId ? (
              <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-4 text-sm text-white/55">
                Pick a saved voice endpoint first. Until then, this avatar will keep using browser speech.
              </div>
            ) : (
              <div className="mt-4">
                {ttsLoadError ? (
                  <div className="mb-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                    {ttsLoadError}
                  </div>
                ) : null}
                {previewError ? (
                  <div className="mb-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                    {previewError}
                  </div>
                ) : null}

                <label className="mb-3 block space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs uppercase tracking-[0.24em] text-white/45">Demo phrase</div>
                    <div className="text-[11px] text-white/40">Use the play button on any voice card to audition it.</div>
                  </div>
                  <textarea
                    value={previewText}
                    onChange={(event) => setPreviewText(event.target.value)}
                    rows={2}
                    placeholder="Add a short sample line to audition each voice."
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
                  />
                </label>

                <div className="grid gap-2">
                {filteredVoices.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-4 text-sm text-white/55">
                    No voices loaded for this endpoint yet.
                  </div>
                ) : null}
                {filteredVoices.map((voice) => {
                  const genderTag = normalizeGenderTag(voice.gender)
                  const isSelected = draft.ttsVoiceId === voice.id

                  return (
                    <div
                      key={voice.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setDraft((current) => ({ ...current, ttsVoiceId: voice.id }))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setDraft((current) => ({ ...current, ttsVoiceId: voice.id }))
                        }
                      }}
                      className={`cursor-pointer rounded-2xl border px-4 py-3 text-left transition focus:outline-none ${
                        isSelected
                          ? 'border-cyan-300/35 bg-cyan-300/12 text-cyan-100'
                          : 'border-white/10 bg-black/20 text-white/75 hover:border-cyan-300/20 hover:bg-white/10 focus:border-cyan-300/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{voice.name}</div>
                          <div className="mt-1 text-xs text-white/45">
                            {voice.description || voice.category || 'No description'}
                          </div>
                        </div>
                        <div className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60">
                          {genderTag || 'Untagged'}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                          {isSelected ? 'Selected for this avatar' : 'Click card to select'}
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            void handlePreviewVoice(voice)
                          }}
                          disabled={!draft.ttsCredentialId}
                          className={`rounded-2xl border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            previewingVoiceId === voice.id
                              ? 'border-amber-300/30 bg-amber-300/15 text-amber-100'
                              : 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/20'
                          }`}
                        >
                          {previewingVoiceId === voice.id ? 'Stop demo' : 'Play demo'}
                        </button>
                      </div>
                    </div>
                  )
                })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
