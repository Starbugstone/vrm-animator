import { useEffect, useState } from 'react'

function formatPercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0%'
  return `${Math.round(value * 100)}%`
}

function formatJson(value) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return '{}'
  }
}

function MetricCard({ label, value, detail }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
      {detail ? <div className="mt-1 text-xs text-white/50">{detail}</div> : null}
    </div>
  )
}

function DetailBlock({ title, body }) {
  return (
    <details className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
      <summary className="cursor-pointer list-none text-sm font-medium text-white/82">{title}</summary>
      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-white/62">{body}</pre>
    </details>
  )
}

export default function MemoryPanel({ memory, revisions, busy, onSave, onCompress, onReset }) {
  const [draft, setDraft] = useState('')
  const [warningDismissKey, setWarningDismissKey] = useState('')
  const [warningOpen, setWarningOpen] = useState(false)

  useEffect(() => {
    setDraft(memory?.markdownContent || '')
  }, [memory])

  useEffect(() => {
    const warning = memory?.warning || {}
    const nextKey = `${memory?.id || 'memory'}:${memory?.revision || 0}:${memory?.llmConfiguration?.model || 'no-model'}`

    if (warning.shouldWarn && warningDismissKey !== nextKey) {
      setWarningOpen(true)
      return
    }

    if (!warning.shouldWarn) {
      setWarningOpen(false)
    }
  }, [memory, warningDismissKey])

  if (!memory) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs uppercase tracking-[0.28em] text-white/45">Memory</div>
        <div className="mt-3 text-sm text-white/60">
          Select an avatar first, then save a few notes it should remember about the user or the relationship.
        </div>
      </section>
    )
  }

  const stats = memory.memoryStats || {}
  const llmConfiguration = memory.llmConfiguration || {}
  const chatMemoryContext = memory.chatMemoryContext || {}
  const compression = memory.compression || {}
  const compressionRequest = compression.requestPreview || null
  const warning = memory.warning || {}
  const warningKey = `${memory.id || 'memory'}:${memory.revision || 0}:${llmConfiguration.model || 'no-model'}`

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
      {warningOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
          <div className="w-full max-w-lg rounded-[28px] border border-amber-300/25 bg-[rgba(18,12,4,0.96)] p-5 shadow-[0_32px_100px_rgba(0,0,0,0.42)]">
            <div className="text-xs uppercase tracking-[0.28em] text-amber-200/70">Memory warning</div>
            <div className="mt-3 text-2xl font-semibold text-white">{warning.headline || 'Memory is getting heavy for this model.'}</div>
            <div className="mt-3 text-sm leading-6 text-white/70">
              {warning.message || 'The selected model may have less room left for chat history and rules.'}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MetricCard
                label="Reserved memory budget"
                value={formatPercent(stats.budgetUtilization)}
                detail={`Threshold ${Math.round((warning.threshold || 0.7) * 100)}%`}
              />
              <MetricCard
                label="Estimated prompt share"
                value={formatPercent(stats.estimatedPromptShare)}
                detail={`Memory section ~${stats.chatSectionEstimatedTokens || 0} tokens of ~${stats.estimatedPromptTokens || 0}`}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setWarningOpen(false)
                  void onCompress?.()
                }}
                disabled={busy || !compression.available}
                className="rounded-2xl border border-fuchsia-300/30 bg-fuchsia-300/12 px-4 py-2 text-sm font-medium text-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Working...' : 'Compress memory now'}
              </button>
              <button
                type="button"
                onClick={() => setWarningOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setWarningDismissKey(warningKey)
                  setWarningOpen(false)
                }}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-white/65"
              >
                Dismiss for this revision
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-white/45">Memory</div>
          <div className="mt-1 text-sm text-white/60">
            Save facts the avatar should remember between chats. Revision {memory.revision} | Last updated by {memory.lastUpdatedBy}
          </div>
          <div className="mt-2 text-xs text-white/45">
            {llmConfiguration.available
              ? `Avatar AI: ${llmConfiguration.providerLabel || llmConfiguration.provider} | ${llmConfiguration.model || 'model not set'}`
              : llmConfiguration.unavailableReason || 'Connect an AI model to inspect and compress memory with the avatar configuration.'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSave({ markdownContent: draft, revision: memory.revision })}
            disabled={busy}
            className="rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Working...' : 'Save memory'}
          </button>
          <button
            type="button"
            onClick={onCompress}
            disabled={busy || !compression.available}
            className="rounded-2xl border border-fuchsia-300/30 bg-fuchsia-300/12 px-4 py-2 text-sm font-medium text-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Working...' : 'Compress with avatar AI'}
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={busy}
            className="rounded-2xl border border-amber-300/30 bg-amber-300/12 px-4 py-2 text-sm font-medium text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Working...' : 'Dev reset'}
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Stored memory"
          value={`~${stats.rawEstimatedTokens || 0} tokens`}
          detail={`${stats.rawCharacters || 0} chars`}
        />
        <MetricCard
          label="Injected memory"
          value={`~${stats.compactedEstimatedTokens || 0} tokens`}
          detail={`${stats.compactedCharacters || 0} chars after compaction`}
        />
        <MetricCard
          label="Prompt budget"
          value={`~${stats.budgetEstimatedTokens || 0} tokens`}
          detail={`${stats.budgetCharacters || 0} chars for the memory excerpt`}
        />
        <MetricCard
          label="Budget use"
          value={formatPercent(stats.budgetUtilization)}
          detail={`Chat memory section ~${stats.chatSectionEstimatedTokens || 0} tokens including the memory heading`}
        />
        <MetricCard
          label="Prompt share"
          value={formatPercent(stats.estimatedPromptShare)}
          detail={`~${stats.estimatedPromptTokens || 0} estimated prompt tokens before the new user turn`}
        />
      </div>

      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={14}
        placeholder="- The user likes short answers.\n- The avatar should greet them warmly.\n- They talked about games yesterday."
        className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
      />

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <DetailBlock
          title="Memory directive passed to chat"
          body={chatMemoryContext.directive || 'No directive available.'}
        />
        <DetailBlock
          title="Compacted memory injected into chat"
          body={chatMemoryContext.compactedMarkdown || 'No compacted memory available.'}
        />
        <DetailBlock
          title="Exact memory system section sent to the LLM"
          body={chatMemoryContext.systemSection || 'No system section available.'}
        />
        <DetailBlock
          title="How memory replies are handled"
          body={(chatMemoryContext.replyHandling || []).join('\n')}
        />
        <DetailBlock
          title="Compression request preview"
          body={compressionRequest ? formatJson(compressionRequest) : (llmConfiguration.unavailableReason || 'Compression is unavailable until an avatar AI connection is configured.')}
        />
        <DetailBlock
          title="Compression reply handling"
          body={(compression.responseHandling || []).join('\n')}
        />
      </div>

      <div className="mt-4 text-xs uppercase tracking-[0.24em] text-white/40">Recent revisions</div>
      <div className="mt-2 space-y-2">
        {revisions.slice(0, 5).map((entry) => (
          <div key={entry.id} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/65">
            Revision {entry.revision} | {entry.source} | {new Date(entry.createdAt).toLocaleString()}
          </div>
        ))}
      </div>
    </section>
  )
}
