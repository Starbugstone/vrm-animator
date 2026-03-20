import { useCallback, useEffect, useMemo, useState } from 'react'
import AnimationMetadataPanel from './AnimationMetadataPanel.jsx'
import AvatarIdentityPanel from './AvatarIdentityPanel.jsx'
import AvatarPreviewCard from './AvatarPreviewCard.jsx'
import ChatAdminPanel from './ChatAdminPanel.jsx'
import LlmSettingsPanel from './LlmSettingsPanel.jsx'
import MemoryPanel from './MemoryPanel.jsx'
import HelpPopover from './HelpPopover.jsx'
import TtsSettingsPanel from './TtsSettingsPanel.jsx'
import { createPersistedAvatarAsset } from '../lib/viewerAssets.js'

const SECTIONS = [
  { id: 'avatar-edit', label: 'Studio Profile', status: 'Live' },
  { id: 'vrm-library', label: 'Model Library', status: 'Live' },
  { id: 'vrma-library', label: 'Animation Library', status: 'Live' },
  { id: 'llm-config', label: 'AI Routing', status: 'Live' },
  { id: 'tts-config', label: 'Voice & Speech', status: 'Live' },
  { id: 'chat', label: 'Conversation Lab', status: 'Live' },
  { id: 'procedural', label: 'Procedural', status: 'Planned' },
  { id: 'hologram', label: 'Hologram', status: 'Planned' },
]


const SECTION_HELP = {
  'avatar-edit': `Set up your avatar identity here.

- Name and personality shape how the avatar speaks
- Memory stores important long-term notes
- AI connection selects which credential/model this avatar uses`,
  'vrm-library': `Build your personal avatar library.

- Shared presets are starter avatars for everyone
- Creating from a preset copies it into your private library
- Uploading a file creates a brand-new personal avatar`,
  'vrma-library': `Manage animation files used during conversations.

- Upload VRMA files to your private library
- Add description and keywords so the model can choose them correctly
- Keep names clear so later tuning is easier`,
  'llm-config': `Connect one or more LLM providers.

- Add credentials and keep at least one active
- Pick a stable default model
- Credentials are required before chat can send messages`,
  'tts-config': `Connect ElevenLabs for spoken replies.

- Each user brings their own ElevenLabs API key
- Pick the avatar sex, optional voice override, and spoken language
- If no ElevenLabs voice is selected, the browser speech fallback stays active`,
  chat: `Run safe conversation tests before switching back to Viewer.

- Select an existing thread or start a new one
- Send a message with Enter
- Use this area to validate model behavior and tags`,
  procedural: `These controls are planned placeholders from the Stitch redesign.

- The current viewer only exposes a small subset of runtime automation
- Keep the UI visible so the product flow is coherent
- Track missing implementation work in TODO.md until the real hooks land`,
  hologram: `This is the planned control surface for dedicated projection output.

- Layout presets, prism calibration, and display toggles are not wired yet
- The current software product remains usable without hologram hardware
- The placeholder keeps the final workflow visible for future implementation`,
}

const SECTION_COPY = {
  'avatar-edit': {
    eyebrow: 'Studio profile',
    title: 'Identity, memory, and launch setup',
    description:
      'Shape the avatar character, memory, facing direction, and launch-ready defaults from one place.',
  },
  'vrm-library': {
    eyebrow: 'Model library',
    title: 'Choose, preview, and create avatars',
    description:
      'Browse starter models, preview them, and either adopt a shared preset or upload your own VRM or GLB.',
  },
  'vrma-library': {
    eyebrow: 'Animation library',
    title: 'Curate motions and overlays',
    description:
      'Upload personal VRMA clips, tag them for the LLM, and keep your motion catalog readable.',
  },
  'llm-config': {
    eyebrow: 'AI routing',
    title: 'Connect providers and pick models',
    description:
      'Store reusable provider credentials, choose defaults, and keep one reliable model ready for chat.',
  },
  'tts-config': {
    eyebrow: 'Voice & speech',
    title: 'Connect speech playback',
    description:
      'Attach ElevenLabs endpoints now and keep browser speech visible as the fallback path.',
  },
  chat: {
    eyebrow: 'Conversation lab',
    title: 'Test and inspect conversations',
    description:
      'Inspect saved threads, send controlled test prompts, and validate the avatar before returning to the workspace.',
  },
  procedural: {
    eyebrow: 'Procedural systems',
    title: 'Interaction and autonomy controls',
    description:
      'This screen now exposes the planned procedural feature set from the redesign so the workflow is visible before the runtime hooks land.',
  },
  hologram: {
    eyebrow: 'Hologram control',
    title: 'Projection presets and calibration',
    description:
      'This placeholder surface maps the future hologram workflow and keeps the interface ready for PIXELXL-style projection tooling.',
  },
}

const MANAGE_SECTION_KEY = 'workspace.manageSection'

const EMPTY_AVATAR_UPLOAD = {
  file: null,
  name: '',
  backstory: '',
  personality: '',
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
      <div className="mt-2 text-sm text-white/60">Upload a personal VRMA into your library. All of your avatars can use it, and thinking clips are reserved for the LLM waiting state.</div>

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
          <option value="thinking">Thinking / waiting</option>
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

function StatTile({ label, value, tone = 'default', detail }) {
  const toneClass = tone === 'success'
    ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
    : tone === 'warning'
      ? 'border-amber-300/20 bg-amber-300/10 text-amber-100'
      : tone === 'planned'
        ? 'border-white/10 bg-black/20 text-white/82'
        : 'border-cyan-300/15 bg-cyan-300/10 text-cyan-100'

  return (
    <div className={`rounded-[24px] border px-4 py-4 ${toneClass}`}>
      <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
      {detail ? <div className="mt-2 text-xs leading-5 text-white/60">{detail}</div> : null}
    </div>
  )
}

function PlaceholderSliderRow({ label, value, detail }) {
  return (
    <div className="space-y-3 rounded-[24px] border border-white/10 bg-black/20 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white/88">{label}</div>
          {detail ? <div className="mt-1 text-xs text-white/50">{detail}</div> : null}
        </div>
        <div className="text-sm font-mono text-cyan-100">{value}</div>
      </div>
      <input type="range" min="0" max="100" value="55" disabled className="w-full opacity-70" />
    </div>
  )
}

function PlaceholderToggleRow({ label, enabled, detail, disabled = false }) {
  return (
    <div className={`flex items-center justify-between gap-4 rounded-[24px] border border-white/10 px-4 py-4 ${disabled ? 'bg-black/10 opacity-55' : 'bg-black/20'}`}>
      <div>
        <div className="text-sm font-medium text-white/88">{label}</div>
        {detail ? <div className="mt-1 text-xs text-white/50">{detail}</div> : null}
      </div>
      <div className={`relative h-6 w-11 rounded-full border ${enabled ? 'border-cyan-300/35 bg-cyan-300/20' : 'border-white/10 bg-white/10'}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${enabled ? 'right-1' : 'left-1'}`} />
      </div>
    </div>
  )
}

function PlannedPanel({ eyebrow, title, description, children, footer }) {
  return (
    <section className="rounded-[32px] border border-white/10 bg-[rgba(8,15,22,0.82)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">{eyebrow}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</div>
          <div className="mt-3 max-w-3xl text-sm leading-6 text-white/62">{description}</div>
        </div>
        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60">
          Planned
        </div>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
      {footer ? <div className="mt-5 rounded-[24px] border border-cyan-300/15 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">{footer}</div> : null}
    </section>
  )
}

export default function ManagePage({ user, workspace }) {
  const {
    avatars,
    selectedAvatarId,
    animations,
    sharedAvatars,
    providers,
    credentials,
    ttsProviders,
    ttsCredentials,
    ttsVoicesByCredential,
    providerModels,
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
    saveAvatarFacing,
    removeAvatar,
    saveAnimationUpload,
    adoptSharedAvatar,
    saveAnimationMetadata,
    removeAnimation,
    saveMemory,
    resetMemory,
    compressMemory,
    loadProviderModelCatalog,
    loadOpenRouterCatalog,
    saveCredential,
    removeCredential,
    loadTtsVoiceCatalog,
    searchTtsVoiceLibrary,
    addVoiceLibraryVoice,
    saveTtsConnection,
    removeTtsConnection,
    saveAvatarTtsConfig,
    previewAvatarTts,
    sendChatMessage,
    token,
  } = workspace

  const [activeSection, setActiveSection] = useState(readInitialSection)
  const [selectedAnimationId, setSelectedAnimationId] = useState('')
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [notice, setNotice] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [avatarAutosaveBusy, setAvatarAutosaveBusy] = useState(false)
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
  const selectedAvatarPreviewAsset = useMemo(() => {
    if (!selectedAvatar || !token) return null

    return createPersistedAvatarAsset({
      id: selectedAvatar.id,
      filename: selectedAvatar.filename,
      name: selectedAvatar.name,
      defaultFacingYaw: selectedAvatar.defaultFacingYaw,
    }, token)
  }, [selectedAvatar?.id, selectedAvatar?.filename, selectedAvatar?.name, selectedAvatar?.defaultFacingYaw, token])
  const previewAsset = useMemo(() => {
    if (avatarUpload.file) return null
    if (selectedSharedPreset) return selectedSharedPreset
    return selectedAvatarPreviewAsset
  }, [avatarUpload.file, selectedAvatarPreviewAsset, selectedSharedPreset])
  const sectionCopy = SECTION_COPY[activeSection]
  const selectedAvatarIdValue = selectedAvatar?.id || null

  useEffect(() => {
    if (!selectedAvatarIdValue) {
      setActiveConversationId(null)
      return
    }

    let cancelled = false

    async function loadAvatarContext() {
      try {
        await Promise.all([
          ensurePersonas(selectedAvatarIdValue),
          ensureMemory(selectedAvatarIdValue),
        ])

        const loadedConversations = await ensureConversations(selectedAvatarIdValue)
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
  }, [ensureConversationMessages, ensureConversations, ensureMemory, ensurePersonas, selectedAvatarIdValue])

  const saveAvatarProfileAutosave = useCallback(async (payload) => {
    if (!selectedAvatarIdValue) {
      return
    }

    setAvatarAutosaveBusy(true)

    try {
      await saveAvatarIdentity(selectedAvatarIdValue, payload)
      await saveAvatarTtsConfig(selectedAvatarIdValue, {
        presentationGender: payload.presentationGender,
        speechVoiceGender: payload.speechVoiceGender,
        speechLanguage: payload.speechLanguage,
        speechMode: payload.speechMode,
        ttsCredentialId: payload.ttsCredentialId,
        ttsVoiceId: payload.ttsVoiceId,
      })
    } finally {
      setAvatarAutosaveBusy(false)
    }
  }, [saveAvatarIdentity, saveAvatarTtsConfig, selectedAvatarIdValue])

  async function runAction(key, action, successMessage) {
    setBusyKey(key)
    setNotice('')

    try {
      const result = await action()
      if (typeof successMessage === 'function') {
        const nextMessage = successMessage(result)
        if (nextMessage) setNotice(nextMessage)
      } else if (successMessage) {
        setNotice(successMessage)
      }
      return result
    } catch (nextError) {
      setNotice(nextError.message || 'Action failed.')
      throw nextError
    } finally {
      setBusyKey('')
    }
  }

  const handleLoadProviderModels = useCallback((options) => (
    loadProviderModelCatalog(options.provider, options)
  ), [loadProviderModelCatalog])

  return (
    <div className="min-h-screen bg-transparent text-white">
      <div className="mx-auto flex min-h-screen max-w-[1720px] gap-6 px-4 pb-10 pt-6 lg:px-6">
        <aside className="hidden w-[300px] shrink-0 xl:block">
          <div className="sticky top-6 space-y-4">
            <section className="rounded-[32px] border border-white/10 bg-[rgba(8,15,22,0.84)] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.28)]">
              <div className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">Control Center</div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-white">System surfaces</div>
              <div className="mt-3 text-sm leading-6 text-white/62">
                The redesigned layout now exposes the full avatar workflow, including planned procedural and hologram modules that will be wired later.
              </div>
            </section>

            <section className="rounded-[32px] border border-white/10 bg-[rgba(8,15,22,0.84)] p-3 shadow-[0_28px_90px_rgba(0,0,0,0.28)]">
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  disabled={Boolean(busyKey) || isBootstrapping}
                  className={`mb-2 flex w-full items-center justify-between rounded-[24px] px-4 py-3 text-left text-sm transition last:mb-0 disabled:cursor-not-allowed disabled:opacity-45 ${
                    activeSection === section.id
                      ? 'bg-cyan-300/18 text-cyan-100'
                      : 'bg-white/0 text-white/70 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <span>{section.label}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${
                    section.status === 'Planned'
                      ? 'border border-white/10 bg-white/5 text-white/55'
                      : 'border border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                  }`}>
                    {section.status}
                  </span>
                </button>
              ))}
            </section>

            <section className="rounded-[32px] border border-white/10 bg-[rgba(8,15,22,0.84)] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.28)]">
              <div className="text-xs uppercase tracking-[0.28em] text-white/45">Active avatar</div>
              <div className="mt-2 text-xl font-semibold text-white">{selectedAvatar?.name || 'No avatar selected'}</div>
              <div className="mt-2 text-sm text-white/60">
                {effectivePersona?.llmProvider ? `AI: ${effectivePersona.llmProvider}` : 'AI not attached yet'}
              </div>
              <div className="mt-1 text-sm text-white/55">
                {selectedAvatar?.speechMode === 'none'
                  ? 'Voice: no voice, text only'
                  : selectedAvatar?.ttsVoiceName
                    ? `Voice: ${selectedAvatar.ttsVoiceName}`
                    : 'Voice: browser fallback'}
              </div>
              <div className="mt-4 grid gap-3">
                <StatTile
                  label="Studio readiness"
                  value={hasPersonality ? 'Profile ready' : 'Needs profile'}
                  tone={hasPersonality ? 'success' : 'warning'}
                  detail={hasMemoryNotes ? 'Memory notes present.' : 'Memory still empty.'}
                />
                <StatTile
                  label="Signed in"
                  value={user?.displayName || user?.email}
                  tone="planned"
                  detail={user?.email}
                />
              </div>
            </section>
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-6">
          <header className="rounded-[34px] border border-white/10 bg-[rgba(8,15,22,0.78)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
            <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-end 2xl:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">{sectionCopy.eyebrow}</div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="text-3xl font-semibold tracking-tight text-white">{sectionCopy.title}</div>
                  <HelpPopover title={`${sectionCopy.title} help`} content={SECTION_HELP[activeSection]} />
                </div>
                <div className="mt-3 max-w-4xl text-sm leading-6 text-white/62">{sectionCopy.description}</div>
              </div>

              <div className="grid min-w-[320px] gap-3 sm:grid-cols-2">
                <StatTile
                  label="Current avatar"
                  value={selectedAvatar?.name || 'No avatar selected'}
                  detail={selectedAvatar?.filename || 'Choose one from Model Library'}
                />
                <StatTile
                  label="Chat route"
                  value={hasActiveCredential ? (effectivePersona?.llmProvider || 'Ready') : 'Not connected'}
                  tone={hasActiveCredential ? 'success' : 'warning'}
                  detail={selectedAvatar?.speechMode === 'none'
                    ? 'Text-only chat with cue annotations'
                    : selectedAvatar?.ttsVoiceName
                      ? `Voice ${selectedAvatar.ttsVoiceName}`
                      : 'Browser speech fallback'}
                />
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatTile
                label="Personal avatars"
                value={avatars.length}
                tone={avatars.length > 0 ? 'success' : 'warning'}
                detail={hasAvatarLibrary ? 'Private library available.' : 'Add a model to unlock editing and chat.'}
              />
              <StatTile
                label="Animations"
                value={animations.length}
                tone={animations.length > 0 ? 'success' : 'planned'}
                detail={animations.length > 0 ? 'Custom motion library present.' : 'Default motions only for now.'}
              />
              <StatTile
                label="Memory"
                value={hasMemoryNotes ? 'Primed' : 'Blank'}
                tone={hasMemoryNotes ? 'success' : 'warning'}
                detail={hasMemoryNotes ? `${memoryRevisions.length} saved revisions.` : 'Add relationship notes before long chats.'}
              />
              <StatTile
                label="Redesign coverage"
                value="Core + placeholders"
                tone="planned"
                detail="Procedural and hologram surfaces are visible but still pending implementation."
              />
            </div>

            {(isBootstrapping || busyKey) ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs text-cyan-100">
                <span className="h-4 w-4 rounded-full border-2 border-cyan-100/30 border-t-cyan-100 animate-spin" />
                {isBootstrapping ? 'Syncing backend workspace...' : 'Saving changes...'}
              </div>
            ) : null}
            {error ? <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
            {notice ? <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">{notice}</div> : null}
          </header>

          <div className="grid gap-3 xl:hidden sm:grid-cols-2">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                disabled={Boolean(busyKey) || isBootstrapping}
                className={`rounded-[24px] px-4 py-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${
                  activeSection === section.id
                    ? 'bg-cyan-300/18 text-cyan-100'
                    : 'border border-white/10 bg-[rgba(8,15,22,0.78)] text-white/70'
                }`}
              >
                <div className="font-medium">{section.label}</div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/45">{section.status}</div>
              </button>
            ))}
          </div>

          {activeSection === 'avatar-edit' ? (
            <div className="space-y-5">
              <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.2fr)_340px]">
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
                      asset={selectedAvatarPreviewAsset}
                      file={null}
                      helper="Rotate the avatar until the face is right, then save that direction as the default Viewer starting pose."
                      emptyLabel="Create an avatar in Model Library, then return here to edit its identity and memory."
                      defaultFacingYaw={selectedAvatar?.defaultFacingYaw || 0}
                      onSaveDefaultFacing={selectedAvatar
                        ? (defaultFacingYaw) => runAction(
                          'avatar-facing',
                          () => saveAvatarFacing(selectedAvatar.id, defaultFacingYaw),
                          'Avatar starting direction saved.',
                        )
                        : null}
                      saveFacingBusy={busyKey === 'avatar-facing'}
                    />
                  </div>

                  <div className="grid gap-5 xl:grid-cols-2">
                    <AvatarIdentityPanel
                      avatar={selectedAvatar}
                      credentialId={effectivePersona?.llmCredentialId || ''}
                      credentials={credentials}
                      ttsCredentials={ttsCredentials}
                      ttsVoicesByCredential={ttsVoicesByCredential}
                      onLoadTtsVoices={(credentialId, options) => loadTtsVoiceCatalog(credentialId, options)}
                      onSearchTtsVoiceLibrary={(credentialId, query) => searchTtsVoiceLibrary(credentialId, query)}
                      onAddTtsVoiceLibraryVoice={(credentialId, payload) => addVoiceLibraryVoice(credentialId, payload)}
                      onPreviewTts={(payload, options) => previewAvatarTts(selectedAvatar.id, payload, options)}
                      busy={avatarAutosaveBusy}
                      onSave={saveAvatarProfileAutosave}
                    />

                    <MemoryPanel
                      memory={memory}
                      revisions={memoryRevisions}
                      busy={busyKey === 'memory-save' || busyKey === 'memory-reset' || busyKey === 'memory-compress'}
                      onSave={(payload) => runAction('memory-save', () => saveMemory(selectedAvatar.id, payload), 'Memory updated.')}
                      onCompress={() => runAction(
                        'memory-compress',
                        () => compressMemory(selectedAvatar.id, { revision: memory.revision }),
                        (result) => result?.compressionRun?.summary || 'Memory compression finished.',
                      )}
                      onReset={() => runAction('memory-reset', async () => {
                        const result = await resetMemory(selectedAvatar.id)

                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('viewer:reset-speech-state', {
                            detail: { avatarId: selectedAvatar.id },
                          }))
                        }

                        return result
                      }, 'Bot memory and speech state reset.')}
                    />
                  </div>
                </div>

                <div className="space-y-5">
                  <section className="rounded-[32px] border border-white/10 bg-[rgba(8,15,22,0.82)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                    <div className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Launch checklist</div>
                    <div className="mt-4 grid gap-3">
                      <StatTile
                        label="Identity"
                        value={hasPersonality ? 'Ready' : 'Missing'}
                        tone={hasPersonality ? 'success' : 'warning'}
                        detail="Backstory and personality make the starter flow clearer."
                      />
                      <StatTile
                        label="Memory"
                        value={hasMemoryNotes ? 'Seeded' : 'Add notes'}
                        tone={hasMemoryNotes ? 'success' : 'warning'}
                        detail="Relationship notes improve first conversations."
                      />
                      <StatTile
                        label="AI"
                        value={hasActiveCredential ? 'Connected' : 'Connect one'}
                        tone={hasActiveCredential ? 'success' : 'warning'}
                        detail="A saved active provider is required before Viewer chat."
                      />
                    </div>
                  </section>

                  <section className="rounded-[32px] border border-white/10 bg-[rgba(8,15,22,0.82)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                    <div className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Redesign notes</div>
                    <div className="mt-3 text-sm leading-6 text-white/62">
                      The new Stitch layout adds room for procedural and hologram surfaces. Those screens are visible in the nav now so users can understand where those workflows will live later.
                    </div>
                  </section>
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === 'vrm-library' ? (
            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <StatTile
                  label="Shared presets"
                  value={sharedAvatarPresets.length}
                  detail="Starter avatars available to every account."
                />
                <StatTile
                  label="My models"
                  value={avatars.length}
                  tone={avatars.length > 0 ? 'success' : 'warning'}
                  detail="Personal avatars appear in Manage and Viewer."
                />
                <StatTile
                  label="Selected preset"
                  value={selectedSharedPreset?.label || 'None'}
                  tone="planned"
                  detail="Preview it before creating your own copy."
                />
                <StatTile
                  label="Upload state"
                  value={avatarUpload.file ? 'File selected' : 'Idle'}
                  tone={avatarUpload.file ? 'success' : 'planned'}
                  detail={avatarUpload.file?.name || 'Choose a VRM or GLB to start.'}
                />
              </div>

              <div className="grid gap-5 2xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="space-y-5">
                  <AvatarPreviewCard
                    asset={previewAsset}
                    file={avatarUpload.file}
                    helper="Preview the selected shared preset or the local file you are about to upload."
                    emptyLabel="Select a shared preset or choose a VRM or GLB file to preview it before creation."
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
                          llmCredentialId: null,
                        })
                        setAvatarUpload(EMPTY_AVATAR_UPLOAD)
                        setSelectedAvatarId(String(avatar.id))
                        setActiveSection('avatar-edit')
                      }, 'Avatar uploaded.')
                    }
                  />
                </div>

                <div className="space-y-5">
                  <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
                    <SharedPresetCard
                      items={sharedAvatarPresets}
                      selectedId={customAvatarDraft.sharedAvatarId}
                      onSelect={(presetId) => {
                        const nextSharedAvatar = sharedAvatarPresets.find((entry) => entry.id === presetId)
                        setCustomAvatarDraft(buildSharedAvatarDraft(nextSharedAvatar))
                        setAvatarUpload(EMPTY_AVATAR_UPLOAD)
                      }}
                    />

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
                            presentationGender: baseAvatar.presentationGender || '',
                          })

                          await saveAvatarIdentity(createdAvatar.id, {
                            name: customAvatarDraft.name || createdAvatar.name,
                            backstory: customAvatarDraft.backstory,
                            personality: customAvatarDraft.personality,
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
                  </div>

                  <AvatarLibraryPanel
                    avatars={avatars}
                    selectedAvatarId={selectedAvatarId}
                    onSelect={setSelectedAvatarId}
                    onDelete={(avatarId) => runAction('avatar-delete', () => removeAvatar(avatarId), 'Avatar deleted.')}
                    busy={busyKey === 'avatar-delete'}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === 'vrma-library' ? (
            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Uploaded clips" value={animations.length} detail="Personal VRMA files stored in your library." />
                <StatTile label="Selected clip" value={selectedAnimation?.name || 'None'} tone="planned" detail={selectedAnimation?.filename || 'Pick one from the list.'} />
                <StatTile label="Thinking clips" value={animations.filter((entry) => entry.kind === 'thinking').length} tone="planned" detail="Reserved for the waiting state." />
                <StatTile label="Expression overlays" value={animations.filter((entry) => entry.kind === 'expression').length} tone="planned" detail="Facial-only overlays should stay coherent." />
              </div>

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
            </div>
          ) : null}

          {activeSection === 'llm-config' ? (
            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Providers" value={providers.length} detail="OpenRouter, OpenAI, Gemini, DeepSeek, GLM, and MiniMax are available." />
                <StatTile label="Saved credentials" value={credentials.length} tone={credentials.length > 0 ? 'success' : 'warning'} detail="At least one active key is needed for chat." />
                <StatTile label="Selected avatar route" value={effectivePersona?.llmProvider || 'Not attached'} tone={hasActiveCredential ? 'success' : 'warning'} detail={effectivePersona?.llmCredentialId ? 'Primary persona has an active connection.' : 'Attach one from Studio Profile.'} />
                <StatTile label="Model catalog" value={isModelsLoading ? 'Loading' : 'Ready'} tone={isModelsLoading ? 'warning' : 'success'} detail="Model search stays provider-specific." />
              </div>

              <LlmSettingsPanel
                providers={providers}
                credentials={credentials}
                models={providerModels}
                busy={busyKey === 'credential-save' || busyKey === 'credential-delete'}
                modelsBusy={isModelsLoading}
                onLoadModels={handleLoadProviderModels}
                onSaveCredential={(payload) => runAction('credential-save', () => saveCredential(payload), 'Credential saved.')}
                onDeleteCredential={(credentialId) => runAction('credential-delete', () => removeCredential(credentialId), 'Credential deleted.')}
              />

              <PlannedPanel
                eyebrow="Planned AI controls"
                title="Routing, fallback, and policy presets"
                description="These options were present in the Stitch redesign but do not have backend support yet."
                footer="The current live behavior still uses one chosen provider/model per saved credential. Multi-step routing and policy presets remain TODO work."
              >
                <div className="grid gap-4 xl:grid-cols-2">
                  <PlaceholderToggleRow label="Automatic fallback chain" enabled detail="Retry with a secondary provider when the primary route fails." />
                  <PlaceholderToggleRow label="Cost-aware routing" enabled={false} detail="Prefer cheaper models for low-stakes turns." />
                  <PlaceholderSliderRow label="Reasoning budget" value="Balanced" detail="Expose a simpler user-facing depth control later." />
                  <PlaceholderSliderRow label="Response verbosity" value="Medium" detail="Future UX control for concise versus expansive replies." />
                </div>
              </PlannedPanel>
            </div>
          ) : null}

          {activeSection === 'tts-config' ? (
            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Voice providers" value={ttsProviders.length} detail="ElevenLabs is the current supported backend TTS provider." />
                <StatTile label="Saved endpoints" value={ttsCredentials.length} tone={ttsCredentials.length > 0 ? 'success' : 'warning'} detail="Attach endpoints first, then pick voices per avatar." />
                <StatTile label="Selected avatar voice" value={selectedAvatar?.speechMode === 'none' ? 'No voice' : (selectedAvatar?.ttsVoiceName || 'Browser fallback')} tone={selectedAvatar?.speechMode === 'none' ? 'planned' : (selectedAvatar?.ttsVoiceName ? 'success' : 'planned')} detail={selectedAvatar?.speechMode === 'none' ? 'Text-only chat with cue annotations stays active.' : (selectedAvatar?.speechLanguage ? `Language ${selectedAvatar.speechLanguage}` : 'Language auto detect.')} />
                <StatTile label="Voice catalog cache" value={Object.keys(ttsVoicesByCredential).length} tone="planned" detail="Loaded voice lists stay scoped by credential." />
              </div>

              <TtsSettingsPanel
                providers={ttsProviders}
                credentials={ttsCredentials}
                busy={busyKey === 'tts-credential-save' || busyKey === 'tts-credential-delete'}
                onSaveCredential={(payload) => runAction('tts-credential-save', () => saveTtsConnection(payload), 'ElevenLabs connection saved.')}
                onDeleteCredential={(credentialId) => runAction('tts-credential-delete', () => removeTtsConnection(credentialId), 'ElevenLabs connection deleted.')}
              />

              <PlannedPanel
                eyebrow="Planned speech controls"
                title="Voice automation and delivery tuning"
                description="The redesign included deeper speech direction options that are not connected yet."
                footer="Current production behavior supports backend-streamed ElevenLabs audio and browser speech fallback. Emotional voice mapping and advanced delivery tuning are still pending."
              >
                <div className="grid gap-4 xl:grid-cols-2">
                  <PlaceholderToggleRow label="Emotion-aware voice switching" enabled={false} detail="Map reply mood to voice style or preset." />
                  <PlaceholderToggleRow label="Auto language lock" enabled detail="Stick to one language for a session unless explicitly changed." />
                  <PlaceholderSliderRow label="Speech cadence" value="1.0x" detail="Future per-avatar pacing control." />
                  <PlaceholderSliderRow label="Expressiveness" value="72%" detail="Planned abstraction above raw provider options." />
                </div>
              </PlannedPanel>
            </div>
          ) : null}

          {activeSection === 'chat' ? (
            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Saved threads" value={conversations.length} detail="Conversation history for the selected avatar." />
                <StatTile label="Loaded messages" value={chatMessages.length} tone="planned" detail="Messages for the active thread in the lab." />
                <StatTile label="Persona route" value={effectivePersona?.name || selectedAvatar?.name || 'None'} tone={selectedAvatar ? 'success' : 'warning'} detail={hasActiveCredential ? 'Ready for controlled testing.' : 'Attach AI before sending.'} />
                <StatTile label="Viewer handoff" value="Available" tone="success" detail="Use Workspace after validating replies here." />
              </div>

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
            </div>
          ) : null}

          {activeSection === 'procedural' ? (
            <div className="space-y-5">
              <PlannedPanel
                eyebrow="Procedural stack"
                title="Interaction and autonomous behavior"
                description={`These redesigned controls are placeholders for future runtime systems. ${selectedAvatar ? `${selectedAvatar.name} is the current target avatar.` : 'Select an avatar to see how these controls will eventually apply.'}`}
                footer="Current live runtime control remains limited to the existing Viewer motion, speech, and camera options. The cards below are visual placeholders only."
              >
                <div className="grid gap-4 xl:grid-cols-2">
                  <PlaceholderSliderRow label="Blink speed" value="1.2s" detail="Planned control for average blink interval." />
                  <PlaceholderSliderRow label="Blink variation" value="45%" detail="Randomness around the base blink cadence." />
                  <PlaceholderSliderRow label="Breathing intensity" value="0.65" detail="Subtle chest and shoulder motion control." />
                  <PlaceholderToggleRow label="Shoulder movement" enabled detail="Blend shoulder lift into the breathing loop." />
                </div>
              </PlannedPanel>

              <PlannedPanel
                eyebrow="Lip sync"
                title="Mic input, sensitivity, and vowel shaping"
                description="The redesign called for live input controls and vowel meters. None of those hooks exist in the current runtime yet."
              >
                <div className="grid gap-4 xl:grid-cols-2">
                  <PlaceholderToggleRow label="Studio microphone routing" enabled detail="Use a chosen capture input for future live lip sync." />
                  <PlaceholderSliderRow label="Sensitivity threshold" value="-42dB" detail="Ignore room noise below this level." />
                  <PlaceholderToggleRow label="Real-time vowel monitor" enabled={false} detail="Show detected A / E / O emphasis during capture." />
                  <PlaceholderToggleRow label="Background gate" enabled detail="Mute low-level idle hum from the mic path." />
                </div>
              </PlannedPanel>

              <PlannedPanel
                eyebrow="Interaction"
                title="Hitboxes and tactile response"
                description="These planned toggles match the redesigned interaction settings screen."
              >
                <div className="grid gap-4 xl:grid-cols-3">
                  <PlaceholderToggleRow label="Head reactivity" enabled detail="Head tracking and pet interaction responses." />
                  <PlaceholderToggleRow label="Hand collision" enabled detail="Future self-collision and object contact." />
                  <PlaceholderToggleRow label="Body physics" enabled={false} detail="Clothing and hair dynamics." />
                </div>
              </PlannedPanel>
            </div>
          ) : null}

          {activeSection === 'hologram' ? (
            <div className="space-y-5">
              <PlannedPanel
                eyebrow="Projection presets"
                title="Hologram layout and control center"
                description="This placeholder screen maps the future dedicated projection workflow for PIXELXL-style prism output and related hologram hardware."
                footer="No separate hologram window, prism renderer, or calibration transport is implemented yet. The layout remains visible here so the future workflow is explicit."
              >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {['Looking Glass', "Pepper's Ghost", 'PIXELXL Prism', 'SBS Mode', 'Top-Bottom', 'Custom'].map((preset) => (
                    <div
                      key={preset}
                      className={`rounded-[24px] border px-4 py-5 ${preset === 'PIXELXL Prism' ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100' : 'border-white/10 bg-black/20 text-white/78'}`}
                    >
                      <div className="text-lg font-semibold">{preset}</div>
                      <div className="mt-2 text-sm text-white/58">
                        {preset === 'PIXELXL Prism' ? 'Primary target for the planned four-view hologram pipeline.' : 'Placeholder preset card from the redesign.'}
                      </div>
                    </div>
                  ))}
                </div>
              </PlannedPanel>

              <PlannedPanel
                eyebrow="Calibration"
                title="Projection tuning and display flags"
                description="Future controls for contrast, offsets, view mirroring, and stereoscopic display behavior."
              >
                <div className="grid gap-4 xl:grid-cols-2">
                  <PlaceholderSliderRow label="View offset" value="14mm" detail="Shift the projected prism framing." />
                  <PlaceholderSliderRow label="Projection contrast" value="82%" detail="Brightness and contrast tuning for hardware output." />
                  <PlaceholderToggleRow label="Transparent background" enabled detail="Hide standard scene background for projection clarity." />
                  <PlaceholderToggleRow label="Stereoscopic rendering" enabled={false} detail="Disabled until a real renderer path exists." disabled />
                </div>
              </PlannedPanel>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
