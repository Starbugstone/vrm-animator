import { apiRequest } from './client'

export function listLlmProviders(token) {
  return apiRequest('/api/llm/providers', { token }).then((data) => data.providers || [])
}

export function listProviderModels(token, provider, options = {}) {
  const params = new URLSearchParams()
  if (options.search) params.set('search', options.search)
  if (provider === 'openrouter') {
    params.set('billing', options.billing || 'free')
  }

  const query = params.toString()

  return apiRequest(`/api/llm/providers/${provider}/models${query ? `?${query}` : ''}`, { token })
    .then((data) => data.models || [])
}

export function listLlmCredentials(token) {
  return apiRequest('/api/llm/credentials', { token }).then((data) => data.credentials || [])
}

export function createLlmCredential(token, payload) {
  return apiRequest('/api/llm/credentials', {
    method: 'POST',
    token,
    json: payload,
  })
}

export function updateLlmCredential(token, credentialId, payload) {
  return apiRequest(`/api/llm/credentials/${credentialId}`, {
    method: 'PATCH',
    token,
    json: payload,
  })
}

export function deleteLlmCredential(token, credentialId) {
  return apiRequest(`/api/llm/credentials/${credentialId}`, {
    method: 'DELETE',
    token,
  })
}
