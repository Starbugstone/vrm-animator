export function createAvatarPresenceState() {
  return {
    requestId: 0,
    mode: 'idle',
    responseVisible: false,
    responseComplete: false,
    speechActive: false,
  }
}

function isCurrentRequest(state, requestId) {
  return Number(requestId) > 0 && Number(requestId) === Number(state.requestId)
}

export function reduceAvatarPresence(state, event) {
  const current = state || createAvatarPresenceState()
  const type = String(event?.type || '').trim().toLowerCase()
  const requestId = Number(event?.requestId) || 0

  switch (type) {
    case 'reset':
      return createAvatarPresenceState()

    case 'user_message_submitted':
      return {
        requestId,
        mode: 'thinking',
        responseVisible: false,
        responseComplete: false,
        speechActive: false,
      }

    case 'provider_waiting':
      if (!isCurrentRequest(current, requestId)) {
        return current
      }

      return {
        ...current,
        mode: current.speechActive ? 'speaking' : 'thinking',
      }

    case 'assistant_text_visible':
      if (!isCurrentRequest(current, requestId)) {
        return current
      }

      return {
        ...current,
        responseVisible: true,
        mode: current.speechActive ? 'speaking' : 'responding',
      }

    case 'speech_started':
      if (!isCurrentRequest(current, requestId)) {
        return current
      }

      return {
        ...current,
        speechActive: true,
        mode: 'speaking',
      }

    case 'speech_stopped':
      if (!isCurrentRequest(current, requestId)) {
        return current
      }

      return {
        ...current,
        speechActive: false,
        mode: current.responseComplete
          ? 'idle'
          : current.responseVisible
            ? 'responding'
            : 'thinking',
      }

    case 'response_finished':
      if (!isCurrentRequest(current, requestId)) {
        return current
      }

      return {
        ...current,
        responseComplete: true,
        mode: current.speechActive ? 'speaking' : 'idle',
      }

    case 'response_failed':
      if (!isCurrentRequest(current, requestId)) {
        return current
      }

      return createAvatarPresenceState()

    default:
      return current
  }
}
