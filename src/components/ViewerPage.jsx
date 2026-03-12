import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CameraPopover from '../CameraPopover.jsx'
import useHologramViewer from '../useHologramViewer.js'
import AnimationPopover from './AnimationPopover.jsx'
import {
  assetToFile,
  createPersistedAnimationAsset,
  createPersistedAvatarAsset,
} from '../lib/viewerAssets.js'

const VIEWER_OPTION_LABELS = {
  autoBlink: 'Auto blink',
  lookAtCamera: 'Eyes follow camera',
}

function normalizeSharedAsset(asset, fallbackType) {
  return {
    ...asset,
    id: String(asset.id),
    type: asset.type || fallbackType,
    source: asset.source || 'shared',
  }
}

export default function ViewerPage({ workspace }) {
  const {
    avatars,
    selectedAvatarId,
    animations,
    sharedAvatars,
    sharedAnimationGroups,
    personasByAvatar,
    conversationsByAvatar,
    messagesByConversation,
    ensurePersonas,
    ensureConversations,
    ensureConversationMessages,
    setSelectedAvatarId,
    sendChatMessage,
  } = workspace

  const canvasRef = useRef(null)
  const {
    loadFile,
    setIdleAnimation,
    setIdleVariantPool,
    playAnimationFile,
    playOverlayAnimationFile,
    setFramingValue,
    setViewerOption,
    viewerOptions,
    framingState,
    status,
    isLoaded,
    isAvatarLoading,
  } = useHologramViewer(canvasRef)

  const [selectedViewerAvatarId, setSelectedViewerAvatarId] = useState('')
  const [selectedIdleId, setSelectedIdleId] = useState('')
  const [selectedActionId, setSelectedActionId] = useState('')
  const [selectedExpressionId, setSelectedExpressionId] = useState('')
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [draftMessage, setDraftMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [isChatBusy, setIsChatBusy] = useState(false)
  const [loadedAvatarName, setLoadedAvatarName] = useState('No avatar loaded')
  const lastSyncedAvatarIdRef = useRef(selectedAvatarId)

  const personalAvatarItems = useMemo(
    () => avatars.map((entry) => ({ ...createPersistedAvatarAsset(entry, workspace.token), scope: 'personal' })),
    [avatars, workspace.token],
  )
  const sharedAvatarItems = useMemo(
    () => sharedAvatars.map((entry) => ({ ...normalizeSharedAsset(entry, 'avatar'), scope: 'shared' })),
    [sharedAvatars],
  )
  const viewerAvatarItems = useMemo(
    () => [...personalAvatarItems, ...sharedAvatarItems],
    [personalAvatarItems, sharedAvatarItems],
  )

  useEffect(() => {
    const selectedPersonalViewerId = selectedAvatarId ? `avatar:user:${selectedAvatarId}` : ''
    const personalSelectionExists = selectedPersonalViewerId
      ? viewerAvatarItems.some((entry) => entry.id === selectedPersonalViewerId)
      : false
    const currentSelectionExists = selectedViewerAvatarId
      ? viewerAvatarItems.some((entry) => entry.id === selectedViewerAvatarId)
      : false
    const selectedAvatarChanged = lastSyncedAvatarIdRef.current !== selectedAvatarId

    lastSyncedAvatarIdRef.current = selectedAvatarId

    if (selectedAvatarChanged && personalSelectionExists) {
      setSelectedViewerAvatarId(selectedPersonalViewerId)
      return
    }

    if (!currentSelectionExists) {
      if (personalSelectionExists) {
        setSelectedViewerAvatarId(selectedPersonalViewerId)
        return
      }

      if (viewerAvatarItems[0]?.id) {
        setSelectedViewerAvatarId(String(viewerAvatarItems[0].id))
      }
    }
  }, [selectedAvatarId, selectedViewerAvatarId, viewerAvatarItems])

  const selectedAvatarAsset = useMemo(
    () => viewerAvatarItems.find((entry) => entry.id === selectedViewerAvatarId) || null,
    [selectedViewerAvatarId, viewerAvatarItems],
  )
  const selectedAvatar = useMemo(
    () => selectedAvatarAsset?.scope === 'personal'
      ? avatars.find((entry) => entry.id === selectedAvatarAsset.remoteId) || null
      : null,
    [avatars, selectedAvatarAsset],
  )
  const personas = selectedAvatar ? personasByAvatar[selectedAvatar.id] || [] : []
  const effectivePersona = useMemo(
    () => personas.find((entry) => entry.isPrimary) || personas[0] || null,
    [personas],
  )
  const animationItems = useMemo(
    () => animations.map((entry) => createPersistedAnimationAsset(entry, workspace.token)),
    [animations, workspace.token],
  )
  const sharedIdleItems = useMemo(
    () => sharedAnimationGroups.idle.map((entry) => normalizeSharedAsset(entry, 'idle')),
    [sharedAnimationGroups.idle],
  )
  const sharedActionItems = useMemo(
    () => sharedAnimationGroups.action.map((entry) => normalizeSharedAsset(entry, 'action')),
    [sharedAnimationGroups.action],
  )
  const sharedExpressionItems = useMemo(
    () => sharedAnimationGroups.expression.map((entry) => normalizeSharedAsset(entry, 'expression')),
    [sharedAnimationGroups.expression],
  )
  const idleItems = useMemo(
    () => [...animationItems.filter((entry) => entry.kind === 'idle'), ...sharedIdleItems],
    [animationItems, sharedIdleItems],
  )
  const actionItems = useMemo(
    () => [...animationItems.filter((entry) => entry.kind === 'action'), ...sharedActionItems],
    [animationItems, sharedActionItems],
  )
  const expressionItems = useMemo(
    () => [...animationItems.filter((entry) => entry.kind === 'expression'), ...sharedExpressionItems],
    [animationItems, sharedExpressionItems],
  )
  const selectedIdle = useMemo(() => idleItems.find((entry) => entry.id === selectedIdleId) || idleItems[0] || null, [idleItems, selectedIdleId])
  const selectedAction = useMemo(() => actionItems.find((entry) => entry.id === selectedActionId) || actionItems[0] || null, [actionItems, selectedActionId])
  const selectedExpression = useMemo(() => expressionItems.find((entry) => entry.id === selectedExpressionId) || expressionItems[0] || null, [expressionItems, selectedExpressionId])
  const conversations = selectedAvatar ? conversationsByAvatar[selectedAvatar.id] || [] : []
  const messages = activeConversationId ? messagesByConversation[activeConversationId] || [] : []

  useEffect(() => {
    if (!selectedAvatar || !workspace.token) {
      setActiveConversationId(null)
      return
    }

    let cancelled = false

    async function loadAvatarContext() {
      try {
        const [, loadedConversations] = await Promise.all([
          ensurePersonas(selectedAvatar.id),
          ensureConversations(selectedAvatar.id),
        ])

        if (cancelled) return

        const nextConversationId = loadedConversations[0]?.id || null
        setActiveConversationId(nextConversationId)
        if (nextConversationId) {
          await ensureConversationMessages(nextConversationId)
        }
      } catch (error) {
        if (!cancelled) {
          setNotice(error.message || 'Unable to load avatar context.')
        }
      }
    }

    loadAvatarContext()

    return () => {
      cancelled = true
    }
  }, [ensureConversationMessages, ensureConversations, ensurePersonas, selectedAvatar, workspace.token])

  useEffect(() => {
    if (idleItems.length === 0) {
      setSelectedIdleId('')
    } else if (!idleItems.some((entry) => entry.id === selectedIdleId)) {
      setSelectedIdleId(idleItems[0].id)
    }

    if (actionItems.length === 0) {
      setSelectedActionId('')
    } else if (!actionItems.some((entry) => entry.id === selectedActionId)) {
      setSelectedActionId(actionItems[0].id)
    }

    if (expressionItems.length === 0) {
      setSelectedExpressionId('')
    } else if (!expressionItems.some((entry) => entry.id === selectedExpressionId)) {
      setSelectedExpressionId(expressionItems[0].id)
    }
  }, [actionItems, expressionItems, idleItems, selectedActionId, selectedExpressionId, selectedIdleId])

  useEffect(() => {
    if (!selectedAvatarAsset) return

    let cancelled = false

    async function loadSelectedAvatar() {
      const file = await assetToFile(selectedAvatarAsset)
      if (!file || cancelled) return

      loadFile(file)
      setLoadedAvatarName(selectedAvatarAsset.label)
    }

    loadSelectedAvatar()

    return () => {
      cancelled = true
    }
  }, [loadFile, selectedAvatarAsset])

  useEffect(() => {
    if (!selectedIdle) return

    let cancelled = false

    async function applyIdle() {
      const file = await assetToFile(selectedIdle)
      if (!file || cancelled) return
      setIdleAnimation(file, selectedIdle.label, { cacheKey: selectedIdle.id })
    }

    applyIdle()

    return () => {
      cancelled = true
    }
  }, [selectedIdle, setIdleAnimation])

  useEffect(() => {
    let cancelled = false

    async function loadIdleVariants() {
      const variantItems = idleItems.filter((entry) => entry.id !== selectedIdle?.id)

      if (variantItems.length === 0) {
        setIdleVariantPool([])
        return
      }

      const resolved = await Promise.all(
        variantItems.map(async (item) => {
          const file = await assetToFile(item)
          if (!file) return null

          return {
            file,
            label: item.label,
            cacheKey: `${item.id}:idle-variant`,
          }
        }),
      )

      if (cancelled) return

      setIdleVariantPool(resolved.filter(Boolean))
    }

    loadIdleVariants().catch((error) => {
      if (!cancelled) {
        setNotice(error.message || 'Unable to prepare idle variations.')
      }
    })

    return () => {
      cancelled = true
    }
  }, [idleItems, selectedIdle, setIdleVariantPool])

  const handlePlayAction = useCallback(async () => {
    if (!selectedAction) return
    const file = await assetToFile(selectedAction)
    if (!file) return
    playAnimationFile(file, selectedAction.label, { cacheKey: selectedAction.id })
  }, [playAnimationFile, selectedAction])

  const handlePlayExpression = useCallback(async () => {
    if (!selectedExpression) return
    const file = await assetToFile(selectedExpression)
    if (!file) return
    playOverlayAnimationFile(file, selectedExpression.label, { cacheKey: `${selectedExpression.id}:overlay` })
  }, [playOverlayAnimationFile, selectedExpression])

  const handleSendMessage = useCallback(async () => {
    if (!selectedAvatar || !draftMessage.trim()) return

    setIsChatBusy(true)
    setNotice('')

    try {
      const response = await sendChatMessage(selectedAvatar.id, {
        message: draftMessage.trim(),
        conversationId: activeConversationId || undefined,
        personaId: effectivePersona?.id || undefined,
      })

      setActiveConversationId(response.conversation.id)
      setDraftMessage('')
      setNotice(`Reply received via ${response.conversation.provider}.`)
    } catch (error) {
      setNotice(error.message || 'Chat failed.')
    } finally {
      setIsChatBusy(false)
    }
  }, [activeConversationId, draftMessage, effectivePersona, selectedAvatar, sendChatMessage])

  const chatDisabled = !selectedAvatar || !effectivePersona || !effectivePersona.llmCredentialId

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#162c4f_0%,_#08111d_38%,_#03070d_100%)] text-white">
      <div className="mx-auto grid min-h-screen max-w-[1680px] grid-cols-1 gap-6 px-4 pb-8 pt-6 xl:grid-cols-[370px_minmax(0,1fr)] xl:px-6">
        <aside className="space-y-5 rounded-[32px] border border-white/10 bg-[rgba(6,10,20,0.76)] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur">
          <section>
            <div className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">Viewer</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight">Avatar runtime</div>
            <div className="mt-3 text-sm leading-6 text-white/62">
              Choose a configured avatar and chat through the backend LLM orchestration already in place.
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[rgba(10,16,30,0.85)] p-4">
            <div className="text-xs uppercase tracking-[0.28em] text-white/45">Configured avatar</div>
            <select
              value={selectedViewerAvatarId}
              onChange={(event) => {
                const nextId = event.target.value
                setSelectedViewerAvatarId(nextId)

                const nextAvatar = viewerAvatarItems.find((entry) => entry.id === nextId) || null
                if (nextAvatar?.scope === 'personal') {
                  setSelectedAvatarId(nextAvatar.remoteId)
                }
              }}
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
            >
              {viewerAvatarItems.length === 0 ? <option value="">No avatars available</option> : null}
              {viewerAvatarItems.map((avatar) => (
                <option key={avatar.id} value={avatar.id}>
                  [{avatar.scope === 'personal' ? 'Mine' : 'Default'}] {avatar.label}
                </option>
              ))}
            </select>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Attached identity</div>
              <div className="mt-2 text-sm font-medium text-white">
                {effectivePersona?.name || selectedAvatar?.name || 'No identity configured'}
              </div>
              <div className="mt-1 text-xs text-white/55">
                {effectivePersona?.llmProvider ? `LLM: ${effectivePersona.llmProvider}` : 'No LLM attached'}
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[rgba(10,16,30,0.85)] p-4">
            <div className="text-xs uppercase tracking-[0.28em] text-white/45">Selected identity</div>
            <div className="mt-3 text-2xl font-semibold text-cyan-100">
              {effectivePersona?.name || selectedAvatar?.name || selectedAvatarAsset?.label || 'No avatar selected'}
            </div>
            <div className="mt-3 text-sm leading-6 text-white/65">
              {effectivePersona?.description || selectedAvatar?.backstory || selectedAvatarAsset?.description || 'The selected avatar does not have a description yet.'}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-white/65">
                {effectivePersona?.llmProvider ? `LLM: ${effectivePersona.llmProvider}` : selectedAvatar ? 'No LLM attached' : 'Default preview avatar'}
              </span>
              {!selectedAvatar ? (
                <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-amber-100">
                  Add this default to your library in Manage to customize and chat
                </span>
              ) : null}
              {(selectedAvatar?.personality || selectedAvatarAsset?.personality) ? (
                <span className="rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1 text-cyan-100">
                  Personality ready
                </span>
              ) : null}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[rgba(10,16,30,0.85)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.28em] text-white/45">Conversation</div>
              <div className="text-[11px] text-white/40">{conversations.length} threads</div>
            </div>

            <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto rounded-3xl border border-white/10 bg-black/25 p-3">
              {messages.length === 0 ? (
                <div className="rounded-2xl bg-black/30 px-3 py-3 text-sm text-white/60">
                  {chatDisabled
                    ? !selectedAvatar
                      ? 'Default avatars are preview-only until you add them to your personal library in Manage.'
                      : 'Attach an LLM to this avatar in Manage before starting chat.'
                    : 'Start a conversation with the selected avatar.'}
                </div>
              ) : null}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-2xl px-3 py-3 text-sm ${
                    message.role === 'assistant' ? 'bg-cyan-300/10 text-cyan-50' : 'bg-white/8 text-white/82'
                  }`}
                >
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">{message.role}</div>
                  <div className="mt-2 whitespace-pre-wrap leading-6">{message.content}</div>
                </div>
              ))}
            </div>

            <textarea
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              rows={5}
              disabled={chatDisabled}
              placeholder={chatDisabled ? (!selectedAvatar ? 'Add this default avatar to your library in Manage first.' : 'Configure the avatar identity + LLM in Manage first.') : 'Type a message to the selected avatar'}
              className="mt-4 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={chatDisabled || isChatBusy || !draftMessage.trim()}
              className="mt-3 w-full rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isChatBusy ? 'Sending...' : 'Send message'}
            </button>

            {notice ? <div className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-100">{notice}</div> : null}
          </section>
        </aside>

        <main className="relative min-h-[62vh]">
          <div className="relative h-[72vh] min-h-[560px] overflow-hidden rounded-[36px] border border-cyan-300/15 bg-black/25 shadow-[0_30px_90px_rgba(3,7,18,0.42)] xl:h-[calc(100vh-48px)]">
            <canvas ref={canvasRef} className="viewer-canvas" />

            <CameraPopover
              framingValues={framingState}
              viewerOptions={viewerOptions}
              onFramingChange={setFramingValue}
              onOptionChange={(key, value) => {
                setViewerOption(key, value)
                setNotice(`${VIEWER_OPTION_LABELS[key] || key}: ${value ? 'on' : 'off'}`)
              }}
            />

            <AnimationPopover
              idleItems={idleItems}
              actionItems={actionItems}
              expressionItems={expressionItems}
              selectedIdleId={selectedIdleId}
              selectedActionId={selectedActionId}
              selectedExpressionId={selectedExpressionId}
              onIdleSelect={setSelectedIdleId}
              onActionSelect={setSelectedActionId}
              onExpressionSelect={setSelectedExpressionId}
              onSetIdle={() => selectedIdle && assetToFile(selectedIdle).then((file) => file && setIdleAnimation(file, selectedIdle.label, { cacheKey: selectedIdle.id }))}
              onPlayAction={handlePlayAction}
              onPlayExpression={handlePlayExpression}
            />

            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-6">
              <div className="rounded-full border border-cyan-300/20 bg-black/35 px-5 py-2 text-xs uppercase tracking-[0.25em] text-cyan-200/90 backdrop-blur">
                {loadedAvatarName}
              </div>
            </div>

            <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/65 backdrop-blur">
              Avatar: {selectedAvatar?.name || selectedAvatarAsset?.label || 'none'}
            </div>

            <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-cyan-300/20 bg-black/35 px-4 py-2 text-xs uppercase tracking-[0.2em] text-cyan-100/90 backdrop-blur">
              {isAvatarLoading ? 'Loading avatar...' : status}
            </div>

            {!isLoaded ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <div className="max-w-md rounded-[28px] border border-cyan-300/16 bg-[rgba(3,7,18,0.58)] px-6 py-5 text-center text-sm leading-6 text-white/78 shadow-[0_0_56px_rgba(34,211,238,0.1)] backdrop-blur">
                  {viewerAvatarItems.length === 0
                    ? 'Use the Manage page to add a default avatar or upload your own.'
                    : 'Select an avatar to load it into the viewer.'}
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}
