import { getSessionAccessToken, refreshSessionAccessToken } from './authSession'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

export function buildApiUrl(path) {
  return `${API_BASE_URL}${path}`
}

async function performFetch(path, options) {
  try {
    return await fetch(buildApiUrl(path), options)
  } catch (error) {
    throw new ApiError(`Network error while requesting ${path}`, 0, {
      cause: error?.message || 'Failed to fetch',
    })
  }
}

function applyAuthorizationHeader(headers, token) {
  const requestHeaders = new Headers(headers)

  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`)
  }

  return requestHeaders
}

async function fetchWithAuthRetry(path, options = {}, auth = {}) {
  const { token, skipAuthRefresh = false } = auth
  const initialToken = token || getSessionAccessToken()

  let response = await performFetch(path, {
    ...options,
    headers: applyAuthorizationHeader(options.headers, initialToken),
  })

  if (response.status !== 401 || !initialToken || skipAuthRefresh) {
    return response
  }

  const latestSessionToken = getSessionAccessToken()
  if (latestSessionToken && latestSessionToken !== initialToken) {
    response = await performFetch(path, {
      ...options,
      headers: applyAuthorizationHeader(options.headers, latestSessionToken),
    })

    if (response.status !== 401) {
      return response
    }
  }

  const refreshedToken = await refreshSessionAccessToken()

  return performFetch(path, {
    ...options,
    headers: applyAuthorizationHeader(options.headers, refreshedToken),
  })
}

function buildApiError(path, response, data) {
  const message =
    (typeof data === 'object' && data?.message) ||
    (typeof data === 'object' && data?.detail) ||
    `Request failed with status ${response.status}`

  return new ApiError(message, response.status, data)
}

export async function apiRequest(path, options = {}) {
  const { token, headers = {}, json, body, skipAuthRefresh = false, ...rest } = options

  const requestHeaders = new Headers(headers)
  if (!requestHeaders.has('Accept')) {
    requestHeaders.set('Accept', 'application/json')
  }

  let requestBody = body
  if (json !== undefined) {
    requestHeaders.set('Content-Type', 'application/json')
    requestBody = JSON.stringify(json)
  }

  const response = await fetchWithAuthRetry(
    path,
    {
      ...rest,
      headers: requestHeaders,
      body: requestBody,
    },
    { token, skipAuthRefresh },
  )

  const contentType = response.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json') || contentType.includes('application/ld+json')
  const data = isJson ? await response.json() : await response.text()

  if (!response.ok) {
    throw buildApiError(path, response, data)
  }

  return data
}

export async function downloadFile(path, token, fallbackName) {
  const response = await fetchWithAuthRetry(
    path,
    { headers: new Headers() },
    { token },
  )

  if (!response.ok) {
    throw new ApiError(`Download failed with status ${response.status}`, response.status)
  }

  const blob = await response.blob()
  const contentDisposition = response.headers.get('content-disposition') || ''
  const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
  const filename = filenameMatch?.[1] || fallbackName

  return new File([blob], filename, { type: blob.type || 'application/octet-stream' })
}
