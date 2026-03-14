import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  deleteAnimation,
  listAnimations,
  updateAnimation,
  uploadAnimation,
} from '../api/animations.js'
import {
  deleteAvatar,
  listAvatars,
  updateAvatar,
  uploadAvatar,
} from '../api/avatars.js'
import {
  listAvatarConversations,
  listConversationMessages,
  sendAvatarChatMessage,
  streamAvatarChatMessage,
} from '../api/chat.js'
import {
  downloadSharedAssetFile,
  listSharedAnimationAssets,
  listSharedAvatarAssets,
} from '../api/library.js'
import {
  createLlmCredential,
  deleteLlmCredential,
  listLlmCredentials,
  listLlmProviders,
  listProviderModels,
  updateLlmCredential,
} from '../api/llmCredentials.js'
import {
  compressAvatarMemory,
  fetchAvatarMemory,
  fetchAvatarMemoryRevisions,
  resetAvatarMemory,
  updateAvatarMemory,
} from '../api/memory.js'
import {
  createAvatarPersona,
  deleteAvatarPersona,
  listAvatarPersonas,
  updateAvatarPersona,
} from '../api/personas.js'

const WORKSPACE_SELECTED_AVATAR_KEY = 'workspace.selectedAvatarId'

function upsertById(items, nextItem) {
  const index = items.findIndex((entry) => entry.id === nextItem.id)
  if (index === -1) {
    return [nextItem, ...items]
  }

  const nextItems = [...items]
  nextItems[index] = nextItem
  return nextItems
}

function removeById(items, id) {
  return items.filter((entry) => entry.id !== id)
}

function omitKey(record, key) {
  const next = { ...record }
  delete next[key]
  return next
}

function buildPersonaPayloadFromAvatar(avatar, llmCredentialId = null) {
  return {
    name: avatar?.name || 'Avatar',
    description: avatar?.backstory || '',
    personality: avatar?.personality || '',
    llmCredentialId,
    isPrimary: true,
  }
}

function readStoredSelectedAvatarId() {
  if (typeof window === 'undefined') return ''

  return window.localStorage.getItem(WORKSPACE_SELECTED_AVATAR_KEY) || ''
}

export default function useWorkspace(token) {
  const [avatars, setAvatars] = useState([])
  const [animations, setAnimations] = useState([])
  const [sharedAvatars, setSharedAvatars] = useState([])
  const [sharedAnimations, setSharedAnimations] = useState([])
  const [providers, setProviders] = useState([])
  const [credentials, setCredentials] = useState([])
  const [providerModels, setProviderModels] = useState({})
  const [personasByAvatar, setPersonasByAvatar] = useState({})
  const [memoryByAvatar, setMemoryByAvatar] = useState({})
  const [memoryRevisionsByAvatar, setMemoryRevisionsByAvatar] = useState({})
  const [conversationsByAvatar, setConversationsByAvatar] = useState({})
  const [messagesByConversation, setMessagesByConversation] = useState({})
  const [isBootstrapping, setIsBootstrapping] = useState(false)
  const [isModelsLoading, setIsModelsLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedAvatarId, setSelectedAvatarIdState] = useState(readStoredSelectedAvatarId)

  const setSelectedAvatarId = useCallback((avatarId) => {
    const nextValue = avatarId ? String(avatarId) : ''
    setSelectedAvatarIdState(nextValue)

    if (typeof window !== 'undefined') {
      if (nextValue) {
        window.localStorage.setItem(WORKSPACE_SELECTED_AVATAR_KEY, nextValue)
      } else {
        window.localStorage.removeItem(WORKSPACE_SELECTED_AVATAR_KEY)
      }
    }
  }, [])

  const resetWorkspace = useCallback(() => {
    setAvatars([])
    setAnimations([])
    setSharedAvatars([])
    setSharedAnimations([])
    setProviders([])
    setCredentials([])
    setProviderModels({})
    setPersonasByAvatar({})
    setMemoryByAvatar({})
    setMemoryRevisionsByAvatar({})
    setConversationsByAvatar({})
    setMessagesByConversation({})
    setError('')
    setIsBootstrapping(false)
    setIsModelsLoading(false)
    setSelectedAvatarId('')
  }, [setSelectedAvatarId])

  const refreshWorkspace = useCallback(async () => {
    if (!token) {
      resetWorkspace()
      return
    }

    setIsBootstrapping(true)
    setError('')

    try {
      const workspaceRequests = [
        { key: 'avatars', request: () => listAvatars(token) },
        { key: 'animations', request: () => listAnimations(token) },
        { key: 'shared avatars', request: () => listSharedAvatarAssets() },
        { key: 'shared animations', request: () => listSharedAnimationAssets() },
        { key: 'LLM providers', request: () => listLlmProviders(token) },
        { key: 'LLM credentials', request: () => listLlmCredentials(token) },
      ]

      const results = await Promise.allSettled(
        workspaceRequests.map(({ request }) => request()),
      )

      const [
        avatarsResult,
        animationsResult,
        sharedAvatarsResult,
        sharedAnimationsResult,
        providersResult,
        credentialsResult,
      ] = results

      setAvatars(avatarsResult.status === 'fulfilled' && Array.isArray(avatarsResult.value) ? avatarsResult.value : [])
      setAnimations(animationsResult.status === 'fulfilled' && Array.isArray(animationsResult.value) ? animationsResult.value : [])
      setSharedAvatars(sharedAvatarsResult.status === 'fulfilled' && Array.isArray(sharedAvatarsResult.value) ? sharedAvatarsResult.value : [])
      setSharedAnimations(sharedAnimationsResult.status === 'fulfilled' && Array.isArray(sharedAnimationsResult.value) ? sharedAnimationsResult.value : [])
      setProviders(providersResult.status === 'fulfilled' && Array.isArray(providersResult.value) ? providersResult.value : [])
      setCredentials(credentialsResult.status === 'fulfilled' && Array.isArray(credentialsResult.value) ? credentialsResult.value : [])

      const failures = results
        .map((result, index) => ({ result, key: workspaceRequests[index].key }))
        .filter(({ result }) => result.status === 'rejected')
        .map(({ result, key }) => {
          const reason = result.reason
          const message = reason?.message || 'Unknown workspace error'
          return `${key}: ${message}`
        })

      if (failures.length > 0) {
        setError(`Some workspace data could not be loaded: ${failures[0]}`)
      }
    } catch (nextError) {
      setError(nextError.message || 'Unable to load the workspace.')
    } finally {
      setIsBootstrapping(false)
    }
  }, [resetWorkspace, token])

  useEffect(() => {
    refreshWorkspace()
  }, [refreshWorkspace])

  useEffect(() => {
    if (avatars.length === 0) {
      if (selectedAvatarId) {
        setSelectedAvatarId('')
      }
      return
    }

    const hasSelectedAvatar = avatars.some((entry) => String(entry.id) === selectedAvatarId)
    if (!hasSelectedAvatar) {
      setSelectedAvatarId(String(avatars[0].id))
    }
  }, [avatars, selectedAvatarId, setSelectedAvatarId])

  const ensurePersonas = useCallback(async (avatarId, options = {}) => {
    if (!token || !avatarId) return []
    if (!options.force && personasByAvatar[avatarId]) {
      return personasByAvatar[avatarId]
    }

    const personas = await listAvatarPersonas(token, avatarId)
    setPersonasByAvatar((current) => ({ ...current, [avatarId]: Array.isArray(personas) ? personas : [] }))
    return Array.isArray(personas) ? personas : []
  }, [personasByAvatar, token])

  const ensureMemory = useCallback(async (avatarId, options = {}) => {
    if (!token || !avatarId) {
      return { memory: null, revisions: [] }
    }

    if (!options.force && memoryByAvatar[avatarId] && memoryRevisionsByAvatar[avatarId]) {
      return {
        memory: memoryByAvatar[avatarId],
        revisions: memoryRevisionsByAvatar[avatarId],
      }
    }

    const [memory, revisions] = await Promise.all([
      fetchAvatarMemory(token, avatarId),
      fetchAvatarMemoryRevisions(token, avatarId),
    ])

    setMemoryByAvatar((current) => ({ ...current, [avatarId]: memory }))
    setMemoryRevisionsByAvatar((current) => ({ ...current, [avatarId]: Array.isArray(revisions) ? revisions : [] }))

    return {
      memory,
      revisions: Array.isArray(revisions) ? revisions : [],
    }
  }, [memoryByAvatar, memoryRevisionsByAvatar, token])

  const ensureConversations = useCallback(async (avatarId, options = {}) => {
    if (!token || !avatarId) return []
    if (!options.force && conversationsByAvatar[avatarId]) {
      return conversationsByAvatar[avatarId]
    }

    const conversations = await listAvatarConversations(token, avatarId)
    setConversationsByAvatar((current) => ({ ...current, [avatarId]: Array.isArray(conversations) ? conversations : [] }))
    return Array.isArray(conversations) ? conversations : []
  }, [conversationsByAvatar, token])

  const ensureConversationMessages = useCallback(async (conversationId, options = {}) => {
    if (!token || !conversationId) return []
    if (!options.force && messagesByConversation[conversationId]) {
      return messagesByConversation[conversationId]
    }

    const messages = await listConversationMessages(token, conversationId)
    setMessagesByConversation((current) => ({ ...current, [conversationId]: Array.isArray(messages) ? messages : [] }))
    return Array.isArray(messages) ? messages : []
  }, [messagesByConversation, token])

  const saveAvatarUpload = useCallback(async (payload) => {
    const formData = new FormData()
    formData.append('file', payload.file)
    if (payload.name) formData.append('name', payload.name)
    if (payload.backstory) formData.append('backstory', payload.backstory)
    if (payload.personality) formData.append('personality', payload.personality)

    const avatar = await uploadAvatar(token, formData)
    setAvatars((current) => upsertById(current, avatar))
    setSelectedAvatarId(avatar.id)
    return avatar
  }, [setSelectedAvatarId, token])

  const saveAvatarIdentity = useCallback(async (avatarId, payload) => {
    const { llmCredentialId = null, ...avatarPayload } = payload
    const avatar = await updateAvatar(token, avatarId, avatarPayload)
    setAvatars((current) => upsertById(current, avatar))

    const existingPersonas = await listAvatarPersonas(token, avatarId)
    const primaryPersona = existingPersonas.find((entry) => entry.isPrimary) || existingPersonas[0] || null
    const personaPayload = buildPersonaPayloadFromAvatar(
      avatar,
      llmCredentialId !== null && llmCredentialId !== undefined && llmCredentialId !== ''
        ? Number(llmCredentialId)
        : null,
    )

    const persona = primaryPersona
      ? await updateAvatarPersona(token, primaryPersona.id, personaPayload)
      : await createAvatarPersona(token, avatarId, personaPayload)

    const redundantPersonas = existingPersonas.filter((entry) => entry.id !== persona.id)
    if (redundantPersonas.length > 0) {
      await Promise.all(redundantPersonas.map((entry) => deleteAvatarPersona(token, entry.id)))
    }

    setPersonasByAvatar((current) => ({ ...current, [avatarId]: [persona] }))
    return { avatar, persona }
  }, [token])

  const removeAvatar = useCallback(async (avatarId) => {
    await deleteAvatar(token, avatarId)
    setAvatars((current) => removeById(current, avatarId))
    if (String(avatarId) === selectedAvatarId) {
      setSelectedAvatarId('')
    }
    const removedConversationIds = (conversationsByAvatar[avatarId] || []).map((entry) => entry.id)

    setPersonasByAvatar((current) => omitKey(current, avatarId))
    setMemoryByAvatar((current) => omitKey(current, avatarId))
    setMemoryRevisionsByAvatar((current) => omitKey(current, avatarId))
    setConversationsByAvatar((current) => omitKey(current, avatarId))
    if (removedConversationIds.length > 0) {
      setMessagesByConversation((current) => {
        const next = { ...current }
        removedConversationIds.forEach((conversationId) => {
          delete next[conversationId]
        })
        return next
      })
    }
  }, [conversationsByAvatar, selectedAvatarId, setSelectedAvatarId, token])

  const saveAnimationUpload = useCallback(async (payload) => {
    const formData = new FormData()
    formData.append('file', payload.file)
    formData.append('kind', payload.kind)
    if (payload.avatarId) formData.append('avatarId', String(payload.avatarId))
    if (payload.name) formData.append('name', payload.name)
    if (payload.description) formData.append('description', payload.description)
    ;(payload.keywords || []).forEach((keyword) => formData.append('keywords[]', keyword))
    ;(payload.emotionTags || []).forEach((tag) => formData.append('emotionTags[]', tag))

    const animation = await uploadAnimation(token, formData)
    setAnimations((current) => upsertById(current, animation))
    return animation
  }, [token])

  const adoptSharedAvatar = useCallback(async (asset, overrides = {}) => {
    const file = await downloadSharedAssetFile(asset)
    return saveAvatarUpload({
      file,
      name: overrides.name || asset.label || asset.name,
      backstory: overrides.backstory ?? asset.backstory ?? asset.description ?? '',
      personality: overrides.personality ?? asset.personality ?? '',
    })
  }, [saveAvatarUpload])

  const saveAnimationMetadata = useCallback(async (animationId, payload) => {
    const animation = await updateAnimation(token, animationId, payload)
    setAnimations((current) => upsertById(current, animation))
    return animation
  }, [token])

  const removeAnimation = useCallback(async (animationId) => {
    await deleteAnimation(token, animationId)
    setAnimations((current) => removeById(current, animationId))
  }, [token])

  const saveMemory = useCallback(async (avatarId, payload) => {
    const memory = await updateAvatarMemory(token, avatarId, payload)
    const revisions = await fetchAvatarMemoryRevisions(token, avatarId)
    setMemoryByAvatar((current) => ({ ...current, [avatarId]: memory }))
    setMemoryRevisionsByAvatar((current) => ({ ...current, [avatarId]: Array.isArray(revisions) ? revisions : [] }))
    return memory
  }, [token])

  const resetMemory = useCallback(async (avatarId) => {
    const memory = await resetAvatarMemory(token, avatarId)
    const revisions = await fetchAvatarMemoryRevisions(token, avatarId)
    setMemoryByAvatar((current) => ({ ...current, [avatarId]: memory }))
    setMemoryRevisionsByAvatar((current) => ({ ...current, [avatarId]: Array.isArray(revisions) ? revisions : [] }))
    return memory
  }, [token])

  const compressMemory = useCallback(async (avatarId, payload) => {
    const memory = await compressAvatarMemory(token, avatarId, payload)
    const revisions = await fetchAvatarMemoryRevisions(token, avatarId)
    setMemoryByAvatar((current) => ({ ...current, [avatarId]: memory }))
    setMemoryRevisionsByAvatar((current) => ({ ...current, [avatarId]: Array.isArray(revisions) ? revisions : [] }))
    return memory
  }, [token])

  const loadProviderModelCatalog = useCallback(async (provider, options = {}) => {
    if (!token || !provider) {
      return []
    }

    setIsModelsLoading(true)
    try {
      const models = await listProviderModels(token, provider, options)
      const normalizedModels = Array.isArray(models) ? models : []

      setProviderModels((current) => ({
        ...current,
        [provider]: normalizedModels,
      }))

      return normalizedModels
    } finally {
      setIsModelsLoading(false)
    }
  }, [token])

  const loadOpenRouterCatalog = useCallback(async (options = {}) => (
    loadProviderModelCatalog('openrouter', options)
  ), [loadProviderModelCatalog])

  const saveCredential = useCallback(async (payload) => {
    const credential = payload.credentialId
      ? await updateLlmCredential(token, payload.credentialId, payload)
      : await createLlmCredential(token, payload)

    setCredentials((current) => upsertById(current, credential))
    return credential
  }, [token])

  const removeCredential = useCallback(async (credentialId) => {
    await deleteLlmCredential(token, credentialId)
    setCredentials((current) => removeById(current, credentialId))
  }, [token])

  const sendChatMessage = useCallback(async (avatarId, payload) => {
    const response = await sendAvatarChatMessage(token, avatarId, payload)
    const conversation = response.conversation

    setConversationsByAvatar((current) => ({
      ...current,
      [avatarId]: upsertById(current[avatarId] || [], conversation),
    }))
    setMessagesByConversation((current) => ({
      ...current,
      [conversation.id]: [...(current[conversation.id] || []), response.userMessage, response.assistantMessage],
    }))

    return response
  }, [token])

  const streamChatMessage = useCallback(async (avatarId, payload, handlers = {}) => {
    let latestConversation = null

    const completion = await streamAvatarChatMessage(token, avatarId, payload, {
      ...handlers,
      onConversation: (event) => {
        latestConversation = event?.conversation || null
        handlers.onConversation?.(event)
      },
      onComplete: (event) => {
        const conversation = event?.conversation
        const assistantMessage = event?.assistantMessage
        const userMessage = event?.userMessage || null

        if (conversation && userMessage && assistantMessage) {
          setConversationsByAvatar((current) => ({
            ...current,
            [avatarId]: upsertById(current[avatarId] || [], conversation),
          }))
          setMessagesByConversation((current) => ({
            ...current,
            [conversation.id]: [...(current[conversation.id] || []), userMessage, assistantMessage],
          }))
        }

        handlers.onComplete?.(event)
      },
    })

    if (completion?.conversation) {
      latestConversation = completion.conversation
    }

    return completion || { conversation: latestConversation }
  }, [token])

  const sharedAnimationGroups = useMemo(() => ({
    idle: sharedAnimations.filter((entry) => entry.kind === 'idle'),
    action: sharedAnimations.filter((entry) => entry.kind === 'action'),
    thinking: sharedAnimations.filter((entry) => entry.kind === 'thinking'),
    expression: sharedAnimations.filter((entry) => entry.kind === 'expression'),
  }), [sharedAnimations])

  return {
    avatars,
    selectedAvatarId,
    animations,
    sharedAvatars,
    sharedAnimations,
    sharedAnimationGroups,
    providers,
    credentials,
    providerModels,
    personasByAvatar,
    memoryByAvatar,
    memoryRevisionsByAvatar,
    conversationsByAvatar,
    messagesByConversation,
    isBootstrapping,
    isModelsLoading,
    error,
    refreshWorkspace,
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
    resetMemory,
    compressMemory,
    loadProviderModelCatalog,
    loadOpenRouterCatalog,
    saveCredential,
    removeCredential,
    sendChatMessage,
    streamChatMessage,
  }
}
