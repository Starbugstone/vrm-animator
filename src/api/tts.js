import { apiRequest, apiStreamRequest } from './client'

export function listTtsProviders(token) {
  return apiRequest('/api/tts/providers', { token }).then((data) => data.providers || [])
}

export function listTtsCredentials(token) {
  return apiRequest('/api/tts/credentials', { token }).then((data) => data.credentials || [])
}

export function createTtsCredential(token, payload) {
  return apiRequest('/api/tts/credentials', {
    method: 'POST',
    token,
    json: payload,
  })
}

export function updateTtsCredential(token, credentialId, payload) {
  return apiRequest(`/api/tts/credentials/${credentialId}`, {
    method: 'PATCH',
    token,
    json: payload,
  })
}

export function deleteTtsCredential(token, credentialId) {
  return apiRequest(`/api/tts/credentials/${credentialId}`, {
    method: 'DELETE',
    token,
  })
}

export function listTtsVoices(token, credentialId) {
  return apiRequest(`/api/tts/credentials/${credentialId}/voices`, {
    token,
  }).then((data) => data.voices || [])
}

export function listTtsVoiceLibrary(token, credentialId, query = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return
    }

    searchParams.set(key, String(value))
  })

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : ''

  return apiRequest(`/api/tts/credentials/${credentialId}/voice-library${suffix}`, {
    token,
  }).then((data) => ({
    voices: data.voices || [],
    nextPage: Number.isInteger(data.nextPage) ? data.nextPage : null,
  }))
}

export function addTtsVoiceLibraryVoice(token, credentialId, payload) {
  return apiRequest(`/api/tts/credentials/${credentialId}/voice-library/add`, {
    method: 'POST',
    token,
    json: payload,
  })
}

export function fetchAvatarTtsSettings(token, avatarId) {
  return apiRequest(`/api/avatars/${avatarId}/tts`, { token })
}

export function updateAvatarTtsSettings(token, avatarId, payload) {
  return apiRequest(`/api/avatars/${avatarId}/tts`, {
    method: 'PATCH',
    token,
    json: payload,
  })
}

export function streamAvatarTts(token, avatarId, payload, options = {}) {
  return apiStreamRequest(`/api/avatars/${avatarId}/tts/stream`, {
    method: 'POST',
    token,
    headers: {
      Accept: 'audio/mpeg',
    },
    json: payload,
    signal: options.signal,
  })
}
