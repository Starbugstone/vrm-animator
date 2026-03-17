import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  filterVoicesForAvatar,
  getEffectiveSpeechLanguage,
  getEffectiveVoiceGender,
  getVoiceTagSummary,
  matchesVoiceSearch,
  normalizeGenderTag,
} from '../lib/ttsVoices.js'
import { playStreamedAudioResponse } from '../lib/streamingAudio.js'

const SPEECH_LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto detect' },
  { value: 'en-US', label: 'English' },
  { value: 'fr-FR', label: 'French' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'de-DE', label: 'German' },
  { value: 'it-IT', label: 'Italian' },
]

function buildVoicePreviewText(name, speechLanguage = 'auto') {
  const safeName = String(name || '').trim()
  const languageCode = String(speechLanguage || 'auto').trim().toLowerCase().split('-')[0]

  if (languageCode === 'fr') {
    return safeName
      ? `Bonjour, je m'appelle ${safeName}. Ceci est un court apercu de ma voix.`
      : 'Bonjour. Ceci est un court apercu de ma voix.'
  }

  if (languageCode === 'es') {
    return safeName
      ? `Hola, me llamo ${safeName}. Esta es una breve muestra de mi voz.`
      : 'Hola. Esta es una breve muestra de mi voz.'
  }

  if (languageCode === 'de') {
    return safeName
      ? `Hallo, ich bin ${safeName}. Das ist eine kurze Vorschau meiner Stimme.`
      : 'Hallo. Das ist eine kurze Vorschau meiner Stimme.'
  }

  if (languageCode === 'it') {
    return safeName
      ? `Ciao, mi chiamo ${safeName}. Questo e un breve esempio della mia voce.`
      : 'Ciao. Questo e un breve esempio della mia voce.'
  }

  if (safeName) {
    return `Hello, I'm ${safeName}. This is a quick preview of my voice.`
  }

  return 'Hello. This is a quick preview of my voice.'
}

function formatSpeechLanguageLabel(value) {
  const normalized = String(value || '').trim()
  if (!normalized || normalized.toLowerCase() === 'auto') {
    return 'Auto detect'
  }

  const matchedOption = SPEECH_LANGUAGE_OPTIONS.find((option) => option.value.toLowerCase() === normalized.toLowerCase())
  if (matchedOption) {
    return matchedOption.label
  }

  return normalized
}

function buildTextPayload(draft) {
  return {
    name: draft.name,
    backstory: draft.backstory,
    personality: draft.personality,
  }
}

function buildSelectPayload(draft) {
  return {
    llmCredentialId: draft.llmCredentialId ? Number(draft.llmCredentialId) : null,
    presentationGender: draft.presentationGender || null,
    speechVoiceGender: draft.speechVoiceGender || null,
    speechLanguage: draft.speechLanguage || 'auto',
    ttsCredentialId: draft.ttsCredentialId ? Number(draft.ttsCredentialId) : null,
    ttsVoiceId: draft.ttsVoiceId || null,
  }
}

function buildDraftFromAvatar(avatar, credentialId) {
  return {
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
  }
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
  const [voiceSearch, setVoiceSearch] = useState('')
  const [saveState, setSaveState] = useState('idle')
  const autoPreviewTextRef = useRef('')
  const previousAvatarIdRef = useRef(null)
  const lastSavedTextPayloadRef = useRef('')
  const lastSavedSelectPayloadRef = useRef('')
  const saveRequestRef = useRef(0)
  const draftRef = useRef(null)
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

  const syncAutoPreviewText = useCallback((name, speechLanguage, options = {}) => {
    const nextAutoText = buildVoicePreviewText(name, speechLanguage)
    const previousAutoText = autoPreviewTextRef.current
    autoPreviewTextRef.current = nextAutoText

    setPreviewText((current) => {
      if (options.force || String(current || '').trim() === '' || current === previousAutoText) {
        return nextAutoText
      }

      return current
    })
  }, [])

  useEffect(() => {
    const nextAvatarId = avatar?.id || null
    if (previousAvatarIdRef.current === nextAvatarId) {
      return
    }

    previousAvatarIdRef.current = nextAvatarId
    const nextDraft = buildDraftFromAvatar(avatar, credentialId)

    setDraft(nextDraft)
    lastSavedTextPayloadRef.current = JSON.stringify(buildTextPayload(nextDraft))
    lastSavedSelectPayloadRef.current = JSON.stringify(buildSelectPayload(nextDraft))
    setTtsLoadError('')
    syncAutoPreviewText(avatar?.name, avatar?.speechLanguage || 'auto', { force: true })
    setPreviewError('')
    setPreviewingVoiceId('')
    setVoiceSearch('')
    setSaveState('idle')
  }, [avatar?.id, credentialId, syncAutoPreviewText, avatar])

  useEffect(() => {
    if (!avatar?.id) {
      return
    }

    const nextCredentialId = credentialId ? String(credentialId) : ''
    if (!nextCredentialId) {
      return
    }

    setDraft((current) => {
      if (current.llmCredentialId === nextCredentialId || current.llmCredentialId !== '') {
        return current
      }

      const nextDraft = { ...current, llmCredentialId: nextCredentialId }
      lastSavedSelectPayloadRef.current = JSON.stringify(buildSelectPayload(nextDraft))
      return nextDraft
    })
  }, [avatar?.id, credentialId])

  useEffect(() => {
    syncAutoPreviewText(draft.name, draft.speechLanguage)
  }, [draft.name, draft.speechLanguage, syncAutoPreviewText])

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

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
  const effectiveSpeechLanguage = getEffectiveSpeechLanguage(draft)
  const textDirty = JSON.stringify(buildTextPayload(draft)) !== lastSavedTextPayloadRef.current
  const filteredVoices = useMemo(() => {
    const searchMatches = voiceSearch
      ? availableVoices.filter((voice) => matchesVoiceSearch(voice, voiceSearch))
      : availableVoices

    const visible = draft.showAllVoices || voiceSearch
      ? searchMatches
      : filterVoicesForAvatar(searchMatches, draft)
    const selectedVoice = availableVoices.find((voice) => voice.id === draft.ttsVoiceId)

    if (!voiceSearch && selectedVoice && !visible.some((voice) => voice.id === selectedVoice.id)) {
      return [selectedVoice, ...visible]
    }

    return visible
  }, [availableVoices, draft, voiceSearch])

  const saveSelectFields = useCallback(async (nextDraft) => {
    if (!avatar?.id || !onSave) {
      return
    }

    const payload = buildSelectPayload(nextDraft)
    const serializedPayload = JSON.stringify(payload)
    if (serializedPayload === lastSavedSelectPayloadRef.current) {
      setSaveState('saved')
      return
    }

    const requestId = saveRequestRef.current + 1
    saveRequestRef.current = requestId
    setSaveState('saving')

    try {
      await onSave(payload, { silentSuccess: true })
      if (saveRequestRef.current !== requestId) {
        return
      }

      lastSavedSelectPayloadRef.current = serializedPayload
      setSaveState(textDirty ? 'idle' : 'saved')
    } catch (error) {
      if (saveRequestRef.current !== requestId) {
        return
      }

      setSaveState('error')
    }
  }, [avatar?.id, onSave, textDirty])

  const applySelectChange = useCallback((patch) => {
    const currentDraft = draftRef.current || draft
    const nextDraft = { ...currentDraft, ...patch }
    draftRef.current = nextDraft
    setDraft(nextDraft)
    void saveSelectFields(nextDraft)
  }, [draft, saveSelectFields])

  const handleSaveTextFields = useCallback(async () => {
    if (!onSave) {
      return
    }

    setSaveState('saving')

    try {
      await onSave(buildTextPayload(draft), { silentSuccess: true })
      lastSavedTextPayloadRef.current = JSON.stringify(buildTextPayload(draft))
      setSaveState('saved')
    } catch (error) {
      setSaveState('error')
    }
  }, [draft, onSave])

  const handlePreviewVoice = useCallback(async (voice) => {
    if (!avatar?.id || !draft.ttsCredentialId || !onPreviewTts) {
      return
    }

    if (previewingVoiceId === voice.id) {
      stopPreviewPlayback()
      return
    }

    const demoText = String(previewText || '').trim() || buildVoicePreviewText(draft.name || avatar.name, draft.speechLanguage)
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
            This is the personality sheet for the selected avatar. Dropdown choices save immediately. Text fields stay local until you save them.
          </div>
        </div>
        <div className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${
          saveState === 'error'
            ? 'border-rose-300/25 bg-rose-300/10 text-rose-100'
            : saveState === 'saving' || busy
              ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100'
              : textDirty
                ? 'border-amber-300/25 bg-amber-300/10 text-amber-100'
                : 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
        }`}>
          {saveState === 'error'
            ? 'Save failed'
            : saveState === 'saving' || busy
              ? 'Saving'
              : textDirty
                ? 'Text unsaved'
                : 'Saved'}
        </div>
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
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void handleSaveTextFields()}
            disabled={!textDirty || busy}
            className="rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Saving...' : 'Save text fields'}
          </button>
        </div>

        <label className="block space-y-2">
          <div className="text-xs uppercase tracking-[0.24em] text-white/45">AI connection</div>
          <select
            value={draft.llmCredentialId}
            onChange={(event) => applySelectChange({ llmCredentialId: event.target.value })}
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
              {draft.showAllVoices ? 'Match avatar defaults' : 'Show all voices'}
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block space-y-2">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Avatar sex</div>
              <select
                value={draft.presentationGender}
                onChange={(event) => applySelectChange({ presentationGender: event.target.value })}
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
                onChange={(event) => applySelectChange({ speechVoiceGender: event.target.value })}
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
                onChange={(event) => applySelectChange({ speechLanguage: event.target.value })}
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
                onChange={(event) => applySelectChange({
                  ttsCredentialId: event.target.value,
                  ttsVoiceId: '',
                })}
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
                  {voiceSearch
                    ? 'Search checks voice name plus tags like language, accent, age, use case, and category.'
                    : effectiveVoiceGender || effectiveSpeechLanguage
                      ? `Matching voices for ${[
                        effectiveVoiceGender ? `${effectiveVoiceGender} voices` : '',
                        effectiveSpeechLanguage ? formatSpeechLanguageLabel(effectiveSpeechLanguage) : '',
                      ].filter(Boolean).join(' in ')} are shown.`
                      : 'No voice preference yet. Add an avatar sex, override, or speech language to narrow the list.'}
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
                    <div className="text-xs uppercase tracking-[0.24em] text-white/45">Search voices</div>
                    <div className="text-[11px] text-white/40">
                      {filteredVoices.length} shown / {availableVoices.length} loaded
                    </div>
                  </div>
                  <input
                    value={voiceSearch}
                    onChange={(event) => setVoiceSearch(event.target.value)}
                    placeholder="Search by name, language, accent, use case, or tag."
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
                  />
                </label>

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
                    {voiceSearch
                      ? 'No voices match this search for the current endpoint.'
                      : 'No voices loaded for this endpoint yet.'}
                  </div>
                ) : null}
                {filteredVoices.map((voice) => {
                  const genderTag = normalizeGenderTag(voice.gender)
                  const isSelected = draft.ttsVoiceId === voice.id
                  const tagSummary = getVoiceTagSummary(voice)

                  return (
                    <div
                      key={voice.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => applySelectChange({ ttsVoiceId: voice.id })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          applySelectChange({ ttsVoiceId: voice.id })
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
                          {tagSummary.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {tagSummary.map((tag) => (
                                <div
                                  key={`${voice.id}-${tag}`}
                                  className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/55"
                                >
                                  {tag}
                                </div>
                              ))}
                            </div>
                          ) : null}
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
