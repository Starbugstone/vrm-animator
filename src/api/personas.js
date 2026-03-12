import { apiRequest } from './client'

export function listAvatarPersonas(token, avatarId) {
  return apiRequest(`/api/avatars/${avatarId}/personas`, { token }).then((data) => data.personas || [])
}

export function createAvatarPersona(token, avatarId, payload) {
  return apiRequest(`/api/avatars/${avatarId}/personas`, {
    method: 'POST',
    token,
    json: payload,
  })
}

export function updateAvatarPersona(token, personaId, payload) {
  return apiRequest(`/api/avatar-personas/${personaId}`, {
    method: 'PATCH',
    token,
    json: payload,
  })
}

export function deleteAvatarPersona(token, personaId) {
  return apiRequest(`/api/avatar-personas/${personaId}`, {
    method: 'DELETE',
    token,
  })
}
