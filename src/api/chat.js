import { apiRequest } from './client'

export function listAvatarConversations(token, avatarId) {
  return apiRequest(`/api/avatars/${avatarId}/conversations`, { token }).then((data) => data.conversations || [])
}

export function fetchConversation(token, conversationId) {
  return apiRequest(`/api/conversations/${conversationId}`, { token })
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
