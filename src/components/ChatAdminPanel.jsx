import { useEffect, useMemo, useState } from 'react'

export default function ChatAdminPanel({
  avatar,
  conversations,
  messages,
  credentials,
  activeConversationId,
  busy,
  loadingConversations,
  loadingMessages,
  onConversationSelect,
  onSendMessage,
}) {
  const [draft, setDraft] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState('')
  const [credentialId, setCredentialId] = useState('')
  const [model, setModel] = useState('')

  const credentialOptions = useMemo(
    () => credentials.filter((entry) => entry.isActive),
    [credentials],
  )

  useEffect(() => {
    setSelectedConversationId(conversations[0]?.id ? String(conversations[0].id) : '')
  }, [avatar?.id])

  useEffect(() => {
    setSelectedConversationId(activeConversationId ? String(activeConversationId) : '')
  }, [activeConversationId])

  useEffect(() => {
    if (credentialOptions.length > 0 && !credentialOptions.some((entry) => String(entry.id) === credentialId)) {
      const nextCredential = credentialOptions[0]
      setCredentialId(String(nextCredential.id))
      setModel(nextCredential.defaultModel || '')
    }
  }, [credentialId, credentialOptions])

  useEffect(() => {
    const credential = credentialOptions.find((entry) => String(entry.id) === credentialId)
    if (credential && !model) {
      setModel(credential.defaultModel || '')
    }
  }, [credentialId, model, credentialOptions])

  if (!avatar) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs uppercase tracking-[0.28em] text-white/45">Conversation test</div>
        <div className="mt-3 text-sm text-white/60">Pick one of your saved avatars first, then send a test message from here.</div>
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4 md:col-span-2 xl:col-span-1">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-white/45">Conversation test</div>
          <div className="mt-1 text-sm text-white/60">Saved conversations and test messages for {avatar.name}.</div>
        </div>
        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/60">
          {conversations.length} threads
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-[0.24em] text-white/45">Conversations</div>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {loadingConversations ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/60">Loading conversations...</div>
            ) : null}
            {!loadingConversations && conversations.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/60">No conversations yet.</div>
            ) : null}
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => {
                  setSelectedConversationId(String(conversation.id))
                  onConversationSelect(conversation.id)
                }}
                className={`block w-full rounded-2xl border px-3 py-2 text-left text-sm transition ${
                  selectedConversationId === String(conversation.id)
                    ? 'border-cyan-300/35 bg-cyan-300/12 text-cyan-100'
                    : 'border-white/10 bg-black/20 text-white/75 hover:border-cyan-300/20 hover:bg-white/10'
                }`}
              >
                <div className="font-medium">{conversation.title || 'Untitled conversation'}</div>
                <div className="mt-1 text-xs text-white/45">{conversation.provider} · {conversation.model || 'no model'}</div>
                <div className="mt-1 text-[11px] text-white/40">{conversation.messageCount} messages</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={credentialId}
              onChange={(event) => {
                setCredentialId(event.target.value)
                const nextCredential = credentialOptions.find((entry) => String(entry.id) === event.target.value)
                if (nextCredential) {
                  setModel(nextCredential.defaultModel || '')
                }
              }}
              className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
            >
              {credentialOptions.length === 0 ? <option value="">No active AI connections</option> : null}
              {credentialOptions.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} ({entry.provider})
                </option>
              ))}
            </select>
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="Model id (optional)"
              className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
            />
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto rounded-3xl border border-white/10 bg-black/20 p-3">
            {loadingMessages ? (
              <div className="rounded-2xl bg-black/30 px-3 py-2 text-sm text-white/60">Loading messages...</div>
            ) : null}
            {!loadingMessages && messages.length === 0 ? (
              <div className="rounded-2xl bg-black/30 px-3 py-2 text-sm text-white/60">Send a message below to start the first conversation.</div>
            ) : null}
            {messages.map((message) => (
              <div key={message.id} className={`rounded-2xl px-3 py-3 text-sm ${
                message.role === 'assistant' ? 'bg-cyan-300/10 text-cyan-50' : 'bg-white/8 text-white/80'
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">{message.role}</div>
                  <div className="text-[11px] text-white/35">{new Date(message.createdAt).toLocaleTimeString()}</div>
                </div>
                <div className="mt-2 whitespace-pre-wrap leading-6">{message.content}</div>
                {message.emotionTags?.length > 0 || message.animationTags?.length > 0 ? (
                  <div className="mt-2 text-xs text-white/45">
                    {[message.emotionTags?.length ? `emotion: ${message.emotionTags.join(', ')}` : null, message.animationTags?.length ? `animation: ${message.animationTags.join(', ')}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            placeholder="Type a test message for this avatar"
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                if (!draft.trim()) return

                await onSendMessage({
                  message: draft,
                  conversationId: selectedConversationId ? Number(selectedConversationId) : null,
                  credentialId: credentialId ? Number(credentialId) : null,
                  model,
                })
                setDraft('')
              }}
              disabled={busy || credentialOptions.length === 0}
              className="rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Sending...' : 'Send message'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedConversationId('')
                onConversationSelect(null)
              }}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/75 transition hover:border-cyan-300/20 hover:bg-white/10"
            >
              New conversation
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
