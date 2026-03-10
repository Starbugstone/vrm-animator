import { apiRequest, downloadFile } from './client'

export function listAvatars(token) {
  return apiRequest('/api/avatars', { token }).then((data) => data['hydra:member'] || data)
}

export function uploadAvatar(token, formData) {
  return apiRequest('/api/avatars/upload', {
    method: 'POST',
    token,
    body: formData,
  })
}

export function updateAvatar(token, avatarId, payload) {
  return apiRequest(`/api/avatars/${avatarId}`, {
    method: 'PATCH',
    token,
    headers: {
      'Content-Type': 'application/merge-patch+json',
    },
    body: JSON.stringify(payload),
  })
}

export function downloadAvatarFile(token, avatarId, fallbackName) {
  return downloadFile(`/api/avatars/${avatarId}/file`, token, fallbackName)
}
