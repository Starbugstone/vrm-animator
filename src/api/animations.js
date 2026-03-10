import { apiRequest, downloadFile } from './client'

export function listAnimations(token) {
  return apiRequest('/api/animations', { token }).then((data) => data['hydra:member'] || data)
}

export function uploadAnimation(token, formData) {
  return apiRequest('/api/animations/upload', {
    method: 'POST',
    token,
    body: formData,
  })
}

export function updateAnimation(token, animationId, payload) {
  return apiRequest(`/api/animations/${animationId}`, {
    method: 'PATCH',
    token,
    headers: {
      'Content-Type': 'application/merge-patch+json',
    },
    body: JSON.stringify(payload),
  })
}

export function downloadAnimationFile(token, animationId, fallbackName) {
  return downloadFile(`/api/animations/${animationId}/file`, token, fallbackName)
}
