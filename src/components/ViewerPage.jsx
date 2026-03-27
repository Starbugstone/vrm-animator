import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import useHologramViewer from '../useHologramViewer.js'
import {
  assetToFile,
  createPersistedAnimationAsset,
  createPersistedAvatarAsset,
} from '../lib/viewerAssets.js'
import { isExpressionAssetAllowed, pickExpressionAsset, pickThinkingExpressionAsset } from '../lib/viewerExpressions.js'
import { isSpeechMovementAssetAllowed, pickSpeechMovementAsset } from '../lib/viewerPresence.js'
import {
  pickThinkingInjectionAsset,
  sampleThinkingInjectionDelay,
} from '../lib/viewerThinking.js'
import {
  buildSpeechCuePlan,
  sampleSpeechMotionDelay,
  takeSpeakableSpeechChunk,
} from '../lib/viewerSpeech.js'
import {
  createEmptySpeechClockState,
  createSpeechClock,
  estimateSpeechDurationMs,
  getSpeechClockElapsedMs,
  getSpeechClockReleaseDelayMs,
  getSpeechClockRemainingMs,
  recordSpeechClockActivity,
  syncSpeechClockDuration,
} from '../lib/viewerSpeechClock.js'
import { createAvatarPresenceState, reduceAvatarPresence } from '../lib/avatarPresenceMachine.js'
import { playStreamedAudioResponse } from '../lib/streamingAudio.js'
import {
  getEffectiveVoiceGender,
  hasRemoteTtsConfiguration,
  isSpeechPlaybackDisabled,
} from '../lib/ttsVoices.js'
import { streamAvatarTts } from '../api/tts.js'
import {
  buildHologramProjectionUrl,
  buildHologramWindowFeatures,
  createHologramChannel,
  PIXELXL_PRISM_WINDOW_PRESET,
} from '../lib/hologramProjection.js'

const VIEWER_OPTION_LABELS = {
  autoBlink: 'Auto blink',
  lookAtCamera: 'Eyes follow camera',
}
const VIEWER_CAMERA_SLIDERS = [
  { key: 'yaw', label: 'Yaw', min: -180, max: 180, step: 1, unit: 'deg' },
  { key: 'tilt', label: 'Tilt', min: 26, max: 88, step: 1, unit: 'deg' },
  { key: 'zoom', label: 'Zoom', min: 1.8, max: 12, step: 0.05, unit: '' },
  { key: 'height', label: 'Height', min: -5, max: 5, step: 0.01, unit: '' },
  { key: 'shift', label: 'Shift', min: -1.5, max: 1.5, step: 0.01, unit: '' },
]
const VIEWER_ASSIST_OPTIONS = [
  {
    key: 'autoBlink',
    label: 'Auto blink',
    description: 'Use VRM blink expressions for natural idle blinking.',
  },
  {
    key: 'lookAtCamera',
    label: 'Eyes follow camera',
    description: 'Bind the VRM look-at target to the active camera.',
  },
]

const SPEECH_LANGUAGE_FALLBACK = 'en-US'
const SPEECH_OVERLAY_RELEASE_MS = 220
const SPEECH_BOUNDARY_RELEASE_MS = 180
const SPEECH_MOVEMENT_END_BUFFER_MS = 1500
const SPEECH_MOVEMENT_EXPLICIT_GUARD_MS = 2400
const SPEECH_MOVEMENT_MIN_GAP_MS = 3200
const SPEECH_RECENT_MOVEMENT_LIMIT = 3
const MANAGE_SECTION_KEY = 'workspace.manageSection'
const VIEWER_RIGHT_PANEL_KEY = 'workspace.viewerRightPanelCollapsed'
const LANGUAGE_PROFILES = [
  {
    code: 'en',
    locale: 'en-US',
    words: ['the', 'and', 'you', 'your', 'with', 'this', 'that', 'what', 'have', 'are', 'can', 'please'],
    chars: [],
  },
  {
    code: 'fr',
    locale: 'fr-FR',
    words: ['bonjour', 'merci', 'avec', 'pour', 'vous', 'nous', 'dans', 'est', 'une', 'des', 'que', 'qui'],
    chars: ['é', 'è', 'ê', 'à', 'ç', 'ù', 'ô', 'œ'],
  },
  {
    code: 'es',
    locale: 'es-ES',
    words: ['hola', 'gracias', 'para', 'con', 'como', 'está', 'estoy', 'una', 'que', 'por', 'tengo', 'quiero'],
    chars: ['ñ', 'á', 'í', 'ó', 'ú', '¿', '¡'],
  },
  {
    code: 'de',
    locale: 'de-DE',
    words: ['hallo', 'danke', 'und', 'mit', 'nicht', 'ich', 'eine', 'der', 'die', 'das', 'ist', 'bitte'],
    chars: ['ä', 'ö', 'ü', 'ß'],
  },
  {
    code: 'it',
    locale: 'it-IT',
    words: ['ciao', 'grazie', 'come', 'per', 'con', 'sono', 'una', 'che', 'non', 'vorrei', 'voglio', 'della'],
    chars: ['à', 'è', 'ì', 'ò', 'ù'],
  },
]

function normalizeToken(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function createEmptySpeechPresenceState() {
  return {
    sessionId: 0,
    started: false,
    beats: [],
    recentMovementIds: [],
    lastMovementAssetId: '',
    lastMovementAtMs: 0,
  }
}

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function createProjectionMessageId(prefix = 'projection') {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
}

function getChatPhaseForPresenceMode(mode) {
  return mode === 'thinking' ? 'waiting' : mode === 'speaking' || mode === 'responding' ? 'streaming' : 'idle'
}

function detectLanguageLocale(...samples) {
  const text = samples
    .map((sample) => String(sample || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ')

  if (!text) {
    return SPEECH_LANGUAGE_FALLBACK
  }

  const scores = LANGUAGE_PROFILES.map((profile) => {
    let score = 0

    for (const word of profile.words) {
      const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'giu')
      const matches = text.match(pattern)
      if (matches) {
        score += matches.length * 2
      }
    }

    for (const char of profile.chars) {
      const matches = text.split(char).length - 1
      if (matches > 0) {
        score += matches * 3
      }
    }

    return {
      locale: profile.locale,
      score,
    }
  })

  scores.sort((left, right) => right.score - left.score)

  return scores[0]?.score > 0 ? scores[0].locale : SPEECH_LANGUAGE_FALLBACK
}

function pickSpeechVoice(speechSynthesis, locale) {
  const voices = speechSynthesis?.getVoices?.() || []
  if (voices.length === 0) {
    return null
  }

  const normalizedLocale = String(locale || SPEECH_LANGUAGE_FALLBACK).toLowerCase()
  const languageCode = normalizedLocale.split('-')[0]

  return (
    voices.find((voice) => String(voice.lang || '').toLowerCase() === normalizedLocale) ||
    voices.find((voice) => String(voice.lang || '').toLowerCase().startsWith(`${languageCode}-`)) ||
    voices.find((voice) => String(voice.lang || '').toLowerCase() === languageCode) ||
    voices.find((voice) => voice.default) ||
    voices[0] ||
    null
  )
}

function inferVoiceGender(voice) {
  const hintText = `${voice?.name || ''} ${voice?.voiceURI || ''}`.toLowerCase()
  const femaleHints = ['female', 'woman', 'girl', 'ava', 'aria', 'emma', 'jenny', 'joanna', 'samantha', 'victoria', 'karen', 'zira']
  const maleHints = ['male', 'man', 'boy', 'david', 'daniel', 'george', 'james', 'matthew', 'michael', 'thomas', 'alex', 'fred', 'ralph']

  const femaleScore = femaleHints.filter((hint) => hintText.includes(hint)).length
  const maleScore = maleHints.filter((hint) => hintText.includes(hint)).length

  if (femaleScore === maleScore) {
    return null
  }

  return femaleScore > maleScore ? 'female' : 'male'
}

function pickSpeechVoiceWithPreference(speechSynthesis, locale, preferredGender) {
  const voices = speechSynthesis?.getVoices?.() || []
  if (voices.length === 0) {
    return null
  }

  const normalizedLocale = String(locale || SPEECH_LANGUAGE_FALLBACK).toLowerCase()
  const languageCode = normalizedLocale.split('-')[0]
  const localeVoices = voices.filter((voice) => {
    const voiceLocale = String(voice.lang || '').toLowerCase()
    return voiceLocale === normalizedLocale || voiceLocale.startsWith(`${languageCode}-`) || voiceLocale === languageCode
  })

  const candidateVoices = localeVoices.length > 0 ? localeVoices : voices
  const genderVoices = preferredGender
    ? candidateVoices.filter((voice) => inferVoiceGender(voice) === preferredGender)
    : []

  return genderVoices[0] || candidateVoices[0] || null
}

function findMovementAssetByTag(items, tag) {
  const normalizedTag = normalizeToken(tag)
  if (!normalizedTag) return null

  return items.find((item) => {
    const candidates = [
      item.label,
      item.name,
      ...(Array.isArray(item.keywords) ? item.keywords : []),
    ]

    return candidates.some((entry) => normalizeToken(entry) === normalizedTag)
  }) || null
}

function findAssetById(items, assetId) {
  const normalizedAssetId = String(assetId || '').trim()
  if (!normalizedAssetId) return null

  return items.find((item) => String(item.id) === normalizedAssetId) || null
}

function normalizeSharedAsset(asset, fallbackType) {
  return {
    ...asset,
    id: String(asset.id),
    type: asset.type || fallbackType,
    source: asset.source || 'shared',
  }
}

function buildAssetCacheKey(asset, suffix = '') {
  const baseId = String(asset?.id || '')
  const version = String(asset?.assetVersion || '').trim()
  const baseKey = version ? `${baseId}:${version}` : baseId

  return suffix ? `${baseKey}:${suffix}` : baseKey
}

function findDefaultIdleItem(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return null
  }

  return items.find((item) => {
    const relativePath = String(item?.relativePath || '').trim().toLowerCase()
    const name = String(item?.name || '').trim().toLowerCase()
    const label = String(item?.label || '').trim().toLowerCase()

    return relativePath === 'idle/idle_main.vrma' || name === 'idle_main.vrma' || label === 'idle main'
  }) || items[0]
}

function readInitialRightPanelState() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(VIEWER_RIGHT_PANEL_KEY) === 'true'
}

function formatViewerSliderValue(step, value, unit) {
  const numericValue = typeof value === 'number' ? value : Number(value || 0)
  const text = Number.isInteger(step) ? numericValue.toFixed(0) : numericValue.toFixed(2)
  return unit ? `${text} ${unit}` : text
}

function ViewerMetric({ label, value, detail, tone = 'default' }) {
  const toneClass = tone === 'success'
    ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
    : tone === 'warning'
      ? 'border-amber-300/20 bg-amber-300/10 text-amber-100'
      : 'border-cyan-300/15 bg-cyan-300/10 text-cyan-100'

  return (
    <div className={`rounded-[24px] border px-4 py-4 ${toneClass}`}>
      <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">{label}</div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
      {detail ? <div className="mt-2 text-xs leading-5 text-white/60">{detail}</div> : null}
    </div>
  )
}

function formatLlmDebugPrompt(messages = []) {
  const items = Array.isArray(messages) ? messages : []

  return items.map((message) => {
    const role = String(message?.role || 'unknown').toUpperCase()
    const content = String(message?.content || '')

    return `[${role}]\n${content}`
  }).join('\n\n')
}

function summarizeDebugEntry(entry) {
  const source = String(entry?.userMessage || entry?.rawCompletion || '').trim()
  if (!source) {
    return 'Untitled turn'
  }

  return source.length > 42 ? `${source.slice(0, 41)}...` : source
}

export default function ViewerPage({ workspace, onNavigate }) {
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
    streamChatMessage,
  } = workspace

  const canvasRef = useRef(null)
  const {
    loadFile,
    setIdleAnimation,
    resumeIdleMotion,
    setIdleVariantPool,
    playAnimationFile,
    playOverlayAnimationFile,
    stopOverlayAnimation,
    setThinkingIndicatorEnabled,
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
  const [selectedThinkingId, setSelectedThinkingId] = useState('')
  const [selectedExpressionId, setSelectedExpressionId] = useState('')
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [draftMessage, setDraftMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [isChatBusy, setIsChatBusy] = useState(false)
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(readInitialRightPanelState)
  const [avatarPresence, dispatchAvatarPresence] = useReducer(reduceAvatarPresence, undefined, createAvatarPresenceState)
  const [isContextLoading, setIsContextLoading] = useState(false)
  const [loadedAvatarName, setLoadedAvatarName] = useState('No avatar loaded')
  const [pendingMessages, setPendingMessages] = useState([])
  const [llmDebugLog, setLlmDebugLog] = useState([])
  const [selectedDebugEntryId, setSelectedDebugEntryId] = useState('')
  const lastSyncedAvatarIdRef = useRef(selectedAvatarId)
  const activeEmotionRef = useRef('neutral')
  const speechSynthesisRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis || null : null)
  const speechSessionIdRef = useRef(0)
  const avatarPresenceRequestIdRef = useRef(0)
  const speechStopTimeoutRef = useRef(null)
  const speechMonitorIntervalRef = useRef(null)
  const speechClockRef = useRef(createEmptySpeechClockState())
  const speechPresenceRef = useRef(createEmptySpeechPresenceState())
  const speechPresenceBeatTimeoutsRef = useRef([])
  const speechPresenceInjectionTimeoutRef = useRef(null)
  const speechCuePlanRef = useRef(buildSpeechCuePlan())
  const pendingDelayedSpeechCuesRef = useRef([])
  const delayedSpeechCueIdRef = useRef(0)
  const remoteAudioRef = useRef(typeof Audio !== 'undefined' ? new Audio() : null)
  const remoteTtsAbortRef = useRef(null)
  const streamingSpeechBufferRef = useRef('')
  const streamingSpeechCursorRef = useRef(0)
  const streamingSpeechSamplesRef = useRef([])
  const hasVisibleAssistantTextRef = useRef(false)
  const thinkingRuntimeRef = useRef(false)
  const thinkingCycleTimeoutRef = useRef(null)
  const lastThinkingAssetIdRef = useRef('')
  const projectionChannelRef = useRef(null)
  const projectionAssetCacheRef = useRef(new Map())
  const projectionSettingsRef = useRef({
    viewerOptions,
    framingState,
  })

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
  const selectedLlmDebugEntry = useMemo(
    () => llmDebugLog.find((entry) => entry.id === selectedDebugEntryId) || llmDebugLog[0] || null,
    [llmDebugLog, selectedDebugEntryId],
  )
  const selectedLlmDebugPrompt = useMemo(
    () => formatLlmDebugPrompt(selectedLlmDebugEntry?.requestMessages || []),
    [selectedLlmDebugEntry],
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
  const sharedThinkingItems = useMemo(
    () => sharedAnimationGroups.thinking.map((entry) => normalizeSharedAsset(entry, 'thinking')),
    [sharedAnimationGroups.thinking],
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
  const thinkingItems = useMemo(
    () => [...animationItems.filter((entry) => entry.kind === 'thinking'), ...sharedThinkingItems],
    [animationItems, sharedThinkingItems],
  )
  const expressionItems = useMemo(
    () => [...animationItems.filter((entry) => entry.kind === 'expression'), ...sharedExpressionItems],
    [animationItems, sharedExpressionItems],
  )
  const defaultIdleItem = useMemo(() => findDefaultIdleItem(idleItems), [idleItems])
  const selectedIdle = useMemo(
    () => idleItems.find((entry) => entry.id === selectedIdleId) || defaultIdleItem || null,
    [defaultIdleItem, idleItems, selectedIdleId],
  )
  const selectedAction = useMemo(() => actionItems.find((entry) => entry.id === selectedActionId) || actionItems[0] || null, [actionItems, selectedActionId])
  const selectedThinking = useMemo(() => thinkingItems.find((entry) => entry.id === selectedThinkingId) || thinkingItems[0] || null, [thinkingItems, selectedThinkingId])
  const selectedExpression = useMemo(() => expressionItems.find((entry) => entry.id === selectedExpressionId) || expressionItems[0] || null, [expressionItems, selectedExpressionId])
  const conversations = selectedAvatar ? conversationsByAvatar[selectedAvatar.id] || [] : []
  const messages = activeConversationId ? messagesByConversation[activeConversationId] || [] : []
  const liveMessages = useMemo(
    () => (pendingMessages.length > 0 ? [...messages, ...pendingMessages] : messages),
    [messages, pendingMessages],
  )
  const displayMessages = useMemo(
    () => [...liveMessages].reverse(),
    [liveMessages],
  )
  const hasConnectedAvatar = Boolean(selectedAvatar)
  const hasConnectedLlm = Boolean(effectivePersona?.llmCredentialId)
  const speechPlaybackDisabled = isSpeechPlaybackDisabled(selectedAvatar)
  const hasRemoteTts = !speechPlaybackDisabled && hasRemoteTtsConfiguration(selectedAvatar)
  const hasStartedChat = liveMessages.length > 0 || conversations.length > 0
  const chatPhase = getChatPhaseForPresenceMode(avatarPresence.mode)
  const speechPathLabel = speechPlaybackDisabled
    ? 'No voice'
    : hasRemoteTts
      ? 'Remote TTS'
      : 'Browser speech'
  const speechPathDetail = speechPlaybackDisabled
    ? 'Text-only chat keeps cue annotations and body language.'
    : selectedAvatar?.ttsVoiceName || 'No remote voice attached'

  useEffect(() => {
    projectionSettingsRef.current = {
      viewerOptions,
      framingState,
    }
  }, [framingState, viewerOptions])

  const resolveProjectionAssetPayload = useCallback(async (asset, options = {}) => {
    if (!asset) {
      return null
    }

    const assetKey = String(options.assetKey || asset.id || asset.label || '')
    const cachedEntry = projectionAssetCacheRef.current.get(assetKey)
    if (cachedEntry?.file) {
      return {
        ...cachedEntry,
        label: options.label || cachedEntry.label,
        cacheKey: options.cacheKey || cachedEntry.cacheKey,
        defaultFacingYaw: options.defaultFacingYaw ?? cachedEntry.defaultFacingYaw ?? 0,
      }
    }

    const file = await assetToFile(asset)
    if (!file) {
      return null
    }

    const payload = {
      assetId: asset.id,
      file,
      label: options.label || asset.label || asset.name || file.name,
      cacheKey: options.cacheKey || '',
      defaultFacingYaw: options.defaultFacingYaw ?? asset.defaultFacingYaw ?? 0,
    }

    projectionAssetCacheRef.current.set(assetKey, payload)
    return payload
  }, [])

  const postProjectionMessage = useCallback((message) => {
    projectionChannelRef.current?.postMessage?.(message)
  }, [])

  const broadcastProjectionEvent = useCallback((event) => {
    if (!event) {
      return
    }

    postProjectionMessage({
      type: 'projection:event',
      event: {
        id: event.id || createProjectionMessageId('projection-event'),
        ...event,
      },
    })
  }, [postProjectionMessage])

  const broadcastProjectionSettings = useCallback(() => {
    postProjectionMessage({
      type: 'projection:settings',
      viewerOptions,
      framingState,
    })
  }, [framingState, postProjectionMessage, viewerOptions])

  const broadcastProjectionFullState = useCallback(async () => {
    const currentSettings = projectionSettingsRef.current
    const [avatar, idle, thinking] = await Promise.all([
      resolveProjectionAssetPayload(selectedAvatarAsset, {
        assetKey: selectedAvatarAsset?.id,
        label: selectedAvatarAsset?.label,
        defaultFacingYaw: selectedAvatarAsset?.defaultFacingYaw || 0,
      }),
      resolveProjectionAssetPayload(selectedIdle, {
        assetKey: selectedIdle?.id,
        label: selectedIdle?.label,
        cacheKey: buildAssetCacheKey(selectedIdle),
      }),
      resolveProjectionAssetPayload(selectedThinking, {
        assetKey: selectedThinking?.id,
        label: selectedThinking?.label,
        cacheKey: buildAssetCacheKey(selectedThinking, 'thinking-preview'),
      }),
    ])

    postProjectionMessage({
      type: 'projection:full-state',
      avatar,
      idle,
      thinking,
      viewerOptions: currentSettings.viewerOptions,
      framingState: currentSettings.framingState,
    })
  }, [
    postProjectionMessage,
    resolveProjectionAssetPayload,
    selectedAvatarAsset,
    selectedIdle,
    selectedThinking,
  ])

  useEffect(() => {
    setLlmDebugLog([])
    setSelectedDebugEntryId('')
  }, [selectedAvatar?.id])

  useEffect(() => {
    const channel = createHologramChannel()
    if (!channel) {
      projectionChannelRef.current = null
      return undefined
    }

    projectionChannelRef.current = channel

    const handleProjectionMessage = (event) => {
      const message = event?.data || {}
      if (message.type === 'projection:request-state') {
        void broadcastProjectionFullState()
      }
    }

    channel.addEventListener('message', handleProjectionMessage)

    return () => {
      channel.removeEventListener('message', handleProjectionMessage)
      channel.close()
      projectionChannelRef.current = null
    }
  }, [broadcastProjectionFullState])

  useEffect(() => {
    void broadcastProjectionFullState()
  }, [broadcastProjectionFullState])

  useEffect(() => {
    broadcastProjectionSettings()
  }, [broadcastProjectionSettings])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VIEWER_RIGHT_PANEL_KEY, String(isRightPanelCollapsed))
    }
  }, [isRightPanelCollapsed])

  const clearSpeechPresenceTimers = useCallback(() => {
    speechPresenceBeatTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId)
    })
    speechPresenceBeatTimeoutsRef.current = []

    if (speechPresenceInjectionTimeoutRef.current) {
      window.clearTimeout(speechPresenceInjectionTimeoutRef.current)
      speechPresenceInjectionTimeoutRef.current = null
    }
  }, [])

  const stopSpeechPresenceSession = useCallback(() => {
    clearSpeechPresenceTimers()
    pendingDelayedSpeechCuesRef.current = []
    speechClockRef.current = createEmptySpeechClockState()
    speechPresenceRef.current = createEmptySpeechPresenceState()
  }, [clearSpeechPresenceTimers])

  const stopRemoteTtsPlayback = useCallback(() => {
    remoteTtsAbortRef.current?.abort?.()
    remoteTtsAbortRef.current = null

    const audio = remoteAudioRef.current
    if (!audio) {
      return
    }

    audio.pause()
    audio.removeAttribute('src')
    audio.load?.()
  }, [])

  useEffect(() => {
    if (!selectedAvatar || !workspace.token) {
      avatarPresenceRequestIdRef.current = 0
      setActiveConversationId(null)
      setPendingMessages([])
      setIsContextLoading(false)
      dispatchAvatarPresence({ type: 'reset' })
      hasVisibleAssistantTextRef.current = false
      thinkingRuntimeRef.current = false
      setThinkingIndicatorEnabled(false)
      if (thinkingCycleTimeoutRef.current) {
        window.clearTimeout(thinkingCycleTimeoutRef.current)
        thinkingCycleTimeoutRef.current = null
      }
      activeEmotionRef.current = 'neutral'
      if (speechStopTimeoutRef.current) {
        window.clearTimeout(speechStopTimeoutRef.current)
        speechStopTimeoutRef.current = null
      }
      if (speechMonitorIntervalRef.current) {
        window.clearInterval(speechMonitorIntervalRef.current)
        speechMonitorIntervalRef.current = null
      }
      stopSpeechPresenceSession()
      speechCuePlanRef.current = buildSpeechCuePlan()
      speechSynthesisRef.current?.cancel?.()
      stopRemoteTtsPlayback()
      stopOverlayAnimation({ immediate: false })
      return
    }

    let cancelled = false

    async function loadAvatarContext() {
      setIsContextLoading(true)
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
      } finally {
        if (!cancelled) {
          setIsContextLoading(false)
        }
      }
    }

    loadAvatarContext()

    return () => {
      cancelled = true
    }
  }, [ensureConversationMessages, ensureConversations, ensurePersonas, selectedAvatar, setThinkingIndicatorEnabled, stopOverlayAnimation, stopRemoteTtsPlayback, stopSpeechPresenceSession, workspace.token])

  useEffect(() => () => {
    if (thinkingCycleTimeoutRef.current) {
      window.clearTimeout(thinkingCycleTimeoutRef.current)
      thinkingCycleTimeoutRef.current = null
    }
    stopSpeechPresenceSession()
  }, [stopSpeechPresenceSession])

  useEffect(() => {
    if (idleItems.length === 0) {
      setSelectedIdleId('')
    } else if (!idleItems.some((entry) => entry.id === selectedIdleId)) {
      setSelectedIdleId(defaultIdleItem?.id || idleItems[0].id)
    }

    if (actionItems.length === 0) {
      setSelectedActionId('')
    } else if (!actionItems.some((entry) => entry.id === selectedActionId)) {
      setSelectedActionId(actionItems[0].id)
    }

    if (thinkingItems.length === 0) {
      setSelectedThinkingId('')
    } else if (!thinkingItems.some((entry) => entry.id === selectedThinkingId)) {
      setSelectedThinkingId(thinkingItems[0].id)
    }

    if (expressionItems.length === 0) {
      setSelectedExpressionId('')
    } else if (!expressionItems.some((entry) => entry.id === selectedExpressionId)) {
      setSelectedExpressionId(expressionItems[0].id)
    }
  }, [actionItems, defaultIdleItem, expressionItems, idleItems, selectedActionId, selectedExpressionId, selectedIdleId, selectedThinkingId, thinkingItems])

  useEffect(() => {
    if (!selectedAvatarAsset) return

    let cancelled = false

    async function loadSelectedAvatar() {
      const file = await assetToFile(selectedAvatarAsset)
      if (!file || cancelled) return

      loadFile(file, {
        defaultFacingYaw: selectedAvatarAsset.defaultFacingYaw || 0,
      })
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
      setIdleAnimation(file, selectedIdle.label, { cacheKey: buildAssetCacheKey(selectedIdle) })
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
            cacheKey: buildAssetCacheKey(item, 'idle-variant'),
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

  useEffect(() => {
    const speechSynthesis = speechSynthesisRef.current
    if (!speechSynthesis?.getVoices) {
      return undefined
    }

    const primeVoices = () => {
      speechSynthesis.getVoices()
    }

    primeVoices()
    if ('onvoiceschanged' in speechSynthesis) {
      speechSynthesis.addEventListener?.('voiceschanged', primeVoices)
    }

    return () => {
      if (speechStopTimeoutRef.current) {
        window.clearTimeout(speechStopTimeoutRef.current)
        speechStopTimeoutRef.current = null
      }
      if (speechMonitorIntervalRef.current) {
        window.clearInterval(speechMonitorIntervalRef.current)
        speechMonitorIntervalRef.current = null
      }
      stopSpeechPresenceSession()
      speechCuePlanRef.current = buildSpeechCuePlan()
      speechSynthesis.removeEventListener?.('voiceschanged', primeVoices)
      speechSynthesisRef.current?.cancel?.()
      stopRemoteTtsPlayback()
      stopOverlayAnimation({ immediate: false })
    }
  }, [stopOverlayAnimation, stopRemoteTtsPlayback, stopSpeechPresenceSession])

  const rememberSpeechMovement = useCallback((asset) => {
    if (!asset?.id) {
      return
    }

    const state = speechPresenceRef.current
    const assetId = String(asset.id)

    state.lastMovementAssetId = assetId
    state.lastMovementAtMs = nowMs()
    state.recentMovementIds = [
      ...state.recentMovementIds.filter((entry) => entry !== assetId),
      assetId,
    ].slice(-SPEECH_RECENT_MOVEMENT_LIMIT)
  }, [])

  const playConversationalMovementAsset = useCallback(async (asset, reason = 'cue') => {
    if (!asset) return null

    const assetPayload = await resolveProjectionAssetPayload(asset, {
      assetKey: asset.id,
      label: asset.label,
      cacheKey: buildAssetCacheKey(asset, reason),
    })
    const file = assetPayload?.file
    if (!file) return null

    playAnimationFile(file, asset.label, {
      cacheKey: buildAssetCacheKey(asset, reason),
      kind: 'action',
      loop: false,
      returnToDefault: true,
      stripExpressionTracks: true,
      priority: reason === 'speech' ? 'speech-injection' : 'speech-explicit',
    })

    broadcastProjectionEvent({
      kind: 'play-motion',
      asset: assetPayload,
      motionKind: 'action',
      loop: false,
      returnToDefault: true,
      stripExpressionTracks: true,
      priority: reason === 'speech' ? 'speech-injection' : 'speech-explicit',
    })

    return asset
  }, [broadcastProjectionEvent, playAnimationFile, resolveProjectionAssetPayload])

  const resolveReplyMovementAsset = useCallback((assetId, fallbackTag = '', options = {}) => {
    const emotion = options.emotion || activeEmotionRef.current || 'neutral'
    const allowIdle = Boolean(options.allowIdle)
    const availableItems = allowIdle ? [...actionItems, ...idleItems] : actionItems
    const directAsset = findAssetById(availableItems, assetId)

    if (directAsset && isSpeechMovementAssetAllowed(directAsset, emotion, { allowIdle })) {
      return directAsset
    }

    const taggedAsset = findMovementAssetByTag(availableItems, fallbackTag)
    if (taggedAsset && isSpeechMovementAssetAllowed(taggedAsset, emotion, { allowIdle })) {
      return taggedAsset
    }

    return null
  }, [actionItems, idleItems])

  const playMovementCueByAssetId = useCallback(async (assetId, fallbackTag = '', options = {}) => {
    const asset = resolveReplyMovementAsset(assetId, fallbackTag, options)
    if (!asset) return null

    return playConversationalMovementAsset(asset, 'cue')
  }, [playConversationalMovementAsset, resolveReplyMovementAsset])

  const resetSpeechRuntime = useCallback(() => {
    speechSessionIdRef.current += 1
    streamingSpeechBufferRef.current = ''
    streamingSpeechCursorRef.current = 0
    streamingSpeechSamplesRef.current = []
    hasVisibleAssistantTextRef.current = false
    speechCuePlanRef.current = buildSpeechCuePlan()

    if (speechStopTimeoutRef.current) {
      window.clearTimeout(speechStopTimeoutRef.current)
      speechStopTimeoutRef.current = null
    }

    if (speechMonitorIntervalRef.current) {
      window.clearInterval(speechMonitorIntervalRef.current)
      speechMonitorIntervalRef.current = null
    }

    activeEmotionRef.current = 'neutral'
    stopSpeechPresenceSession()
    speechSynthesisRef.current?.cancel?.()
    stopRemoteTtsPlayback()
    stopOverlayAnimation({ immediate: true })
    broadcastProjectionEvent({
      kind: 'stop-overlay',
      immediate: true,
    })
    broadcastProjectionEvent({
      kind: 'resume-idle',
    })
  }, [broadcastProjectionEvent, stopOverlayAnimation, stopRemoteTtsPlayback, stopSpeechPresenceSession])

  const playEmotionCue = useCallback(async (emotion, options = {}) => {
    const asset = pickExpressionAsset(expressionItems, emotion, options)
    if (!asset) {
      if (options.stopOnMiss) {
        stopOverlayAnimation()
        broadcastProjectionEvent({
          kind: 'stop-overlay',
          immediate: false,
        })
      }
      return
    }

    const assetPayload = await resolveProjectionAssetPayload(asset, {
      assetKey: asset.id,
      label: asset.label,
      cacheKey: buildAssetCacheKey(asset, options.preferSpeech ? 'speech' : 'cue'),
    })
    const file = assetPayload?.file
    if (!file) return

    playOverlayAnimationFile(file, asset.label, {
      cacheKey: buildAssetCacheKey(asset, options.preferSpeech ? 'speech' : 'cue'),
      expressionOnly: true,
      loop: Boolean(options.loop),
    })
    broadcastProjectionEvent({
      kind: 'play-overlay',
      asset: assetPayload,
      expressionOnly: true,
      loop: Boolean(options.loop),
    })
  }, [broadcastProjectionEvent, expressionItems, playOverlayAnimationFile, resolveProjectionAssetPayload, stopOverlayAnimation])

  const playEmotionCueByAssetId = useCallback(async (assetId, fallbackEmotion = '', options = {}) => {
    const directAsset = findAssetById(expressionItems, assetId)
    const asset = directAsset && isExpressionAssetAllowed(directAsset, options)
      ? directAsset
      : pickExpressionAsset(expressionItems, fallbackEmotion, options)
    if (!asset) {
      if (options.stopOnMiss) {
        stopOverlayAnimation()
        broadcastProjectionEvent({
          kind: 'stop-overlay',
          immediate: false,
        })
      }
      return
    }

    const assetPayload = await resolveProjectionAssetPayload(asset, {
      assetKey: asset.id,
      label: asset.label,
      cacheKey: buildAssetCacheKey(asset, options.preferSpeech ? 'speech' : 'cue'),
    })
    const file = assetPayload?.file
    if (!file) return

    playOverlayAnimationFile(file, asset.label, {
      cacheKey: buildAssetCacheKey(asset, options.preferSpeech ? 'speech' : 'cue'),
      expressionOnly: true,
      loop: Boolean(options.loop),
    })
    broadcastProjectionEvent({
      kind: 'play-overlay',
      asset: assetPayload,
      expressionOnly: true,
      loop: Boolean(options.loop),
    })
  }, [broadcastProjectionEvent, expressionItems, playOverlayAnimationFile, resolveProjectionAssetPayload, stopOverlayAnimation])

  const runSpeechBeat = useCallback(async (beat, sessionId) => {
    if (!beat) {
      return
    }

    const state = speechPresenceRef.current
    if (!state.started || state.sessionId !== sessionId) {
      return
    }

    const nextEmotion = beat.emotion || activeEmotionRef.current || 'neutral'
    activeEmotionRef.current = nextEmotion
    playEmotionCueByAssetId(beat.emotionAssetId, nextEmotion, {
      preferSpeech: true,
      loop: true,
      stopOnMiss: true,
    })

    if (!beat.hasExplicitAnimation) {
      return
    }

    const playedAsset = await playMovementCueByAssetId(beat.animationAssetId, beat.animationTag, {
      emotion: nextEmotion,
      allowIdle: false,
    })
    if (playedAsset) {
      rememberSpeechMovement(playedAsset)
    }
  }, [playEmotionCueByAssetId, playMovementCueByAssetId, rememberSpeechMovement])

  const scheduleDelayedSpeechCue = useCallback((cue, sessionIdOverride = null) => {
    const delayMs = Number.isFinite(Number(cue?.delayMs)) ? Math.max(0, Number(cue.delayMs)) : null
    if (delayMs === null || typeof window === 'undefined') {
      return false
    }

    const state = speechPresenceRef.current
    if (!state.started) {
      pendingDelayedSpeechCuesRef.current = [...pendingDelayedSpeechCuesRef.current, cue]
      return true
    }

    const sessionId = sessionIdOverride ?? state.sessionId
    if (state.sessionId !== sessionId) {
      return false
    }

    const elapsedMs = getSpeechClockElapsedMs(speechClockRef.current)
    const remainingMs = Math.max(0, delayMs - elapsedMs)
    const timeoutId = window.setTimeout(() => {
      void runSpeechBeat({
        emotion: cue.emotion || activeEmotionRef.current || 'neutral',
        emotionAssetId: cue.emotionAssetId || '',
        animationTag: cue.animationTag || cue.value || '',
        animationAssetId: cue.animationAssetId || cue.assetId || '',
        animationDelayMs: delayMs,
        hasExplicitAnimation: true,
      }, sessionId)
    }, remainingMs)

    speechPresenceBeatTimeoutsRef.current.push(timeoutId)
    return true
  }, [runSpeechBeat])

  const queueNextSpeechMovementInjection = useCallback(() => {
    if (speechPresenceInjectionTimeoutRef.current) {
      window.clearTimeout(speechPresenceInjectionTimeoutRef.current)
      speechPresenceInjectionTimeoutRef.current = null
    }

    if (typeof window === 'undefined') {
      return
    }

    const state = speechPresenceRef.current
    if (!state.started) {
      return
    }

    const elapsedMs = getSpeechClockElapsedMs(speechClockRef.current)
    const remainingMs = getSpeechClockRemainingMs(speechClockRef.current)
    if (remainingMs <= SPEECH_MOVEMENT_END_BUFFER_MS) {
      return
    }

    const sampledDelay = sampleSpeechMotionDelay()
    const delayMs = Math.max(
      900,
      Math.min(sampledDelay, remainingMs - SPEECH_MOVEMENT_END_BUFFER_MS),
    )

    speechPresenceInjectionTimeoutRef.current = window.setTimeout(async () => {
      const currentState = speechPresenceRef.current
      if (!currentState.started) {
        return
      }

      const currentElapsedMs = getSpeechClockElapsedMs(speechClockRef.current)
      const currentRemainingMs = getSpeechClockRemainingMs(speechClockRef.current)
      if (currentRemainingMs <= SPEECH_MOVEMENT_END_BUFFER_MS) {
        return
      }

      const nextExplicitBeat = currentState.beats.find(
        (beat) => beat.hasExplicitAnimation && beat.offsetMs > currentElapsedMs,
      )
      const msUntilExplicitBeat = nextExplicitBeat
        ? nextExplicitBeat.offsetMs - currentElapsedMs
        : Number.POSITIVE_INFINITY
      const msSinceLastMovement = currentState.lastMovementAtMs > 0
        ? nowMs() - currentState.lastMovementAtMs
        : Number.POSITIVE_INFINITY

      if (
        msUntilExplicitBeat <= SPEECH_MOVEMENT_EXPLICIT_GUARD_MS ||
        msSinceLastMovement < SPEECH_MOVEMENT_MIN_GAP_MS
      ) {
        queueNextSpeechMovementInjection()
        return
      }

      const asset = pickSpeechMovementAsset(
        actionItems,
        activeEmotionRef.current || 'neutral',
        {
          lastAssetId: currentState.lastMovementAssetId,
          recentAssetIds: currentState.recentMovementIds,
        },
      )

      if (asset) {
        const playedAsset = await playConversationalMovementAsset(asset, 'speech')
        if (playedAsset) {
          rememberSpeechMovement(playedAsset)
        }
      }

      queueNextSpeechMovementInjection()
    }, delayMs)
  }, [
    actionItems,
    playConversationalMovementAsset,
    rememberSpeechMovement,
  ])

  const startSpeechPresenceSession = useCallback((sessionId, speechClock, fallbackEmotion = 'neutral') => {
    if (typeof window === 'undefined') {
      return
    }

    const currentState = speechPresenceRef.current
    if (currentState.started && currentState.sessionId === sessionId) {
      speechClockRef.current = syncSpeechClockDuration(
        speechClock?.active && speechClock.sessionId === sessionId ? speechClock : speechClockRef.current,
        {
          totalDurationMs: Math.max(
            speechClockRef.current.totalDurationMs || 0,
            speechClock?.totalDurationMs || 0,
          ),
          rate: speechClock?.playbackRate || speechClockRef.current.playbackRate,
          text: speechCuePlanRef.current.fullText,
        },
      )
      return
    }

    const nextSpeechClock = speechClock?.active
      ? speechClock
      : createSpeechClock({
        sessionId,
        source: 'speech',
        timingKind: 'estimated',
        text: speechCuePlanRef.current.fullText || streamingSpeechBufferRef.current,
      })

    const plan = speechCuePlanRef.current?.beats?.length
      ? speechCuePlanRef.current
      : buildSpeechCuePlan([], {
        fallbackText: streamingSpeechBufferRef.current,
        fallbackEmotion,
      })
    const beats = plan.beats.map((beat) => ({
      ...beat,
      offsetMs: beat.animationDelayMs !== null && beat.animationDelayMs !== undefined
        ? Math.max(0, Math.min(Number(beat.animationDelayMs), Math.max(0, nextSpeechClock.totalDurationMs - SPEECH_MOVEMENT_END_BUFFER_MS)))
        : Math.round(Math.max(0, nextSpeechClock.totalDurationMs) * beat.offsetRatio),
    }))

    clearSpeechPresenceTimers()
    speechClockRef.current = nextSpeechClock
    speechPresenceRef.current = {
      sessionId,
      started: true,
      beats,
      recentMovementIds: [],
      lastMovementAssetId: '',
      lastMovementAtMs: 0,
    }

    const firstBeat = beats[0] || null
    const initialEmotion = firstBeat?.emotion || fallbackEmotion || activeEmotionRef.current || 'neutral'
    activeEmotionRef.current = initialEmotion
    playEmotionCueByAssetId(firstBeat?.emotionAssetId || '', initialEmotion, {
      preferSpeech: true,
      loop: true,
      stopOnMiss: true,
    })

    beats.forEach((beat) => {
      const needsCuePlayback = beat.hasExplicitAnimation || beat.index > 0
      if (!needsCuePlayback) {
        return
      }

      if (beat.offsetMs <= 120) {
        void runSpeechBeat(beat, sessionId)
        return
      }

      const timeoutId = window.setTimeout(() => {
        void runSpeechBeat(beat, sessionId)
      }, beat.offsetMs)

      speechPresenceBeatTimeoutsRef.current.push(timeoutId)
    })

    if (nextSpeechClock.totalDurationMs > SPEECH_MOVEMENT_END_BUFFER_MS + 800) {
      queueNextSpeechMovementInjection()
    }

    if (pendingDelayedSpeechCuesRef.current.length > 0) {
      const queuedCues = [...pendingDelayedSpeechCuesRef.current]
      pendingDelayedSpeechCuesRef.current = []
      queuedCues.forEach((cue) => {
        scheduleDelayedSpeechCue(cue, sessionId)
      })
    }
  }, [clearSpeechPresenceTimers, playEmotionCueByAssetId, queueNextSpeechMovementInjection, runSpeechBeat, scheduleDelayedSpeechCue])

  const pickThinkingMovementAsset = useCallback(() => {
    const next = pickThinkingInjectionAsset({
      thinkingItems,
      idleItems,
      actionItems,
      lastAssetId: lastThinkingAssetIdRef.current,
    })

    if (next) {
      lastThinkingAssetIdRef.current = next.id
    }

    return next
  }, [actionItems, idleItems, thinkingItems])

  const clearThinkingCycleTimer = useCallback(() => {
    if (thinkingCycleTimeoutRef.current) {
      window.clearTimeout(thinkingCycleTimeoutRef.current)
      thinkingCycleTimeoutRef.current = null
    }
  }, [])

  const playThinkingMovementAsset = useCallback(async (asset) => {
    if (!asset) {
      return
    }

    const assetPayload = await resolveProjectionAssetPayload(asset, {
      assetKey: asset.id,
      label: asset.label,
      cacheKey: buildAssetCacheKey(asset, 'thinking'),
    })
    const file = assetPayload?.file
    if (!file || !thinkingRuntimeRef.current) {
      return
    }

    playAnimationFile(file, asset.label, {
      cacheKey: buildAssetCacheKey(asset, 'thinking'),
      kind: 'thinking',
      loop: false,
      returnToDefault: true,
      stripExpressionTracks: true,
      priority: 'user-message',
    })
    broadcastProjectionEvent({
      kind: 'play-motion',
      asset: assetPayload,
      motionKind: 'thinking',
      loop: false,
      returnToDefault: true,
      stripExpressionTracks: true,
      priority: 'user-message',
    })
  }, [broadcastProjectionEvent, playAnimationFile, resolveProjectionAssetPayload])

  const queueNextThinkingInjection = useCallback(() => {
    clearThinkingCycleTimer()
    if (!thinkingRuntimeRef.current || thinkingItems.length === 0 || typeof window === 'undefined') {
      return
    }

    thinkingCycleTimeoutRef.current = window.setTimeout(async () => {
      if (!thinkingRuntimeRef.current) {
        return
      }

      const nextAsset = pickThinkingMovementAsset()
      if (!nextAsset) {
        return
      }

      await playThinkingMovementAsset(nextAsset)

      if (thinkingRuntimeRef.current) {
        queueNextThinkingInjection()
      }
    }, sampleThinkingInjectionDelay())
  }, [clearThinkingCycleTimer, pickThinkingMovementAsset, playThinkingMovementAsset, thinkingItems.length])

  const startThinkingPresence = useCallback(async () => {
    if (thinkingRuntimeRef.current) {
      return
    }

    thinkingRuntimeRef.current = true
    clearThinkingCycleTimer()
    activeEmotionRef.current = 'thinking'
    setThinkingIndicatorEnabled(true)
    stopOverlayAnimation({ immediate: true })

    const silentExpression = pickThinkingExpressionAsset(expressionItems, {
      excludedChannels: ['mouth'],
    })
    if (silentExpression) {
      const assetPayload = await resolveProjectionAssetPayload(silentExpression, {
        assetKey: silentExpression.id,
        label: silentExpression.label,
        cacheKey: buildAssetCacheKey(silentExpression, 'thinking'),
      })
      const file = assetPayload?.file
      if (file && thinkingRuntimeRef.current) {
        playOverlayAnimationFile(file, silentExpression.label, {
          cacheKey: buildAssetCacheKey(silentExpression, 'thinking'),
          expressionOnly: true,
          loop: true,
        })
        broadcastProjectionEvent({
          kind: 'play-overlay',
          asset: assetPayload,
          expressionOnly: true,
          loop: true,
        })
      }
    }

    resumeIdleMotion()

    const asset = pickThinkingMovementAsset()
    if (asset) {
      await playThinkingMovementAsset(asset)
    }

    queueNextThinkingInjection()
  }, [broadcastProjectionEvent, clearThinkingCycleTimer, expressionItems, pickThinkingMovementAsset, playOverlayAnimationFile, playThinkingMovementAsset, queueNextThinkingInjection, resolveProjectionAssetPayload, resumeIdleMotion])

  const stopThinkingPresence = useCallback(() => {
    if (!thinkingRuntimeRef.current) {
      return
    }

    thinkingRuntimeRef.current = false
    clearThinkingCycleTimer()
    setThinkingIndicatorEnabled(false)
    if (activeEmotionRef.current === 'thinking') {
      activeEmotionRef.current = 'neutral'
    }
    stopOverlayAnimation({ immediate: false })
    resumeIdleMotion()
    broadcastProjectionEvent({
      kind: 'stop-overlay',
      immediate: false,
    })
    broadcastProjectionEvent({
      kind: 'resume-idle',
    })
  }, [broadcastProjectionEvent, clearThinkingCycleTimer, resumeIdleMotion, setThinkingIndicatorEnabled, stopOverlayAnimation])

  useEffect(() => {
    if (avatarPresence.mode === 'thinking') {
      void startThinkingPresence()
      return
    }

    stopThinkingPresence()
  }, [avatarPresence.mode, startThinkingPresence, stopThinkingPresence])

  const playRemoteTts = useCallback(async (text, emotion, languageSamples = []) => {
    const audio = remoteAudioRef.current
    const cleanedText = String(text || '').trim()
    if (!audio || !cleanedText || !selectedAvatar || !workspace.token || !hasRemoteTtsConfiguration(selectedAvatar)) {
      return false
    }

    if (!speechSessionIdRef.current) {
      speechSessionIdRef.current = 1
    }

    const sessionId = speechSessionIdRef.current
    stopRemoteTtsPlayback()

    const controller = new AbortController()
    remoteTtsAbortRef.current = controller

    const stopRemoteOverlay = () => {
      if (sessionId !== speechSessionIdRef.current) {
        return
      }

      dispatchAvatarPresence({
        type: 'speech_stopped',
        requestId: avatarPresenceRequestIdRef.current,
      })
      stopSpeechPresenceSession()
      stopOverlayAnimation({ immediate: false })
      broadcastProjectionEvent({
        kind: 'stop-overlay',
        immediate: false,
      })
      broadcastProjectionEvent({
        kind: 'resume-idle',
      })
    }

    const response = await streamAvatarTts(workspace.token, selectedAvatar.id, {
      text: cleanedText,
      language: selectedAvatar.speechLanguage,
      languageSamples,
    })

    try {
      await playStreamedAudioResponse(response, audio, {
        signal: controller.signal,
        onStart: () => {
          if (sessionId !== speechSessionIdRef.current) {
            return
          }

          dispatchAvatarPresence({
            type: 'speech_started',
            requestId: avatarPresenceRequestIdRef.current,
          })
          const speechClock = createSpeechClock({
            sessionId,
            source: 'remote-tts',
            timingKind: 'audio-start',
            text: speechCuePlanRef.current.fullText || cleanedText,
            totalDurationMs: estimateSpeechDurationMs(speechCuePlanRef.current.fullText || cleanedText),
          })
          startSpeechPresenceSession(
            sessionId,
            speechClock,
            emotion || activeEmotionRef.current || 'neutral',
          )
          playEmotionCue(emotion || activeEmotionRef.current || 'neutral', { preferSpeech: true, loop: true })
        },
        onEnd: stopRemoteOverlay,
      })
    } finally {
      if (remoteTtsAbortRef.current === controller) {
        remoteTtsAbortRef.current = null
      }
    }

    return true
  }, [broadcastProjectionEvent, dispatchAvatarPresence, playEmotionCue, selectedAvatar, startSpeechPresenceSession, stopOverlayAnimation, stopRemoteTtsPlayback, stopSpeechPresenceSession, workspace.token])

  const queueSpeechUtterance = useCallback((text, emotion, languageSamples = []) => {
    const speechSynthesis = speechSynthesisRef.current
    const cleanedText = String(text || '').trim()
    if (!speechSynthesis || !cleanedText || typeof window === 'undefined' || !('SpeechSynthesisUtterance' in window)) {
      return false
    }
    if (!speechSessionIdRef.current) {
      speechSessionIdRef.current = 1
    }

    const sessionId = speechSessionIdRef.current
    const utterance = new window.SpeechSynthesisUtterance(cleanedText)
    const locale = selectedAvatar?.speechLanguage && selectedAvatar.speechLanguage !== 'auto'
      ? selectedAvatar.speechLanguage
      : detectLanguageLocale(cleanedText, ...languageSamples)
    const preferredVoiceGender = getEffectiveVoiceGender(selectedAvatar) || null
    const voice = pickSpeechVoiceWithPreference(
      speechSynthesis,
      locale,
      preferredVoiceGender,
    ) || pickSpeechVoice(speechSynthesis, locale)

    utterance.lang = locale
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang || locale
    }

    utterance.rate = emotion === 'sleepy' ? 0.92 : emotion === 'shouting' ? 1.08 : 1
    utterance.pitch = emotion === 'playful' ? 1.18 : emotion === 'sad' ? 0.92 : 1

    const stopSpeechOverlayNow = () => {
      if (sessionId !== speechSessionIdRef.current) {
        return
      }

      if (speechStopTimeoutRef.current) {
        window.clearTimeout(speechStopTimeoutRef.current)
        speechStopTimeoutRef.current = null
      }
      if (speechMonitorIntervalRef.current) {
        window.clearInterval(speechMonitorIntervalRef.current)
        speechMonitorIntervalRef.current = null
      }

      dispatchAvatarPresence({
        type: 'speech_stopped',
        requestId: avatarPresenceRequestIdRef.current,
      })
      stopSpeechPresenceSession()
      stopOverlayAnimation({ immediate: false })
      broadcastProjectionEvent({
        kind: 'stop-overlay',
        immediate: false,
      })
      broadcastProjectionEvent({
        kind: 'resume-idle',
      })
    }

    const scheduleSpeechOverlayStop = (delayMs = SPEECH_OVERLAY_RELEASE_MS) => {
      if (sessionId !== speechSessionIdRef.current) {
        return
      }

      if (speechStopTimeoutRef.current) {
        window.clearTimeout(speechStopTimeoutRef.current)
      }

      speechStopTimeoutRef.current = window.setTimeout(
        stopSpeechOverlayNow,
        Math.max(80, delayMs),
      )
    }

    utterance.onstart = () => {
      if (sessionId !== speechSessionIdRef.current) {
        return
      }

      if (speechStopTimeoutRef.current) {
        window.clearTimeout(speechStopTimeoutRef.current)
        speechStopTimeoutRef.current = null
      }
      if (speechMonitorIntervalRef.current) {
        window.clearInterval(speechMonitorIntervalRef.current)
        speechMonitorIntervalRef.current = null
      }

      dispatchAvatarPresence({
        type: 'speech_started',
        requestId: avatarPresenceRequestIdRef.current,
      })
      const speechText = speechCuePlanRef.current.fullText || streamingSpeechBufferRef.current || cleanedText
      const existingClock = speechClockRef.current
      const speechClock = existingClock.active && existingClock.sessionId === sessionId
        ? recordSpeechClockActivity(syncSpeechClockDuration(existingClock, {
          text: speechText,
          rate: utterance.rate,
        }))
        : createSpeechClock({
          sessionId,
          source: 'browser-speech',
          timingKind: 'boundary-events',
          text: speechText,
          rate: utterance.rate,
        })
      startSpeechPresenceSession(
        sessionId,
        speechClock,
        emotion || activeEmotionRef.current || 'neutral',
      )
      playEmotionCue(emotion || activeEmotionRef.current || 'neutral', { preferSpeech: true, loop: true })
      speechStopTimeoutRef.current = window.setTimeout(
        stopSpeechOverlayNow,
        Math.max(SPEECH_OVERLAY_RELEASE_MS, getSpeechClockRemainingMs(speechClock)),
      )
      speechMonitorIntervalRef.current = window.setInterval(() => {
        if (sessionId !== speechSessionIdRef.current) {
          return
        }

        const stillSpeaking = speechSynthesis.speaking || speechSynthesis.pending || speechSynthesis.paused
        if (!stillSpeaking) {
          scheduleSpeechOverlayStop(
            getSpeechClockReleaseDelayMs(speechClockRef.current, {
              boundaryReleaseMs: SPEECH_BOUNDARY_RELEASE_MS,
              overlayReleaseMs: SPEECH_OVERLAY_RELEASE_MS,
            }),
          )
        }
      }, 120)
    }
    utterance.onboundary = () => {
      if (sessionId !== speechSessionIdRef.current) {
        return
      }

      speechClockRef.current = recordSpeechClockActivity(speechClockRef.current)

      if (speechStopTimeoutRef.current) {
        window.clearTimeout(speechStopTimeoutRef.current)
        speechStopTimeoutRef.current = null
      }
    }
    utterance.onend = () => {
      scheduleSpeechOverlayStop(
        getSpeechClockReleaseDelayMs(speechClockRef.current, {
          boundaryReleaseMs: SPEECH_BOUNDARY_RELEASE_MS,
          overlayReleaseMs: SPEECH_OVERLAY_RELEASE_MS,
        }),
      )
    }
    utterance.onpause = () => {
      scheduleSpeechOverlayStop()
    }
    utterance.onresume = () => {
      if (sessionId !== speechSessionIdRef.current) {
        return
      }

      if (speechStopTimeoutRef.current) {
        window.clearTimeout(speechStopTimeoutRef.current)
        speechStopTimeoutRef.current = null
      }
    }
    utterance.onerror = () => {
      scheduleSpeechOverlayStop()
    }
    speechSynthesis.speak(utterance)
    return true
  }, [broadcastProjectionEvent, dispatchAvatarPresence, playEmotionCue, selectedAvatar, startSpeechPresenceSession, stopOverlayAnimation, stopSpeechPresenceSession])

  const playTextOnlyPerformance = useCallback((text, emotion) => {
    const cleanedText = String(text || '').trim()
    if (!cleanedText || typeof window === 'undefined') {
      return false
    }

    if (!speechSessionIdRef.current) {
      speechSessionIdRef.current = 1
    }

    const sessionId = speechSessionIdRef.current
    const speechClock = createSpeechClock({
      sessionId,
      source: 'text-only',
      timingKind: 'estimated',
      text: cleanedText,
      totalDurationMs: estimateSpeechDurationMs(cleanedText),
    })

    if (speechStopTimeoutRef.current) {
      window.clearTimeout(speechStopTimeoutRef.current)
      speechStopTimeoutRef.current = null
    }
    if (speechMonitorIntervalRef.current) {
      window.clearInterval(speechMonitorIntervalRef.current)
      speechMonitorIntervalRef.current = null
    }

    dispatchAvatarPresence({
      type: 'speech_started',
      requestId: avatarPresenceRequestIdRef.current,
    })
    startSpeechPresenceSession(
      sessionId,
      speechClock,
      emotion || activeEmotionRef.current || 'neutral',
    )
    playEmotionCue(emotion || activeEmotionRef.current || 'neutral', { preferSpeech: true, loop: true })

    speechStopTimeoutRef.current = window.setTimeout(() => {
      if (sessionId !== speechSessionIdRef.current) {
        return
      }

      dispatchAvatarPresence({
        type: 'speech_stopped',
        requestId: avatarPresenceRequestIdRef.current,
      })
      stopSpeechPresenceSession()
      stopOverlayAnimation({ immediate: false })
      broadcastProjectionEvent({
        kind: 'stop-overlay',
        immediate: false,
      })
      broadcastProjectionEvent({
        kind: 'resume-idle',
      })
    }, Math.max(
      SPEECH_OVERLAY_RELEASE_MS,
      getSpeechClockRemainingMs(speechClock) + SPEECH_OVERLAY_RELEASE_MS,
    ))

    return true
  }, [broadcastProjectionEvent, dispatchAvatarPresence, playEmotionCue, startSpeechPresenceSession, stopOverlayAnimation, stopSpeechPresenceSession])

  const flushStreamingSpeechBuffer = useCallback((options = {}) => {
    const final = Boolean(options.final)
    const emotion = options.emotion || activeEmotionRef.current || 'neutral'
    const languageSamples = options.languageSamples?.length
      ? options.languageSamples
      : streamingSpeechSamplesRef.current

    while (true) {
      const nextChunk = takeSpeakableSpeechChunk(
        streamingSpeechBufferRef.current,
        streamingSpeechCursorRef.current,
        { final },
      )

      if (!nextChunk) {
        return
      }

      streamingSpeechCursorRef.current = nextChunk.nextIndex
      queueSpeechUtterance(nextChunk.chunk, emotion, languageSamples)
    }
  }, [queueSpeechUtterance])

  const appendPendingAssistantData = useCallback((updater) => {
    setPendingMessages((current) => current.map((message) => (
      message.role !== 'assistant' ? message : updater(message)
    )))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const handleSpeechReset = (event) => {
      const targetAvatarId = event?.detail?.avatarId
      if (!selectedAvatar || (targetAvatarId && Number(targetAvatarId) !== Number(selectedAvatar.id))) {
        return
      }

      dispatchAvatarPresence({ type: 'reset' })
      resetSpeechRuntime()
    }

    window.addEventListener('viewer:reset-speech-state', handleSpeechReset)

    return () => {
      window.removeEventListener('viewer:reset-speech-state', handleSpeechReset)
    }
  }, [dispatchAvatarPresence, resetSpeechRuntime, selectedAvatar])

  const handlePlayAction = useCallback(async () => {
    if (!selectedAction) return
    const assetPayload = await resolveProjectionAssetPayload(selectedAction, {
      assetKey: selectedAction.id,
      label: selectedAction.label,
      cacheKey: buildAssetCacheKey(selectedAction),
    })
    const file = assetPayload?.file
    if (!file) return
    playAnimationFile(file, selectedAction.label, { cacheKey: buildAssetCacheKey(selectedAction) })
    broadcastProjectionEvent({
      kind: 'play-motion',
      asset: assetPayload,
      motionKind: 'action',
      loop: false,
      returnToDefault: true,
      stripExpressionTracks: false,
      priority: 'projection-manual',
    })
  }, [broadcastProjectionEvent, playAnimationFile, resolveProjectionAssetPayload, selectedAction])

  const handlePlayThinking = useCallback(async () => {
    if (!selectedThinking) return
    const assetPayload = await resolveProjectionAssetPayload(selectedThinking, {
      assetKey: selectedThinking.id,
      label: selectedThinking.label,
      cacheKey: buildAssetCacheKey(selectedThinking, 'thinking-preview'),
    })
    const file = assetPayload?.file
    if (!file) return
    playAnimationFile(file, selectedThinking.label, {
      cacheKey: buildAssetCacheKey(selectedThinking, 'thinking-preview'),
      kind: 'thinking',
      loop: true,
      returnToDefault: false,
      stripExpressionTracks: true,
    })
    broadcastProjectionEvent({
      kind: 'play-motion',
      asset: assetPayload,
      motionKind: 'thinking',
      loop: true,
      returnToDefault: false,
      stripExpressionTracks: true,
      priority: 'projection-thinking',
    })
  }, [broadcastProjectionEvent, playAnimationFile, resolveProjectionAssetPayload, selectedThinking])

  const handlePlayExpression = useCallback(async () => {
    if (!selectedExpression) return
    const assetPayload = await resolveProjectionAssetPayload(selectedExpression, {
      assetKey: selectedExpression.id,
      label: selectedExpression.label,
      cacheKey: buildAssetCacheKey(selectedExpression, 'overlay'),
    })
    const file = assetPayload?.file
    if (!file) return
    playOverlayAnimationFile(file, selectedExpression.label, { cacheKey: buildAssetCacheKey(selectedExpression, 'overlay') })
    broadcastProjectionEvent({
      kind: 'play-overlay',
      asset: assetPayload,
      expressionOnly: true,
      loop: false,
    })
  }, [broadcastProjectionEvent, playOverlayAnimationFile, resolveProjectionAssetPayload, selectedExpression])

  const handleSendMessage = useCallback(async () => {
    if (!selectedAvatar || !draftMessage.trim()) return

    const outgoingMessage = draftMessage.trim()
    const tempBaseId = Date.now()
    const requestId = ++avatarPresenceRequestIdRef.current

    setIsChatBusy(true)
    setNotice('')
    setDraftMessage('')
    dispatchAvatarPresence({ type: 'user_message_submitted', requestId })
    hasVisibleAssistantTextRef.current = false
    setPendingMessages([
      {
        id: `temp-user-${tempBaseId}`,
        role: 'user',
        content: outgoingMessage,
        createdAt: new Date().toISOString(),
      },
      {
        id: `temp-assistant-${tempBaseId}`,
        role: 'assistant',
        content: '',
        emotionTags: [],
        animationTags: [],
        createdAt: new Date().toISOString(),
      },
    ])
    resetSpeechRuntime()
    streamingSpeechSamplesRef.current = [outgoingMessage]
    let receivedAssistantText = false

    try {
      const response = await streamChatMessage(selectedAvatar.id, {
        message: outgoingMessage,
        conversationId: activeConversationId || undefined,
        personaId: effectivePersona?.id || undefined,
      }, {
        onConversation: (event) => {
          if (event?.conversation?.id) {
            setActiveConversationId(event.conversation.id)
          }
        },
        onStatus: (event) => {
          if (event?.message) {
            setNotice(event.message)
          }

          if (event?.phase === 'prepare' || event?.phase === 'provider') {
            dispatchAvatarPresence({ type: 'provider_waiting', requestId })
            return
          }

          if (event?.phase === 'stream') {
            setNotice(event?.message || 'Reply started.')
          }
        },
        onTextDelta: (event) => {
          const delta = event?.delta || ''
          if (delta) {
            receivedAssistantText = true
            const hasVisibleDelta = delta.trim() !== ''
            if (hasVisibleDelta && !hasVisibleAssistantTextRef.current) {
              hasVisibleAssistantTextRef.current = true
              dispatchAvatarPresence({ type: 'assistant_text_visible', requestId })
            }
            streamingSpeechBufferRef.current = `${streamingSpeechBufferRef.current}${delta}`
            if (hasVisibleAssistantTextRef.current && !hasRemoteTts && !speechPlaybackDisabled) {
              flushStreamingSpeechBuffer({
                final: false,
                emotion: activeEmotionRef.current || 'neutral',
                languageSamples: [outgoingMessage],
              })
            }
          }
          appendPendingAssistantData((message) => ({
            ...message,
            content: `${message.content || ''}${delta}`,
          }))
        },
        onCue: (event) => {
          const cueType = event?.cueType
          const value = event?.value
          const assetId = event?.assetId
          const delayMs = Number.isFinite(Number(event?.delayMs)) ? Number(event.delayMs) : null

          if (!value) return
          if (!hasVisibleAssistantTextRef.current) return

          if (cueType === 'emotion') {
            activeEmotionRef.current = value
            appendPendingAssistantData((message) => ({
              ...message,
              emotionTags: Array.from(new Set([...(message.emotionTags || []), value])),
            }))
            playEmotionCueByAssetId(assetId, value, thinkingRuntimeRef.current
              ? {
                stopOnMiss: true,
                preferSpeech: false,
                allowSpeechFallback: false,
                excludedChannels: ['mouth'],
              }
              : { stopOnMiss: true })
            return
          }

          if (cueType === 'animation') {
            appendPendingAssistantData((message) => ({
              ...message,
              animationTags: Array.from(new Set([...(message.animationTags || []), value])),
            }))
            if (delayMs !== null) {
              const delayedCue = {
                id: `delayed-cue-${++delayedSpeechCueIdRef.current}`,
                cueType,
                value,
                assetId,
                animationTag: value,
                animationAssetId: assetId,
                emotion: activeEmotionRef.current || 'neutral',
                delayMs,
              }

              scheduleDelayedSpeechCue(delayedCue)
              return
            }

            void playMovementCueByAssetId(assetId, value, {
              emotion: activeEmotionRef.current || 'neutral',
              allowIdle: false,
            }).then((playedAsset) => {
              if (playedAsset && speechPresenceRef.current.started) {
                rememberSpeechMovement(playedAsset)
              }
            })
          }
        },
        onMemory: (event) => {
          if (event?.entry) {
            const scopeLabel = event?.scope === 'long-term' ? 'long-term memory' : 'relationship memory'
            setNotice(`Updated ${scopeLabel}: ${event.entry}`)
          }
        },
      })

      dispatchAvatarPresence({ type: 'response_finished', requestId })
      setPendingMessages([])
      setActiveConversationId(response.conversation.id)
      const firstDeltaMs = response?.timing?.firstDeltaMs
      const providerLabel = response?.conversation?.provider || 'provider'
      const modelLabel = response?.conversation?.model ? ` / ${response.conversation.model}` : ''
      setNotice(
        typeof firstDeltaMs === 'number'
          ? `Reply received via ${providerLabel}${modelLabel}. First text in ${firstDeltaMs} ms.`
          : `Reply received via ${providerLabel}${modelLabel}.`,
      )
      const completedText = response.assistantMessage?.content || ''
      const completedSpeechText = response.assistantSpeechText || completedText
      const llmDebug = response.llmDebug || null
      if (completedText.trim() !== '') {
        hasVisibleAssistantTextRef.current = true
      }
      if (completedText.length > streamingSpeechBufferRef.current.length) {
        streamingSpeechBufferRef.current = completedText
      }
      const finalEmotion = response.assistantMessage?.emotionTags?.[0] || activeEmotionRef.current || 'neutral'
      pendingDelayedSpeechCuesRef.current = []
      speechCuePlanRef.current = buildSpeechCuePlan(response.assistantTimeline, {
        fallbackText: completedText,
        fallbackEmotion: finalEmotion,
      })
      if (llmDebug) {
        const debugEntry = {
          id: `${response.conversation?.id || 'conversation'}:${requestId}:${Date.now()}`,
          createdAt: new Date().toISOString(),
          conversationId: response.conversation?.id || null,
          provider: llmDebug.provider || response.conversation?.provider || '',
          model: llmDebug.model || response.conversation?.model || '',
          requestMessages: Array.isArray(llmDebug.requestMessages) ? llmDebug.requestMessages : [],
          rawCompletion: String(llmDebug.rawCompletion || ''),
          userMessage: outgoingMessage,
          assistantText: completedText,
        }

        setLlmDebugLog((current) => [debugEntry, ...current].slice(0, 8))
        setSelectedDebugEntryId(debugEntry.id)
      }
      if (speechPlaybackDisabled) {
        playTextOnlyPerformance(completedSpeechText, finalEmotion)
      } else if (hasRemoteTts) {
        void playRemoteTts(completedSpeechText, finalEmotion, [outgoingMessage]).catch((nextError) => {
          setNotice(`${nextError.message || 'ElevenLabs playback failed.'} Falling back to browser speech.`)
          flushStreamingSpeechBuffer({
            final: true,
            emotion: finalEmotion,
            languageSamples: [outgoingMessage],
          })
        })
      } else {
        flushStreamingSpeechBuffer({
          final: true,
          emotion: finalEmotion,
          languageSamples: [outgoingMessage],
        })
      }
    } catch (error) {
      dispatchAvatarPresence({ type: 'response_failed', requestId })
      if (!receivedAssistantText) {
        setPendingMessages([])
        setDraftMessage(outgoingMessage)
      }

      setNotice(
        receivedAssistantText
          ? `${error.message || 'Chat failed.'} Partial reply kept on screen, but this turn was not saved.`
          : (error.message || 'Chat failed.'),
      )
    } finally {
      setIsChatBusy(false)
    }
  }, [
    activeConversationId,
    dispatchAvatarPresence,
    appendPendingAssistantData,
    draftMessage,
    effectivePersona,
    playEmotionCueByAssetId,
    playMovementCueByAssetId,
    flushStreamingSpeechBuffer,
    speechPlaybackDisabled,
    hasRemoteTts,
    playTextOnlyPerformance,
    playRemoteTts,
    rememberSpeechMovement,
    resetSpeechRuntime,
    scheduleDelayedSpeechCue,
    selectedAvatar,
    streamChatMessage,
  ])

  const chatDisabled = !selectedAvatar || !effectivePersona || !effectivePersona.llmCredentialId

  const openManageSection = useCallback((sectionId) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MANAGE_SECTION_KEY, sectionId)
    }

    onNavigate?.('manage')
  }, [onNavigate])

  const openHologramProjectionWindow = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    const hologramUrl = buildHologramProjectionUrl(window.location)
    const popup = window.open(
      hologramUrl,
      '_blank',
      buildHologramWindowFeatures(PIXELXL_PRISM_WINDOW_PRESET),
    )

    if (!popup) {
      setNotice('The hologram tab was blocked by the browser popup settings.')
      return
    }

    popup.focus?.()
    setNotice('Opened the PIXELXL prism projection tab in a new window.')
    window.setTimeout(() => {
      void broadcastProjectionFullState()
    }, 250)
  }, [broadcastProjectionFullState])

  function handleChatComposerKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    if (chatDisabled || isChatBusy || isContextLoading || !draftMessage.trim()) return
    handleSendMessage()
  }

  return (
    <div className="min-h-screen bg-transparent text-white">
      <div className="grid min-h-screen w-full grid-cols-1 gap-6 px-4 pb-10 pt-6 2xl:grid-cols-[340px_minmax(0,1fr)_auto] lg:px-6">
        <aside className="space-y-5 rounded-[32px] border border-white/10 bg-[rgba(8,15,22,0.8)] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur lg:self-start lg:sticky lg:top-6 lg:max-h-[calc(100vh-48px)] lg:overflow-y-auto">
          <section>
            <div className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">Workspace</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-white">Avatar runtime</div>
            <div className="mt-3 text-sm leading-6 text-white/62">
              Chat with the avatar, watch streamed reactions, and keep the runtime view aligned with the new studio design.
            </div>
            {isContextLoading ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs text-cyan-100">
                <span className="h-4 w-4 rounded-full border-2 border-cyan-100/30 border-t-cyan-100 animate-spin" />
                Loading avatar context...
              </div>
            ) : null}
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[rgba(10,16,30,0.82)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.28em] text-white/45">Conversation</div>
              <div className="text-[11px] text-white/40">{conversations.length} threads</div>
            </div>

            <textarea
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              onKeyDown={handleChatComposerKeyDown}
              rows={4}
              disabled={chatDisabled || isContextLoading}
              placeholder={chatDisabled ? (!selectedAvatar ? 'Open Control Center and save this avatar to your library first.' : 'Open Control Center and connect one AI provider first.') : 'Type a message to the selected avatar'}
              className="mt-4 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={chatDisabled || isChatBusy || isContextLoading || !draftMessage.trim()}
              className="mt-3 w-full rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isChatBusy ? 'Sending...' : isContextLoading ? 'Loading...' : 'Send message'}
            </button>

            {notice ? <div className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-100">{notice}</div> : null}

            <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto rounded-3xl border border-white/10 bg-black/25 p-3">
              {chatPhase === 'waiting' ? (
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-3 text-sm text-cyan-100">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-cyan-100/30 border-t-cyan-100 animate-spin" />
                    Avatar is thinking...
                  </span>
                </div>
              ) : null}
              {displayMessages.length === 0 ? (
                <div className="rounded-2xl bg-black/30 px-3 py-3 text-sm text-white/60">
                  {chatDisabled
                    ? !selectedAvatar
                      ? 'Default avatars are preview-only here. Open Control Center to add one to your library first.'
                      : 'Open Control Center and attach one AI connection before starting chat.'
                    : 'Start a conversation with the selected avatar.'}
                </div>
              ) : null}
              {displayMessages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-2xl px-3 py-3 text-sm ${
                    message.role === 'assistant' ? 'bg-cyan-300/10 text-cyan-50' : 'bg-white/8 text-white/82'
                  }`}
                >
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">{message.role}</div>
                  <div className="mt-2 whitespace-pre-wrap leading-6">
                    {message.role === 'assistant' && speechPlaybackDisabled
                      ? (message.spokenContent || message.content)
                      : message.content}
                  </div>
                  {message.emotionTags?.length > 0 || message.animationTags?.length > 0 ? (
                    <div className="mt-2 text-[11px] text-white/45">
                      {[message.emotionTags?.length ? `emotion: ${message.emotionTags.join(', ')}` : null, message.animationTags?.length ? `movement: ${message.animationTags.join(', ')}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[rgba(10,16,30,0.82)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.28em] text-white/45">Configured avatar</div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/38">
                {selectedAvatarAsset?.scope === 'personal' ? 'Library' : 'Default preview'}
              </div>
            </div>
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
              disabled={isContextLoading}
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {viewerAvatarItems.length === 0 ? <option value="">No avatars available</option> : null}
              {viewerAvatarItems.map((avatar) => (
                <option key={avatar.id} value={avatar.id}>
                  [{avatar.scope === 'personal' ? 'Mine' : 'Default'}] {avatar.label}
                </option>
              ))}
            </select>

            <div className="mt-4 grid gap-3">
              <ViewerMetric
                label="Identity"
                value={effectivePersona?.name || selectedAvatar?.name || selectedAvatarAsset?.label || 'No avatar selected'}
                detail={effectivePersona?.llmProvider ? `AI ${effectivePersona.llmProvider}` : selectedAvatar ? 'No AI attached yet' : 'Add to your library before chatting'}
                tone={selectedAvatar ? 'success' : 'warning'}
              />
              <ViewerMetric
                label="Voice path"
                value={speechPathLabel}
                detail={speechPathDetail}
                tone={speechPlaybackDisabled ? 'warning' : (hasRemoteTts ? 'success' : 'warning')}
              />
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[rgba(10,16,30,0.82)] p-4">
            <div className="text-xs uppercase tracking-[0.28em] text-white/45">Selected identity</div>
            <div className="mt-3 text-2xl font-semibold text-cyan-100">
              {effectivePersona?.name || selectedAvatar?.name || selectedAvatarAsset?.label || 'No avatar selected'}
            </div>
            <div className="mt-3 text-sm leading-6 text-white/65">
              {effectivePersona?.description || selectedAvatar?.backstory || selectedAvatarAsset?.description || 'The selected avatar does not have a description yet.'}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-white/65">
                {effectivePersona?.llmProvider ? `AI: ${effectivePersona.llmProvider}` : selectedAvatar ? 'No AI attached' : 'Default preview avatar'}
              </span>
              {!selectedAvatar ? (
                <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-amber-100">
                  Add this default avatar in Control Center before chatting
                </span>
              ) : null}
              {(selectedAvatar?.personality || selectedAvatarAsset?.personality) ? (
                <span className="rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1 text-cyan-100">
                  Personality ready
                </span>
              ) : null}
            </div>
          </section>
        </aside>

        <main className="relative min-h-[62vh] lg:self-start lg:sticky lg:top-6">
          <div className="relative h-[72vh] min-h-[560px] overflow-hidden rounded-[36px] border border-cyan-300/15 bg-black/25 shadow-[0_30px_90px_rgba(3,7,18,0.42)] 2xl:h-[calc(100vh-72px)]">
            <canvas ref={canvasRef} className="viewer-canvas" />

            <div className="pointer-events-none absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, rgba(13,185,242,0.9) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-6">
              <div className="rounded-full border border-cyan-300/20 bg-black/35 px-5 py-2 text-xs uppercase tracking-[0.25em] text-cyan-200/90 backdrop-blur">
                {loadedAvatarName}
              </div>
            </div>

            <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/65 backdrop-blur">
              Avatar: {selectedAvatar?.name || selectedAvatarAsset?.label || 'none'}
            </div>

            <div className="pointer-events-none absolute right-4 top-4 rounded-full border border-cyan-300/20 bg-black/35 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-cyan-100/90 backdrop-blur">
              Phase: {chatPhase}
            </div>

            <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-cyan-300/20 bg-black/35 px-4 py-2 text-xs uppercase tracking-[0.2em] text-cyan-100/90 backdrop-blur">
              {isAvatarLoading ? 'Loading avatar...' : status}
            </div>

            <div className="pointer-events-none absolute bottom-4 right-4 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/60 backdrop-blur">
              {speechPlaybackDisabled ? 'Text-only cues active' : (hasRemoteTts ? 'Remote voice ready' : 'Browser speech fallback')}
            </div>

            <div className="absolute bottom-6 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-[rgba(8,15,22,0.82)] px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.32)] backdrop-blur xl:flex">
              {[
                { label: 'Library', section: 'vrm-library' },
                { label: 'Settings', section: 'avatar-edit' },
                { label: 'Procedural', section: 'procedural' },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => openManageSection(item.section)}
                  className="rounded-full border border-transparent px-4 py-2 text-sm text-white/72 transition hover:border-cyan-300/20 hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={openHologramProjectionWindow}
                className="rounded-full border border-cyan-300/30 bg-cyan-300/18 px-5 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/26"
              >
                Live hologram tab
              </button>
            </div>

            {!isLoaded ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <div className="max-w-md rounded-[28px] border border-cyan-300/16 bg-[rgba(3,7,18,0.58)] px-6 py-5 text-center text-sm leading-6 text-white/78 shadow-[0_0_56px_rgba(34,211,238,0.1)] backdrop-blur">
                  {viewerAvatarItems.length === 0
                    ? 'Use Control Center to add a default avatar or upload your own.'
                    : 'Select an avatar to load it into the workspace.'}
                </div>
              </div>
            ) : null}
          </div>
        </main>

        <div className={`relative hidden overflow-visible 2xl:block 2xl:self-start 2xl:sticky 2xl:top-6 h-[calc(100vh-48px)] transition-[width] duration-300 ease-out ${isRightPanelCollapsed ? 'w-0' : 'w-[320px]'}`}>
          <button
            type="button"
            onClick={() => setIsRightPanelCollapsed((current) => !current)}
            className="absolute left-0 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/25 bg-[rgba(8,15,22,0.92)] px-3 py-3 text-xs font-medium uppercase tracking-[0.16em] text-cyan-100 shadow-[0_18px_40px_rgba(0,0,0,0.28)] transition hover:bg-[rgba(12,22,32,0.96)]"
            aria-label={isRightPanelCollapsed ? 'Expand right panel' : 'Collapse right panel'}
          >
            {isRightPanelCollapsed ? '<' : '>'}
          </button>

          <aside className={`absolute inset-y-0 right-0 w-[320px] space-y-5 overflow-y-auto rounded-[32px] border border-white/10 bg-[rgba(8,15,22,0.8)] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur transition-all duration-300 ease-out ${isRightPanelCollapsed ? 'pointer-events-none translate-x-full opacity-0' : 'pointer-events-auto translate-x-0 opacity-100'}`}>
            <section className="rounded-[28px] border border-white/10 bg-[rgba(10,16,30,0.82)] p-4">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Animations</div>
                <div className="mt-1 text-sm text-white/60">Direct runtime controls for the current avatar.</div>
              </div>
              <button
                type="button"
                onClick={() => openManageSection('vrma-library')}
                className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/60 transition hover:border-cyan-300/20 hover:text-cyan-100"
              >
                Library
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <label className="block space-y-2">
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">Idle pose</div>
                <select
                  value={selectedIdleId}
                  onChange={(event) => setSelectedIdleId(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
                >
                  {idleItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => selectedIdle && assetToFile(selectedIdle).then((file) => file && setIdleAnimation(file, selectedIdle.label, { cacheKey: buildAssetCacheKey(selectedIdle) }))}
                  disabled={!selectedIdle}
                  className="w-full rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Set idle
                </button>
              </label>

              <label className="block space-y-2">
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">Action</div>
                <select
                  value={selectedActionId}
                  onChange={(event) => setSelectedActionId(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
                >
                  {actionItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handlePlayAction}
                  disabled={!selectedAction}
                  className="w-full rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Play action
                </button>
              </label>

              <label className="block space-y-2">
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">Thinking</div>
                <select
                  value={selectedThinkingId}
                  onChange={(event) => setSelectedThinkingId(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
                >
                  {thinkingItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handlePlayThinking}
                  disabled={!selectedThinking}
                  className="w-full rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Play thinking cue
                </button>
              </label>

              <label className="block space-y-2">
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">Expression</div>
                <select
                  value={selectedExpressionId}
                  onChange={(event) => setSelectedExpressionId(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
                >
                  {expressionItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handlePlayExpression}
                  disabled={!selectedExpression}
                  className="w-full rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Play expression
                </button>
              </label>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-[rgba(10,16,30,0.82)] p-4">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Camera</div>
                  <div className="mt-1 text-sm text-white/60">Framing and viewer assists now live in this panel.</div>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {VIEWER_CAMERA_SLIDERS.map(({ key, label, min, max, step, unit }) => {
                  const value = framingState[key] ?? 0

                  return (
                    <label key={key} className="block space-y-2">
                      <div className="flex items-center justify-between text-sm text-white/82">
                        <span>{label}</span>
                        <span className="font-mono text-cyan-100">
                          {formatViewerSliderValue(step, value, unit)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={(event) => setFramingValue(key, Number(event.target.value))}
                        className="w-full"
                      />
                    </label>
                  )
                })}
              </div>

              <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-100/80">Viewer assists</div>
                {VIEWER_ASSIST_OPTIONS.map(({ key, label, description }) => (
                  <label key={key} className="flex items-start justify-between gap-3 rounded-2xl border border-white/8 bg-white/5 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm text-white/85">{label}</div>
                      <div className="mt-1 text-[11px] leading-5 text-white/45">{description}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(viewerOptions[key])}
                      onChange={(event) => {
                        setViewerOption(key, event.target.checked)
                        setNotice(`${VIEWER_OPTION_LABELS[key] || key}: ${event.target.checked ? 'on' : 'off'}`)
                      }}
                      className="mt-1 h-4 w-4 accent-cyan-400"
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-[rgba(10,16,30,0.82)] p-4">
              <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Monitoring</div>
              <div className="mt-4 grid gap-3">
              <ViewerMetric label="Chat phase" value={chatPhase} detail={isChatBusy ? 'Reply in progress.' : 'Idle until the next user turn.'} tone={chatPhase === 'idle' ? 'success' : 'warning'} />
              <ViewerMetric label="Speech path" value={speechPlaybackDisabled ? 'No voice' : (hasRemoteTts ? 'ElevenLabs' : 'Browser')} detail={speechPathDetail} tone={speechPlaybackDisabled ? 'warning' : (hasRemoteTts ? 'success' : 'warning')} />
              <ViewerMetric label="Eye blinking" value={viewerOptions.autoBlink ? 'Auto' : 'Off'} detail="Toggle available from the camera popover." />
              <ViewerMetric label="Camera follow" value={viewerOptions.lookAtCamera ? 'Enabled' : 'Disabled'} detail="The viewer can keep eyes pointed toward the camera." />
            </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-[rgba(10,16,30,0.82)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">LLM debug</div>
                  <div className="mt-1 text-sm text-white/60">Inspect the exact prompt payload, including injected memory, and the raw completion text from recent turns.</div>
                </div>
                {llmDebugLog.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setLlmDebugLog([])
                      setSelectedDebugEntryId('')
                    }}
                    className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/60 transition hover:border-cyan-300/20 hover:text-cyan-100"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              {llmDebugLog.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white/55">
                  Send a message to capture the exact provider prompt and raw reply for debugging memory and cue behavior.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {llmDebugLog.map((entry) => {
                      const isSelected = entry.id === (selectedLlmDebugEntry?.id || '')

                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => setSelectedDebugEntryId(entry.id)}
                          title={summarizeDebugEntry(entry)}
                          className={`max-w-full rounded-full border px-3 py-1.5 text-left text-[11px] uppercase tracking-[0.16em] transition ${
                            isSelected
                              ? 'border-cyan-300/30 bg-cyan-300/15 text-cyan-100'
                              : 'border-white/10 bg-black/20 text-white/55 hover:border-cyan-300/20 hover:text-white'
                          }`}
                        >
                          {summarizeDebugEntry(entry)}
                        </button>
                      )
                    })}
                  </div>

                  {selectedLlmDebugEntry ? (
                    <>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs leading-5 text-white/60">
                        <div className="font-medium text-cyan-100">
                          {selectedLlmDebugEntry.provider || 'provider'}
                          {selectedLlmDebugEntry.model ? ` / ${selectedLlmDebugEntry.model}` : ''}
                        </div>
                        <div className="mt-1">{selectedLlmDebugEntry.requestMessages.length} prompt messages in this turn.</div>
                      </div>

                      <label className="block space-y-2">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-100/80">Prompt sent</div>
                        <textarea
                          readOnly
                          value={selectedLlmDebugPrompt}
                          rows={14}
                          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-3 font-mono text-xs leading-5 text-white/78 outline-none"
                        />
                      </label>

                      <label className="block space-y-2">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-100/80">Raw reply</div>
                        <textarea
                          readOnly
                          value={selectedLlmDebugEntry.rawCompletion}
                          rows={8}
                          className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-3 font-mono text-xs leading-5 text-white/78 outline-none"
                        />
                      </label>
                    </>
                  ) : null}
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-white/10 bg-[rgba(10,16,30,0.82)] p-4">
            <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Projection shortcuts</div>
            <div className="mt-3 text-sm leading-6 text-white/60">
              The hologram and procedural screens are visible in Control Center now, but they still contain placeholders until those systems are implemented.
            </div>
            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={() => openManageSection('procedural')}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left text-sm text-white/75 transition hover:border-cyan-300/20 hover:bg-white/10 hover:text-white"
              >
                Open procedural settings
              </button>
              <button
                type="button"
                onClick={openHologramProjectionWindow}
                className="rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-3 text-left text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/24"
              >
                Open live PIXELXL prism tab
              </button>
              <button
                type="button"
                onClick={() => openManageSection('hologram')}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left text-sm text-white/75 transition hover:border-cyan-300/20 hover:bg-white/10 hover:text-white"
              >
                Open hologram control center
              </button>
            </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
