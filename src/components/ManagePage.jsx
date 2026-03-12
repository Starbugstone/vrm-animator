import { useEffect, useMemo, useState } from 'react'
import AnimationMetadataPanel from './AnimationMetadataPanel.jsx'
import AvatarIdentityPanel from './AvatarIdentityPanel.jsx'
import AvatarPreviewCard from './AvatarPreviewCard.jsx'
import ChatAdminPanel from './ChatAdminPanel.jsx'
import LlmSettingsPanel from './LlmSettingsPanel.jsx'
import MemoryPanel from './MemoryPanel.jsx'
import SetupGuideCard from './SetupGuideCard.jsx'
import { createPersistedAvatarAsset } from '../lib/viewerAssets.js'

const SECTIONS = [
  { id: 'avatar-edit', label: 'Profile' },
  { id: 'vrm-library', label: 'Avatar Library' },
  { id: 'vrma-library', label: 'Animation Library' },
  { id: 'llm-config', label: 'AI Connection' },
  { id: 'chat', label: 'Conversation Test' },
]

const SECTION_COPY = {
  'avatar-edit': {
    eyebrow: 'Avatar profile',
    title: 'Identity and memory',
    description:
      'Name the avatar, describe its personality, add memory, and choose the AI connection it should use.',
  },
  'vrm-library': {
    eyebrow: 'Avatar library',
    title: 'Choose or create an avatar',
    description:
      'Start with a shared starter avatar or upload your own VRM or GLB file. Saved avatars become available everywhere in the app.',
  },
  'vrma-library': {
    eyebrow: 'Animation library',
    title: 'Animation library',
    description:
      'Upload and organize extra VRMA animations. This is optional for first-time setup.',
  },
  'llm-config': {
    eyebrow: 'AI connection',
    title: 'Connect an AI provider',
    description:
      'Add one working API key, choose a default model, and keep it active so the avatar can reply.',
  },
  chat: {
    eyebrow: 'Conversation test',
    title: 'Test a conversation',
    description:
      'Review saved conversations and send a test message before moving back to the Viewer.',
  },
}

const MANAGE_SECTION_KEY = 'workspace.manageSection'

const EMPTY_AVATAR_UPLOAD = {
  file: null,
  name: '',
  backstory: '',
  personality: '',
  systemPrompt: '',
}

const EMPTY_ANIMATION_UPLOAD = {
  file: null,
  kind: 'action',
  name: '',
  description: '',
  keywords: '',
  emotionTags: '',
}

const EMPTY_CUSTOM_AVATAR = {
  sharedAvatarId: '',
  name: '',
  backstory: '',
  personality: '',
  systemPrompt: '',
  memory: '',
}

function readInitialSection() {
  if (typeof window === 'undefined') return 'avatar-edit'

  const storedSection = window.localStorage.getItem(MANAGE_SECTION_KEY)
  return SECTIONS.some((section) => section.id === storedSection) ? storedSection : 'avatar-edit'
}

function normalizeSharedAvatarPreset(asset) {
  return {
    ...asset,
    id: String(asset.id),
    type: asset.type || 'avatar',
    source: asset.source || 'shared',
  }
}

function toList(value) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function buildSharedAvatarDraft(sharedAvatar) {
  if (!sharedAvatar) {
    return EMPTY_CUSTOM_AVATAR
  }

  return {
    ...EMPTY_CUSTOM_AVATAR,
    sharedAvatarId: sharedAvatar.id,
    name: sharedAvatar.label || '',
    backstory: sharedAvatar.backstory || sharedAvatar.description || '',
    personality: sharedAvatar.personality || '',
    systemPrompt: sharedAvatar.systemPrompt || '',
  }
}

function AssetListCard({
  title,
  subtitle,
  items,
  selectedId,
  onSelect,
  onDelete,
  emptyLabel,
  itemLabel,
  busy,
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[rgba(8,14,28,0.8)] p-5 shadow-[0_24px_80px_rgba(3,7,18,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">{title}</div>
          <div className="mt-2 text-sm text-white/60">{subtitle}</div>
        </div>
        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/55">
          {items.length}
        </div>
      </div>

      <select
        value={selectedId}
        onChange={(event) => onSelect(event.target.value)}
        size={Math.min(10, Math.max(5, items.length || 5))}
        className="mt-4 h-56 w-full rounded-3xl border border-white/10 bg-black/25 p-3 text-sm text-white outline-none focus:border-cyan-300/40"
      >
        {items.length === 0 ? <option value="">{emptyLabel}</option> : null}
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {itemLabel(item)}
          </option>
        ))}
      </select>

      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={busy || !selectedId}
          className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-300/10 px-4 py-2 text-sm font-medium text-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete selected
        </button>
      ) : null}
    </section>
  )
}

function AvatarLibraryPanel({
  avatars,
  selectedAvatarId,
  onSelect,
  onDelete,
  busy,
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[rgba(8,14,28,0.8)] p-5 shadow-[0_24px_80px_rgba(3,7,18,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">My avatars</div>
          <div className="mt-2 text-sm text-white/60">
            Your private avatar library. Select one card to make it the active configured avatar across Manage and Viewer.
          </div>
        </div>
        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/55">
          {avatars.length}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {avatars.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/55 sm:col-span-2">
            No avatars yet.
          </div>
        ) : null}
        {avatars.map((avatar) => {
          const isSelected = String(avatar.id) === selectedAvatarId

          return (
            <button
              key={avatar.id}
              type="button"
              onClick={() => onSelect(String(avatar.id))}
              className={`rounded-3xl border p-4 text-left transition ${
                isSelected
                  ? 'border-cyan-300/40 bg-cyan-300/12 text-cyan-50 shadow-[0_18px_45px_rgba(34,211,238,0.12)]'
                  : 'border-white/10 bg-[rgba(255,255,255,0.02)] text-white/76 hover:border-cyan-300/20 hover:bg-white/6'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold">{avatar.name}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/45">
                    {avatar.filename}
                  </div>
                </div>
                {isSelected ? (
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-cyan-100">
                    Active
                  </span>
                ) : null}
              </div>

              <div className="mt-3 line-clamp-3 text-sm leading-6 text-white/62">
                {avatar.backstory || 'No backstory yet.'}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-xs text-white/50">
                  {avatar.personality ? 'Personality configured' : 'Identity incomplete'}
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDelete(avatar.id)
                  }}
                  disabled={busy}
                  className="rounded-2xl border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-xs font-medium text-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function SharedPresetCard({ items, selectedId, onSelect }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[rgba(8,14,28,0.8)] p-5 shadow-[0_24px_80px_rgba(3,7,18,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Shared presets</div>
          <div className="mt-2 text-sm text-white/60">Default avatars available to every user account.</div>
        </div>
        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/55">
          {items.length}
        </div>
      </div>

      <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/55">
            No shared presets available.
          </div>
        ) : null}
        {items.map((item) => {
          const isSelected = item.id === selectedId

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                isSelected
                  ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-50'
                  : 'border-white/10 bg-[rgba(255,255,255,0.02)] text-white/76 hover:border-cyan-300/20 hover:bg-white/6'
              }`}
            >
              <div className="font-medium">{item.label}</div>
              <div className="mt-1 text-sm leading-6 text-white/60">{item.description || item.backstory || 'No description'}</div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function SharedAvatarBuilder({
  sharedAvatars,
  draft,
  busy,
  onChange,
  onSubmit,
}) {
  const selectedSharedAvatar = sharedAvatars.find((entry) => entry.id === draft.sharedAvatarId) || null

  return (
    <section className="rounded-[28px] border border-cyan-300/16 bg-[linear-gradient(180deg,rgba(14,24,45,0.94),rgba(8,14,28,0.88))] p-5 shadow-[0_30px_90px_rgba(3,7,18,0.38)]">
      <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Create from shared preset</div>
      <div className="mt-2 text-sm leading-6 text-white/62">
        Choose one default avatar, then create your own editable account copy with its own memory and LLM identity.
      </div>

      <div className="mt-4 space-y-3">
        <select
          value={draft.sharedAvatarId}
          onChange={(event) => onChange('sharedAvatarId', event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
        >
          <option value="">Choose a shared avatar preset</option>
          {sharedAvatars.map((avatar) => (
            <option key={avatar.id} value={avatar.id}>
              {avatar.label}
            </option>
          ))}
        </select>

        <input
          value={draft.name}
          onChange={(event) => onChange('name', event.target.value)}
          placeholder={selectedSharedAvatar ? `Name for your ${selectedSharedAvatar.label} copy` : 'Avatar name'}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <textarea
          value={draft.backstory}
          onChange={(event) => onChange('backstory', event.target.value)}
          placeholder="Backstory"
          rows={3}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <textarea
          value={draft.personality}
          onChange={(event) => onChange('personality', event.target.value)}
          placeholder="Personality"
          rows={3}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <textarea
          value={draft.systemPrompt}
          onChange={(event) => onChange('systemPrompt', event.target.value)}
          placeholder="System prompt"
          rows={4}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <textarea
          value={draft.memory}
          onChange={(event) => onChange('memory', event.target.value)}
          placeholder="Initial memory.md content"
          rows={6}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy || !draft.sharedAvatarId}
          className="rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-3 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Creating avatar...' : 'Create personal avatar from preset'}
        </button>
      </div>
    </section>
  )
}

function AvatarUploadCard({ busy, draft, onChange, onSubmit }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[rgba(8,14,28,0.8)] p-5 shadow-[0_24px_80px_rgba(3,7,18,0.35)]">
      <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Upload personal VRM</div>
      <div className="mt-2 text-sm text-white/60">
        Upload your own VRM or GLB, preview it immediately, and create the avatar record with its single identity.
      </div>

      <div className="mt-4 space-y-3">
        <input
          type="file"
          accept=".vrm,.glb"
          onChange={(event) => onChange('file', event.target.files?.[0] || null)}
          className="block w-full rounded-2xl border border-dashed border-white/15 bg-black/25 px-3 py-3 text-sm text-white file:mr-3 file:rounded-full file:border-0 file:bg-cyan-300/15 file:px-3 file:py-2 file:text-cyan-100"
        />
        <input
          value={draft.name}
          onChange={(event) => onChange('name', event.target.value)}
          placeholder="Avatar name"
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <textarea
          value={draft.backstory}
          onChange={(event) => onChange('backstory', event.target.value)}
          placeholder="Backstory"
          rows={3}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <textarea
          value={draft.personality}
          onChange={(event) => onChange('personality', event.target.value)}
          placeholder="Personality"
          rows={3}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <textarea
          value={draft.systemPrompt}
          onChange={(event) => onChange('systemPrompt', event.target.value)}
          placeholder="System prompt"
          rows={4}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy || !draft.file}
          className="rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-3 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Uploading avatar...' : 'Create avatar from uploaded file'}
        </button>
      </div>
    </section>
  )
}

function AnimationUploadCard({ busy, draft, onChange, onSubmit }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[rgba(8,14,28,0.8)] p-5 shadow-[0_24px_80px_rgba(3,7,18,0.35)]">
      <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Upload animation</div>
      <div className="mt-2 text-sm text-white/60">Upload a personal VRMA into your library. All of your avatars can use it.</div>

      <div className="mt-4 space-y-3">
        <input
          type="file"
          accept=".vrma"
          onChange={(event) => onChange('file', event.target.files?.[0] || null)}
          className="block w-full rounded-2xl border border-dashed border-white/15 bg-black/25 px-3 py-3 text-sm text-white file:mr-3 file:rounded-full file:border-0 file:bg-cyan-300/15 file:px-3 file:py-2 file:text-cyan-100"
        />
        <select
          value={draft.kind}
          onChange={(event) => onChange('kind', event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
        >
          <option value="action">Action</option>
          <option value="idle">Idle</option>
          <option value="expression">Expression</option>
        </select>
        <input
          value={draft.name}
          onChange={(event) => onChange('name', event.target.value)}
          placeholder="Animation name"
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <textarea
          value={draft.description}
          onChange={(event) => onChange('description', event.target.value)}
          placeholder="Description"
          rows={3}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <input
          value={draft.keywords}
          onChange={(event) => onChange('keywords', event.target.value)}
          placeholder="Keywords, comma separated"
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <input
          value={draft.emotionTags}
          onChange={(event) => onChange('emotionTags', event.target.value)}
          placeholder="Emotion tags, comma separated"
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy || !draft.file}
          className="rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-3 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Uploading animation...' : 'Upload animation'}
        </button>
      </div>
    </section>
  )
}

function EffectiveAvatarPersona({ avatar, persona }) {
  if (!avatar) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-[rgba(8,14,28,0.8)] p-5 shadow-[0_24px_80px_rgba(3,7,18,0.35)]">
        <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Selected avatar</div>
        <div className="mt-3 text-sm text-white/60">No avatar selected.</div>
      </section>
    )
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-[rgba(8,14,28,0.8)] p-5 shadow-[0_24px_80px_rgba(3,7,18,0.35)]">
      <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Selected avatar</div>
      <div className="mt-3 text-2xl font-semibold text-white">{avatar.name}</div>
      <div className="mt-3 text-sm leading-6 text-white/62">{avatar.backstory || 'No backstory yet.'}</div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-white/65">
          Identity: {persona?.name || avatar.name}
        </span>
        <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-white/65">
          LLM: {persona?.llmProvider || 'none'}
        </span>
      </div>
    </section>
  )
}

export default function ManagePage({ user, workspace, onNavigatePage }) {
  const {
    avatars,
    selectedAvatarId,
    animations,
    sharedAvatars,
    providers,
    credentials,
    openRouterModels,
    personasByAvatar,
    memoryByAvatar,
    memoryRevisionsByAvatar,
    conversationsByAvatar,
    messagesByConversation,
    isBootstrapping,
    isModelsLoading,
    error,
    setSelectedAvatarId,
    ensurePersonas,
    ensureMemory,
    ensureConversations,
    ensureConversationMessages,
    saveAvatarUpload,
    saveAvatarIdentity,
    removeAvatar,
    saveAnimationUpload,
    adoptSharedAvatar,
    saveAnimationMetadata,
    removeAnimation,
    saveMemory,
    loadOpenRouterCatalog,
    saveCredential,
    removeCredential,
    sendChatMessage,
    token,
  } = workspace

  const [activeSection, setActiveSection] = useState(readInitialSection)
  const [selectedAnimationId, setSelectedAnimationId] = useState('')
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [notice, setNotice] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [avatarUpload, setAvatarUpload] = useState(EMPTY_AVATAR_UPLOAD)
  const [animationUpload, setAnimationUpload] = useState(EMPTY_ANIMATION_UPLOAD)
  const [customAvatarDraft, setCustomAvatarDraft] = useState(EMPTY_CUSTOM_AVATAR)

  useEffect(() => {
    window.localStorage.setItem(MANAGE_SECTION_KEY, activeSection)
  }, [activeSection])

  useEffect(() => {
    if (animations.length === 0) {
      if (selectedAnimationId) {
        setSelectedAnimationId('')
      }
      return
    }

    const hasSelectedAnimation = animations.some((entry) => String(entry.id) === selectedAnimationId)
    if (!hasSelectedAnimation) {
      setSelectedAnimationId(String(animations[0].id))
    }
  }, [animations, selectedAnimationId])

  const selectedAvatar = useMemo(
    () => avatars.find((entry) => String(entry.id) === selectedAvatarId) || null,
    [avatars, selectedAvatarId],
  )
  const selectedAnimation = useMemo(
    () => animations.find((entry) => String(entry.id) === selectedAnimationId) || null,
    [animations, selectedAnimationId],
  )
  const sharedAvatarPresets = useMemo(
    () => sharedAvatars.map((entry) => normalizeSharedAvatarPreset(entry)),
    [sharedAvatars],
  )
  const selectedAvatarPersonas = selectedAvatar ? personasByAvatar[selectedAvatar.id] || [] : []
  const effectivePersona = useMemo(
    () => selectedAvatarPersonas.find((entry) => entry.isPrimary) || selectedAvatarPersonas[0] || null,
    [selectedAvatarPersonas],
  )
  const memory = selectedAvatar ? memoryByAvatar[selectedAvatar.id] || null : null
  const memoryRevisions = selectedAvatar ? memoryRevisionsByAvatar[selectedAvatar.id] || [] : []
  const conversations = selectedAvatar ? conversationsByAvatar[selectedAvatar.id] || [] : []
  const chatMessages = activeConversationId ? messagesByConversation[activeConversationId] || [] : []
  const hasAvatarLibrary = avatars.length > 0
  const hasPersonality = Boolean(selectedAvatar && ((selectedAvatar.name || '').trim() && ((selectedAvatar.personality || '').trim() || (selectedAvatar.backstory || '').trim())))
  const hasMemoryNotes = Boolean(memory?.markdownContent?.trim())
  const hasActiveCredential = Boolean(effectivePersona?.llmCredentialId)

  const selectedSharedPreset = useMemo(
    () => sharedAvatarPresets.find((entry) => entry.id === customAvatarDraft.sharedAvatarId) || null,
    [customAvatarDraft.sharedAvatarId, sharedAvatarPresets],
  )
  const previewAsset = useMemo(() => {
    if (avatarUpload.file) return null
    if (selectedSharedPreset) return selectedSharedPreset
    if (!selectedAvatar || !token) return null
    return createPersistedAvatarAsset(selectedAvatar, token)
  }, [avatarUpload.file, selectedAvatar, selectedSharedPreset, token])
  const sectionCopy = SECTION_COPY[activeSection]

  useEffect(() => {
    if (!selectedAvatar) {
      setActiveConversationId(null)
      return
    }

    let cancelled = false

    async function loadAvatarContext() {
      try {
        await Promise.all([
          ensurePersonas(selectedAvatar.id),
          ensureMemory(selectedAvatar.id),
        ])

        const loadedConversations = await ensureConversations(selectedAvatar.id)
        if (cancelled) return

        const nextConversationId = loadedConversations[0]?.id || null
        setActiveConversationId(nextConversationId)
        if (nextConversationId) {
          await ensureConversationMessages(nextConversationId)
        }
      } catch (nextError) {
        if (!cancelled) {
          setNotice(nextError.message || 'Unable to load avatar context.')
        }
      }
    }

    loadAvatarContext()

    return () => {
      cancelled = true
    }
  }, [ensureConversationMessages, ensureConversations, ensureMemory, ensurePersonas, selectedAvatar])

  const setupSteps = useMemo(() => [
    {
      id: 'avatar',
      title: 'Pick a starter avatar or upload your own',
      detail: hasAvatarLibrary
        ? `${avatars.length} avatar${avatars.length > 1 ? 's are' : ' is'} ready in your personal library.`
        : 'Begin with a shared starter avatar for the fastest path, or upload a VRM/GLB file if you already have one.',
      status: hasAvatarLibrary ? 'done' : activeSection === 'vrm-library' ? 'current' : 'todo',
      actionLabel: activeSection === 'vrm-library' ? null : 'Open Avatar Library',
      onAction: activeSection === 'vrm-library' ? null : () => setActiveSection('vrm-library'),
    },
    {
      id: 'identity',
      title: 'Give the avatar a clear profile',
      detail: selectedAvatar
        ? hasPersonality
          ? `${selectedAvatar.name} has a saved profile. You can refine it any time.`
          : 'Add a name plus a short backstory or personality so the avatar feels intentional.'
        : 'Choose an avatar first, then fill in the profile and memory on the Profile screen.',
      status: hasPersonality ? 'done' : activeSection === 'avatar-edit' ? 'current' : 'todo',
      actionLabel: activeSection === 'avatar-edit' ? null : 'Open Profile',
      onAction: activeSection === 'avatar-edit' ? null : () => setActiveSection('avatar-edit'),
    },
    {
      id: 'llm',
      title: 'Connect one AI provider',
      detail: hasActiveCredential
        ? 'This avatar already has an active AI connection and is ready to talk.'
        : 'Paste one provider API key and keep that connection active. You only need one working setup to start.',
      status: hasActiveCredential ? 'done' : activeSection === 'llm-config' ? 'current' : 'todo',
      actionLabel: activeSection === 'llm-config' ? null : 'Open AI Connection',
      onAction: activeSection === 'llm-config' ? null : () => setActiveSection('llm-config'),
    },
    {
      id: 'chat',
      title: 'Start the first conversation',
      detail: conversations.length > 0
        ? 'This avatar already has saved conversations. You can continue here or move to the Viewer.'
        : hasMemoryNotes
          ? 'The setup is close. Test one message here or jump to the Viewer for the full experience.'
          : 'Optional: add a few memory notes first, then send the first message in Viewer.',
      status: conversations.length > 0 ? 'done' : activeSection === 'chat' ? 'current' : 'todo',
      actionLabel: conversations.length > 0 ? 'Open Viewer' : activeSection === 'chat' ? 'Open Viewer' : 'Open Conversation Test',
      onAction: conversations.length > 0
        ? () => onNavigatePage('viewer')
        : activeSection === 'chat'
          ? () => onNavigatePage('viewer')
          : () => setActiveSection('chat'),
    },
  ], [
    activeSection,
    avatars.length,
    conversations.length,
    hasActiveCredential,
    hasAvatarLibrary,
    hasMemoryNotes,
    hasPersonality,
    onNavigatePage,
    selectedAvatar,
  ])

  async function runAction(key, action, successMessage) {
    setBusyKey(key)
    setNotice('')

    try {
      const result = await action()
      if (successMessage) setNotice(successMessage)
      return result
    } catch (nextError) {
      setNotice(nextError.message || 'Action failed.')
      throw nextError
    } finally {
      setBusyKey('')
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#18355c_0%,_#08111f_36%,_#04070d_100%)] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1680px] gap-6 px-4 pb-8 pt-6 lg:px-6">
        <aside className="hidden w-[260px] shrink-0 lg:block">
          <div className="sticky top-6 space-y-4">
            <section className="rounded-[32px] border border-white/10 bg-[rgba(6,10,20,0.82)] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.28)]">
              <div className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">Setup</div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-white">Avatar setup</div>
              <div className="mt-3 text-sm leading-6 text-white/62">
                Follow the steps in order: choose an avatar, fill in the profile, connect one AI provider, then test the first conversation.
              </div>
            </section>

            <section className="rounded-[32px] border border-white/10 bg-[rgba(6,10,20,0.82)] p-3 shadow-[0_28px_90px_rgba(0,0,0,0.28)]">
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`mb-2 block w-full rounded-2xl px-4 py-3 text-left text-sm transition last:mb-0 ${
                    activeSection === section.id
                      ? 'bg-cyan-300/18 text-cyan-100'
                      : 'bg-white/0 text-white/70 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </section>

            <section className="rounded-[32px] border border-white/10 bg-[rgba(6,10,20,0.82)] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.28)]">
              <div className="text-xs uppercase tracking-[0.28em] text-white/45">Signed in</div>
              <div className="mt-2 text-sm font-medium text-cyan-100">{user?.displayName || user?.email}</div>
              <div className="mt-1 text-xs text-white/48">{user?.email}</div>
            </section>
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-6">
          <header className="rounded-[32px] border border-white/10 bg-[rgba(6,10,20,0.72)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">{sectionCopy.eyebrow}</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight">{sectionCopy.title}</div>
                <div className="mt-3 max-w-3xl text-sm leading-6 text-white/62">
                  {sectionCopy.description}
                </div>
              </div>

              <div className="min-w-[320px] rounded-[28px] border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.24em] text-white/45">Current avatar</div>
                <div className="mt-2 text-lg font-medium text-white">{selectedAvatar?.name || 'No avatar selected'}</div>
                <div className="mt-2 text-sm text-white/58">
                  {effectivePersona?.llmProvider
                    ? `Connected to ${effectivePersona.llmProvider}`
                    : 'No AI connected yet'}
                </div>
              </div>
            </div>

            {isBootstrapping ? <div className="mt-4 text-sm text-cyan-100/80">Syncing backend workspace...</div> : null}
            {error ? <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
            {notice ? <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">{notice}</div> : null}
          </header>

          <SetupGuideCard
            title="Start here if you want the fastest path"
            description="This checklist is aimed at first-time, non-technical setup. It points to the next step instead of expecting you to already know the workflow."
            steps={setupSteps}
          />

          <div className="grid gap-4 lg:hidden">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`rounded-2xl px-4 py-3 text-left text-sm transition ${
                  activeSection === section.id
                    ? 'bg-cyan-300/18 text-cyan-100'
                    : 'border border-white/10 bg-[rgba(6,10,20,0.72)] text-white/70'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>

          {activeSection === 'avatar-edit' ? (
            <div className="space-y-5">
              <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
                <div className="space-y-5">
                  <AvatarLibraryPanel
                    avatars={avatars}
                    selectedAvatarId={selectedAvatarId}
                    onSelect={setSelectedAvatarId}
                    onDelete={(avatarId) => runAction('avatar-delete', () => removeAvatar(avatarId), 'Avatar deleted.')}
                    busy={busyKey === 'avatar-delete'}
                  />

                  <EffectiveAvatarPersona avatar={selectedAvatar} persona={effectivePersona} />
                </div>

                <AvatarPreviewCard
                  asset={selectedAvatar && token ? createPersistedAvatarAsset(selectedAvatar, token) : null}
                  file={null}
                  helper="The preview follows the avatar record currently selected in your personal library."
                  emptyLabel="Create an avatar in VRM Uploads, then return here to edit its identity and memory."
                />
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <AvatarIdentityPanel
                  avatar={selectedAvatar}
                  credentialId={effectivePersona?.llmCredentialId || ''}
                  credentials={credentials}
                  busy={busyKey === 'avatar-save'}
                  onSave={(payload) =>
                    runAction('avatar-save', () => saveAvatarIdentity(selectedAvatar.id, payload), 'Avatar identity saved.')
                  }
                />

                <MemoryPanel
                  memory={memory}
                  revisions={memoryRevisions}
                  busy={busyKey === 'memory-save'}
                  onSave={(payload) => runAction('memory-save', () => saveMemory(selectedAvatar.id, payload), 'Memory updated.')}
                />
              </div>
            </div>
          ) : null}

          {activeSection === 'vrm-library' ? (
            <div className="space-y-5">
              <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
                <SharedPresetCard
                  items={sharedAvatarPresets}
                  selectedId={customAvatarDraft.sharedAvatarId}
                  onSelect={(presetId) => {
                    const nextSharedAvatar = sharedAvatarPresets.find((entry) => entry.id === presetId)
                    setCustomAvatarDraft(buildSharedAvatarDraft(nextSharedAvatar))
                    setAvatarUpload(EMPTY_AVATAR_UPLOAD)
                  }}
                />

                <AvatarPreviewCard
                  asset={previewAsset}
                  file={avatarUpload.file}
                  helper="Preview the selected shared preset or the local VRM file you are about to upload."
                  emptyLabel="Select a shared preset or choose a VRM or GLB file to preview it before creation."
                />
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <SharedAvatarBuilder
                  sharedAvatars={sharedAvatarPresets}
                  draft={customAvatarDraft}
                  busy={busyKey === 'custom-avatar-create'}
                  onChange={(key, value) => {
                    if (key === 'sharedAvatarId') {
                      const nextSharedAvatar = sharedAvatarPresets.find((entry) => entry.id === value)
                      setCustomAvatarDraft(buildSharedAvatarDraft(nextSharedAvatar))
                      return
                    }

                    setCustomAvatarDraft((current) => ({ ...current, [key]: value }))
                  }}
                  onSubmit={() =>
                    runAction('custom-avatar-create', async () => {
                      const baseAvatar = sharedAvatarPresets.find((entry) => entry.id === customAvatarDraft.sharedAvatarId)
                      if (!baseAvatar) {
                        throw new Error('Select a shared avatar first.')
                      }

                      const createdAvatar = await adoptSharedAvatar(baseAvatar, {
                        name: customAvatarDraft.name,
                        backstory: customAvatarDraft.backstory,
                        personality: customAvatarDraft.personality,
                        systemPrompt: customAvatarDraft.systemPrompt,
                      })

                      await saveAvatarIdentity(createdAvatar.id, {
                        name: customAvatarDraft.name || createdAvatar.name,
                        backstory: customAvatarDraft.backstory,
                        personality: customAvatarDraft.personality,
                        systemPrompt: customAvatarDraft.systemPrompt,
                        llmCredentialId: null,
                      })

                      if (customAvatarDraft.memory.trim()) {
                        const memoryState = await ensureMemory(createdAvatar.id, { force: true })
                        await saveMemory(createdAvatar.id, {
                          markdownContent: customAvatarDraft.memory,
                          revision: memoryState.memory?.revision || 1,
                        })
                      }

                      setSelectedAvatarId(String(createdAvatar.id))
                      setCustomAvatarDraft(EMPTY_CUSTOM_AVATAR)
                      setActiveSection('avatar-edit')
                    }, 'Custom avatar created.')
                  }
                />

                <AvatarUploadCard
                  busy={busyKey === 'avatar-upload'}
                  draft={avatarUpload}
                  onChange={(key, value) => {
                    setAvatarUpload((current) => ({ ...current, [key]: value }))
                    if (key === 'file') {
                      setCustomAvatarDraft(EMPTY_CUSTOM_AVATAR)
                    }
                  }}
                  onSubmit={() =>
                    runAction('avatar-upload', async () => {
                      const avatar = await saveAvatarUpload(avatarUpload)
                      await saveAvatarIdentity(avatar.id, {
                        name: avatarUpload.name || avatar.name,
                        backstory: avatarUpload.backstory,
                        personality: avatarUpload.personality,
                        systemPrompt: avatarUpload.systemPrompt,
                        llmCredentialId: null,
                      })
                      setAvatarUpload(EMPTY_AVATAR_UPLOAD)
                      setSelectedAvatarId(String(avatar.id))
                      setActiveSection('avatar-edit')
                    }, 'Avatar uploaded.')
                  }
                />
              </div>
            </div>
          ) : null}

          {activeSection === 'vrma-library' ? (
            <div className="grid gap-5 xl:grid-cols-2">
              <AnimationUploadCard
                busy={busyKey === 'animation-upload'}
                draft={animationUpload}
                onChange={(key, value) => setAnimationUpload((current) => ({ ...current, [key]: value }))}
                onSubmit={() =>
                  runAction('animation-upload', async () => {
                    const animation = await saveAnimationUpload({
                      ...animationUpload,
                      keywords: toList(animationUpload.keywords),
                      emotionTags: toList(animationUpload.emotionTags),
                    })
                    setAnimationUpload(EMPTY_ANIMATION_UPLOAD)
                    setSelectedAnimationId(String(animation.id))
                  }, 'Animation uploaded.')
                }
              />

              <AssetListCard
                title="My animations"
                subtitle="Edit or delete the uploaded animation records in your personal library."
                items={animations}
                selectedId={selectedAnimationId}
                onSelect={setSelectedAnimationId}
                onDelete={() => selectedAnimation && runAction('animation-delete', () => removeAnimation(selectedAnimation.id), 'Animation deleted.')}
                emptyLabel="No animations yet"
                itemLabel={(item) => `${item.kind}: ${item.name}`}
                busy={busyKey === 'animation-delete'}
              />

              <div className="xl:col-span-2">
                <AnimationMetadataPanel
                  animation={selectedAnimation}
                  busy={busyKey === 'animation-save'}
                  onSave={(payload) =>
                    runAction('animation-save', () => saveAnimationMetadata(selectedAnimation.id, payload), 'Animation metadata saved.')
                  }
                />
              </div>
            </div>
          ) : null}

          {activeSection === 'llm-config' ? (
            <LlmSettingsPanel
              providers={providers}
              credentials={credentials}
              models={openRouterModels}
              busy={busyKey === 'credential-save' || busyKey === 'credential-delete'}
              modelsBusy={isModelsLoading}
              onLoadModels={loadOpenRouterCatalog}
              onSaveCredential={(payload) => runAction('credential-save', () => saveCredential(payload), 'Credential saved.')}
              onDeleteCredential={(credentialId) => runAction('credential-delete', () => removeCredential(credentialId), 'Credential deleted.')}
            />
          ) : null}

          {activeSection === 'chat' ? (
            <ChatAdminPanel
              avatar={selectedAvatar}
              conversations={conversations}
              messages={chatMessages}
              credentials={credentials}
              activeConversationId={activeConversationId}
              busy={busyKey === 'chat-send'}
              loadingConversations={false}
              loadingMessages={false}
              onConversationSelect={(conversationId) => {
                setActiveConversationId(conversationId)
                if (conversationId) {
                  ensureConversationMessages(conversationId).catch((nextError) => setNotice(nextError.message))
                }
              }}
              onSendMessage={(payload) =>
                runAction('chat-send', async () => {
                  const response = await sendChatMessage(selectedAvatar.id, {
                    ...payload,
                    personaId: effectivePersona?.id || undefined,
                  })
                  setActiveConversationId(response.conversation.id)
                }, 'Message sent.')
              }
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
