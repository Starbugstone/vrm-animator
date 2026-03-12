import { useEffect, useMemo, useState } from 'react'

function toKeywordString(keywords) {
  return Array.isArray(keywords) ? keywords.join(', ') : ''
}

export default function AnimationMetadataPanel({ animation, busy, onSave }) {
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    keywords: '',
    emotionTags: '',
  })

  useEffect(() => {
    setDraft({
      name: animation?.name || '',
      description: animation?.description || '',
      keywords: toKeywordString(animation?.keywords),
      emotionTags: toKeywordString(animation?.emotionTags),
    })
  }, [animation])

  const keywordPreview = useMemo(
    () =>
      draft.keywords
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    [draft.keywords],
  )
  const emotionTagPreview = useMemo(
    () =>
      draft.emotionTags
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    [draft.emotionTags],
  )

  if (!animation) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs uppercase tracking-[0.28em] text-white/45">Animation metadata</div>
        <div className="mt-3 text-sm text-white/60">Select one of your uploaded VRMA assets to edit its persisted metadata.</div>
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-white/45">Animation metadata</div>
          <div className="mt-1 text-sm text-white/60">
            {animation.kind} | {animation.filename}
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            onSave({
              name: draft.name,
              description: draft.description,
              keywords: keywordPreview,
              emotionTags: emotionTagPreview,
            })
          }
          disabled={busy}
          className="rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Saving...' : 'Save metadata'}
        </button>
      </div>

      <div className="space-y-3">
        <input
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          placeholder="Animation name"
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <textarea
          value={draft.description}
          onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
          placeholder="Description"
          rows={4}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <textarea
          value={draft.keywords}
          onChange={(event) => setDraft((current) => ({ ...current, keywords: event.target.value }))}
          placeholder="Keywords, comma separated"
          rows={3}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/65">
          Keywords preview: {keywordPreview.length > 0 ? keywordPreview.join(' | ') : 'none'}
        </div>
        <textarea
          value={draft.emotionTags}
          onChange={(event) => setDraft((current) => ({ ...current, emotionTags: event.target.value }))}
          placeholder="Emotion tags, comma separated"
          rows={3}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
        />
        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/65">
          Emotion tags: {emotionTagPreview.length > 0 ? emotionTagPreview.join(' | ') : 'none'}
        </div>
      </div>
    </section>
  )
}
