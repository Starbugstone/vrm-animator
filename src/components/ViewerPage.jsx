import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CameraPopover from '../CameraPopover.jsx'
import useHologramViewer from '../useHologramViewer.js'
import AnimationPopover from './AnimationPopover.jsx'
import {
  assetToFile,
  createPersistedAnimationAsset,
  createPersistedAvatarAsset,
} from '../lib/viewerAssets.js'
import { isExpressionAssetAllowed, pickExpressionAsset, pickThinkingExpressionAsset } from '../lib/viewerExpressions.js'
import {
  pickThinkingInjectionAsset,
  sampleThinkingInjectionDelay,
} from '../lib/viewerThinking.js'
import { takeSpeakableSpeechChunk } from '../lib/viewerSpeech.js'

const VIEWER_OPTION_LABELS = {
  autoBlink: 'Auto blink',
  lookAtCamera: 'Eyes follow camera',
}

const SPEECH_LANGUAGE_FALLBACK = 'en-US'
const SPEECH_OVERLAY_RELEASE_MS = 220
const SPEECH_BOUNDARY_RELEASE_MS = 180
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

function estimateSpeechDurationMs(text, rate = 1) {
  const wordCount = String(text || '').trim().split(/\s+/).filter(Boolean).length
  if (wordCount === 0) {
    return 0
  }

  const wordsPerMinute = 165 * Math.max(rate, 0.6)
  const minutes = wordCount / wordsPerMinute

  return Math.max(1800, Math.ceil(minutes * 60_000) + 1200)
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
  const [chatPhase, setChatPhase] = useState('idle')
  const [isContextLoading, setIsContextLoading] = useState(false)
  const [loadedAvatarName, setLoadedAvatarName] = useState('No avatar loaded')
  const [pendingMessages, setPendingMessages] = useState([])
  const lastSyncedAvatarIdRef = useRef(selectedAvatarId)
  const activeEmotionRef = useRef('neutral')
  const speechSynthesisRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis || null : null)
  const speechSessionIdRef = useRef(0)
  const speechStopTimeoutRef = useRef(null)
  const speechMonitorIntervalRef = useRef(null)
  const lastSpeechActivityAtRef = useRef(0)
  const streamingSpeechBufferRef = useRef('')
  const streamingSpeechCursorRef = useRef(0)
  const streamingSpeechSamplesRef = useRef([])
  const hasVisibleAssistantTextRef = useRef(false)
  const thinkingRuntimeRef = useRef(false)
  const thinkingCycleTimeoutRef = useRef(null)
  const lastThinkingAssetIdRef = useRef('')

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
  const selectedIdle = useMemo(() => idleItems.find((entry) => entry.id === selectedIdleId) || idleItems[0] || null, [idleItems, selectedIdleId])
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
  const hasStartedChat = liveMessages.length > 0 || conversations.length > 0

  useEffect(() => {
    if (!selectedAvatar || !workspace.token) {
      setActiveConversationId(null)
      setPendingMessages([])
      setIsContextLoading(false)
      setChatPhase('idle')
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
      speechSynthesisRef.current?.cancel?.()
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
  }, [ensureConversationMessages, ensureConversations, ensurePersonas, selectedAvatar, setThinkingIndicatorEnabled, stopOverlayAnimation, workspace.token])

  useEffect(() => () => {
    if (thinkingCycleTimeoutRef.current) {
      window.clearTimeout(thinkingCycleTimeoutRef.current)
      thinkingCycleTimeoutRef.current = null
    }
  }, [])

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
  }, [actionItems, expressionItems, idleItems, selectedActionId, selectedExpressionId, selectedIdleId, selectedThinkingId, thinkingItems])

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
      speechSynthesis.removeEventListener?.('voiceschanged', primeVoices)
      speechSynthesisRef.current?.cancel?.()
      stopOverlayAnimation({ immediate: false })
    }
  }, [stopOverlayAnimation])

  const playMovementCue = useCallback(async (movementTag) => {
    const asset = findMovementAssetByTag([...actionItems, ...idleItems], movementTag)
    if (!asset) return

    const file = await assetToFile(asset)
    if (!file) return

    playAnimationFile(file, asset.label, {
      cacheKey: asset.id,
      kind: asset.kind || 'action',
    })
  }, [actionItems, idleItems, playAnimationFile])

  const playMovementCueByAssetId = useCallback(async (assetId, fallbackTag = '') => {
    const availableItems = [...actionItems, ...idleItems]
    const asset = findAssetById(availableItems, assetId) || findMovementAssetByTag(availableItems, fallbackTag)
    if (!asset) return

    const file = await assetToFile(asset)
    if (!file) return

    playAnimationFile(file, asset.label, {
      cacheKey: asset.id,
      kind: asset.kind || 'action',
    })
  }, [actionItems, idleItems, playAnimationFile])

  const resetSpeechRuntime = useCallback(() => {
    speechSessionIdRef.current += 1
    lastSpeechActivityAtRef.current = 0
    streamingSpeechBufferRef.current = ''
    streamingSpeechCursorRef.current = 0
    streamingSpeechSamplesRef.current = []
    hasVisibleAssistantTextRef.current = false

    if (speechStopTimeoutRef.current) {
      window.clearTimeout(speechStopTimeoutRef.current)
      speechStopTimeoutRef.current = null
    }

    if (speechMonitorIntervalRef.current) {
      window.clearInterval(speechMonitorIntervalRef.current)
      speechMonitorIntervalRef.current = null
    }

    activeEmotionRef.current = 'neutral'
    speechSynthesisRef.current?.cancel?.()
    stopOverlayAnimation({ immediate: true })
  }, [stopOverlayAnimation])

  const playEmotionCue = useCallback(async (emotion, options = {}) => {
    const asset = pickExpressionAsset(expressionItems, emotion, options)
    if (!asset) {
      if (options.stopOnMiss) {
        stopOverlayAnimation()
      }
      return
    }

    const file = await assetToFile(asset)
    if (!file) return

    playOverlayAnimationFile(file, asset.label, {
      cacheKey: `${asset.id}:${options.preferSpeech ? 'speech' : 'cue'}`,
      expressionOnly: true,
      loop: Boolean(options.loop),
    })
  }, [expressionItems, playOverlayAnimationFile, stopOverlayAnimation])

  const playEmotionCueByAssetId = useCallback(async (assetId, fallbackEmotion = '', options = {}) => {
    const directAsset = findAssetById(expressionItems, assetId)
    const asset = directAsset && isExpressionAssetAllowed(directAsset, options)
      ? directAsset
      : pickExpressionAsset(expressionItems, fallbackEmotion, options)
    if (!asset) {
      if (options.stopOnMiss) {
        stopOverlayAnimation()
      }
      return
    }

    const file = await assetToFile(asset)
    if (!file) return

    playOverlayAnimationFile(file, asset.label, {
      cacheKey: `${asset.id}:${options.preferSpeech ? 'speech' : 'cue'}`,
      expressionOnly: true,
      loop: Boolean(options.loop),
    })
  }, [expressionItems, playOverlayAnimationFile, stopOverlayAnimation])

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

    const file = await assetToFile(asset)
    if (!file || !thinkingRuntimeRef.current) {
      return
    }

    playAnimationFile(file, asset.label, {
      cacheKey: `${asset.id}:thinking`,
      kind: 'thinking',
      loop: false,
      returnToDefault: true,
      stripExpressionTracks: true,
    })
  }, [playAnimationFile])

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
      const file = await assetToFile(silentExpression)
      if (file && thinkingRuntimeRef.current) {
        playOverlayAnimationFile(file, silentExpression.label, {
          cacheKey: `${silentExpression.id}:thinking`,
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
  }, [clearThinkingCycleTimer, expressionItems, pickThinkingMovementAsset, playOverlayAnimationFile, playThinkingMovementAsset, queueNextThinkingInjection, resumeIdleMotion])

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
  }, [clearThinkingCycleTimer, resumeIdleMotion, setThinkingIndicatorEnabled, stopOverlayAnimation])

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
    const voice = pickSpeechVoiceWithPreference(
      speechSynthesis,
      locale,
      selectedAvatar?.speechVoiceGender || null,
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

      stopOverlayAnimation({ immediate: false })
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

    const markSpeechActivity = () => {
      lastSpeechActivityAtRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now()
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

      markSpeechActivity()
      playEmotionCue(emotion || activeEmotionRef.current || 'neutral', { preferSpeech: true, loop: true })
      speechStopTimeoutRef.current = window.setTimeout(
        stopSpeechOverlayNow,
        estimateSpeechDurationMs(cleanedText, utterance.rate),
      )
      speechMonitorIntervalRef.current = window.setInterval(() => {
        if (sessionId !== speechSessionIdRef.current) {
          return
        }

        const stillSpeaking = speechSynthesis.speaking || speechSynthesis.pending || speechSynthesis.paused
        if (!stillSpeaking) {
          const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
          const elapsedSinceBoundary = Math.max(0, now - lastSpeechActivityAtRef.current)
          const releaseDelay = lastSpeechActivityAtRef.current > 0
            ? Math.max(80, SPEECH_BOUNDARY_RELEASE_MS - elapsedSinceBoundary)
            : SPEECH_OVERLAY_RELEASE_MS
          scheduleSpeechOverlayStop(releaseDelay)
        }
      }, 120)
    }
    utterance.onboundary = () => {
      if (sessionId !== speechSessionIdRef.current) {
        return
      }

      markSpeechActivity()

      if (speechStopTimeoutRef.current) {
        window.clearTimeout(speechStopTimeoutRef.current)
        speechStopTimeoutRef.current = null
      }
    }
    utterance.onend = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const elapsedSinceBoundary = Math.max(0, now - lastSpeechActivityAtRef.current)
      const releaseDelay = lastSpeechActivityAtRef.current > 0
        ? Math.max(80, SPEECH_BOUNDARY_RELEASE_MS - elapsedSinceBoundary)
        : SPEECH_OVERLAY_RELEASE_MS
      scheduleSpeechOverlayStop(releaseDelay)
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
  }, [playEmotionCue, selectedAvatar, stopOverlayAnimation])

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

      resetSpeechRuntime()
    }

    window.addEventListener('viewer:reset-speech-state', handleSpeechReset)

    return () => {
      window.removeEventListener('viewer:reset-speech-state', handleSpeechReset)
    }
  }, [resetSpeechRuntime, selectedAvatar])

  const handlePlayAction = useCallback(async () => {
    if (!selectedAction) return
    const file = await assetToFile(selectedAction)
    if (!file) return
    playAnimationFile(file, selectedAction.label, { cacheKey: selectedAction.id })
  }, [playAnimationFile, selectedAction])

  const handlePlayThinking = useCallback(async () => {
    if (!selectedThinking) return
    const file = await assetToFile(selectedThinking)
    if (!file) return
    playAnimationFile(file, selectedThinking.label, {
      cacheKey: `${selectedThinking.id}:thinking-preview`,
      kind: 'thinking',
      loop: true,
      returnToDefault: false,
      stripExpressionTracks: true,
    })
  }, [playAnimationFile, selectedThinking])

  const handlePlayExpression = useCallback(async () => {
    if (!selectedExpression) return
    const file = await assetToFile(selectedExpression)
    if (!file) return
    playOverlayAnimationFile(file, selectedExpression.label, { cacheKey: `${selectedExpression.id}:overlay` })
  }, [playOverlayAnimationFile, selectedExpression])

  const handleSendMessage = useCallback(async () => {
    if (!selectedAvatar || !draftMessage.trim()) return

    const outgoingMessage = draftMessage.trim()
    const tempBaseId = Date.now()

    setIsChatBusy(true)
    setNotice('')
    setDraftMessage('')
    setChatPhase('waiting')
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
            setChatPhase('waiting')
            startThinkingPresence()
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
              setChatPhase('streaming')
              stopThinkingPresence()
            }
            streamingSpeechBufferRef.current = `${streamingSpeechBufferRef.current}${delta}`
            if (hasVisibleAssistantTextRef.current) {
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
            playMovementCueByAssetId(assetId, value)
          }
        },
        onMemory: (event) => {
          if (event?.entry) {
            const scopeLabel = event?.scope === 'long-term' ? 'long-term memory' : 'relationship memory'
            setNotice(`Updated ${scopeLabel}: ${event.entry}`)
          }
        },
      })

      stopThinkingPresence()
      setChatPhase('idle')
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
      if (completedText.trim() !== '') {
        hasVisibleAssistantTextRef.current = true
      }
      if (completedText.length > streamingSpeechBufferRef.current.length) {
        streamingSpeechBufferRef.current = completedText
      }
      flushStreamingSpeechBuffer({
        final: true,
        emotion: response.assistantMessage?.emotionTags?.[0] || activeEmotionRef.current || 'neutral',
        languageSamples: [outgoingMessage],
      })
    } catch (error) {
      stopThinkingPresence()
      setChatPhase('idle')
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
      stopThinkingPresence()
      setChatPhase('idle')
      setIsChatBusy(false)
    }
  }, [
    activeConversationId,
    appendPendingAssistantData,
    draftMessage,
    effectivePersona,
    playEmotionCue,
    playEmotionCueByAssetId,
    playMovementCueByAssetId,
    flushStreamingSpeechBuffer,
    resetSpeechRuntime,
    selectedAvatar,
    startThinkingPresence,
    stopThinkingPresence,
    streamChatMessage,
  ])

  const chatDisabled = !selectedAvatar || !effectivePersona || !effectivePersona.llmCredentialId

  function handleChatComposerKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    if (chatDisabled || isChatBusy || isContextLoading || !draftMessage.trim()) return
    handleSendMessage()
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#162c4f_0%,_#08111d_38%,_#03070d_100%)] text-white">
      <div className="mx-auto grid min-h-screen max-w-[1680px] grid-cols-1 gap-6 px-4 pb-8 pt-6 xl:grid-cols-[370px_minmax(0,1fr)] xl:px-6">
        <aside className="space-y-5 rounded-[32px] border border-white/10 bg-[rgba(6,10,20,0.76)] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur">
          <section>
            <div className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">Viewer</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight">Avatar runtime</div>
            <div className="mt-3 text-sm leading-6 text-white/62">Preview the avatar, test animations, and chat in one place.</div>
            {isContextLoading ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs text-cyan-100">
                <span className="h-4 w-4 rounded-full border-2 border-cyan-100/30 border-t-cyan-100 animate-spin" />
                Loading avatar context...
              </div>
            ) : null}
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[rgba(10,16,30,0.85)] p-4">
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
              placeholder={chatDisabled ? (!selectedAvatar ? 'Open Manage and save this avatar to your library first.' : 'Open Manage and connect one AI provider first.') : 'Type a message to the selected avatar'}
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

            <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto rounded-3xl border border-white/10 bg-black/25 p-3">
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
                      ? 'Default avatars are preview-only here. Open Manage to add one to your library first.'
                      : 'Open Manage and attach one AI connection before starting chat.'
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
                  <div className="mt-2 whitespace-pre-wrap leading-6">{message.content}</div>
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

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Attached identity</div>
              <div className="mt-2 text-sm font-medium text-white">
                {effectivePersona?.name || selectedAvatar?.name || 'No identity configured'}
              </div>
              <div className="mt-1 text-xs text-white/55">
                {effectivePersona?.llmProvider ? `AI: ${effectivePersona.llmProvider}` : 'No AI attached'}
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
                {effectivePersona?.llmProvider ? `AI: ${effectivePersona.llmProvider}` : selectedAvatar ? 'No AI attached' : 'Default preview avatar'}
              </span>
              {!selectedAvatar ? (
                <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-amber-100">
                  Add this default to your library in Manage before chatting
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
              thinkingItems={thinkingItems}
              expressionItems={expressionItems}
              selectedIdleId={selectedIdleId}
              selectedActionId={selectedActionId}
              selectedThinkingId={selectedThinkingId}
              selectedExpressionId={selectedExpressionId}
              onIdleSelect={setSelectedIdleId}
              onActionSelect={setSelectedActionId}
              onThinkingSelect={setSelectedThinkingId}
              onExpressionSelect={setSelectedExpressionId}
              onSetIdle={() => selectedIdle && assetToFile(selectedIdle).then((file) => file && setIdleAnimation(file, selectedIdle.label, { cacheKey: selectedIdle.id }))}
              onPlayAction={handlePlayAction}
              onPlayThinking={handlePlayThinking}
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
