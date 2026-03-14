import { apiRequest } from './client'

export function fetchAvatarMemory(token, avatarId) {
  return apiRequest(`/api/avatars/${avatarId}/memory`, { token })
}

export function updateAvatarMemory(token, avatarId, payload) {
  return apiRequest(`/api/avatars/${avatarId}/memory`, {
    method: 'PATCH',
    token,
    json: payload,
  })
}

export function resetAvatarMemory(token, avatarId) {
  return apiRequest(`/api/avatars/${avatarId}/memory/reset`, {
    method: 'POST',
    token,
  })
}

export function compressAvatarMemory(token, avatarId, payload) {
  return apiRequest(`/api/avatars/${avatarId}/memory/compress`, {
    method: 'POST',
    token,
    json: payload,
  })
}

export function fetchAvatarMemoryRevisions(token, avatarId) {
  return apiRequest(`/api/avatars/${avatarId}/memory/revisions`, { token })
}
