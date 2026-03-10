import { apiRequest } from './client'

export function registerUser(payload) {
  return apiRequest('/api/register', {
    method: 'POST',
    json: payload,
  })
}

export function loginUser(payload) {
  return apiRequest('/api/login_check', {
    method: 'POST',
    json: payload,
  })
}

export function loginWithGoogle(idToken) {
  return apiRequest('/api/auth/google', {
    method: 'POST',
    json: { idToken },
  })
}

export function fetchCurrentUser(token) {
  return apiRequest('/api/me', {
    token,
  })
}

export function updateCurrentUser(token, payload) {
  return apiRequest('/api/me', {
    method: 'PATCH',
    token,
    json: payload,
  })
}
