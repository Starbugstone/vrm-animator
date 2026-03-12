import { apiRequest, apiStreamRequest } from './client'

export function listAvatarConversations(token, avatarId) {
  return apiRequest(`/api/avatars/${avatarId}/conversations`, { token }).then((data) => data.conversations || [])
}

export function listConversationMessages(token, conversationId) {
  return apiRequest(`/api/conversations/${conversationId}/messages`, { token }).then((data) => data.messages || [])
}

export function sendAvatarChatMessage(token, avatarId, payload) {
  return apiRequest(`/api/avatars/${avatarId}/chat`, {
    method: 'POST',
    token,
    json: payload,
  })
}

function parseSseBlock(block) {
  const lines = block.split('\n')
  let event = 'message'
  const dataLines = []

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
      continue
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
    }
  }

  const dataText = dataLines.join('\n')
  const data = dataText ? JSON.parse(dataText) : null

  return { event, data }
}

function dispatchStreamBlock(block, handlers, setCompletionPayload) {
  const trimmedBlock = block.trim()
  if (!trimmedBlock) return

  const parsed = parseSseBlock(trimmedBlock)

  if (parsed.event === 'conversation') {
    handlers.onConversation?.(parsed.data)
  } else if (parsed.event === 'text.delta') {
    handlers.onTextDelta?.(parsed.data)
  } else if (parsed.event === 'cue') {
    handlers.onCue?.(parsed.data)
  } else if (parsed.event === 'memory') {
    handlers.onMemory?.(parsed.data)
  } else if (parsed.event === 'message.complete') {
    setCompletionPayload(parsed.data)
    handlers.onComplete?.(parsed.data)
  } else if (parsed.event === 'error') {
    const message = parsed.data?.message || 'Streaming chat failed.'
    handlers.onError?.(parsed.data)
    throw new Error(message)
  }
}

export async function streamAvatarChatMessage(token, avatarId, payload, handlers = {}) {
  const response = await apiStreamRequest(`/api/avatars/${avatarId}/chat`, {
    method: 'POST',
    token,
    json: {
      ...payload,
      stream: true,
    },
  })

  if (!response.body) {
    throw new Error('Streaming is not available in this browser.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let completionPayload = null

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })

    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() || ''

    for (const block of blocks) {
      dispatchStreamBlock(block, handlers, (payload) => {
        completionPayload = payload
      })
    }

    if (done) {
      break
    }
  }

  if (buffer.trim()) {
    dispatchStreamBlock(buffer, handlers, (payload) => {
      completionPayload = payload
    })
  }

  return completionPayload
}
