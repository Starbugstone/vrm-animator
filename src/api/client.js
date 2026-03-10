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

export async function apiRequest(path, options = {}) {
  const { token, headers = {}, json, body, ...rest } = options

  const requestHeaders = new Headers(headers)
  if (!requestHeaders.has('Accept')) {
    requestHeaders.set('Accept', 'application/json')
  }
  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`)
  }

  let requestBody = body
  if (json !== undefined) {
    requestHeaders.set('Content-Type', 'application/json')
    requestBody = JSON.stringify(json)
  }

  const response = await fetch(buildApiUrl(path), {
    ...rest,
    headers: requestHeaders,
    body: requestBody,
  })

  const contentType = response.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json') || contentType.includes('application/ld+json')
  const data = isJson ? await response.json() : await response.text()

  if (!response.ok) {
    const message =
      (typeof data === 'object' && data?.message) ||
      (typeof data === 'object' && data?.detail) ||
      `Request failed with status ${response.status}`

    throw new ApiError(message, response.status, data)
  }

  return data
}

export async function downloadFile(path, token, fallbackName) {
  const response = await fetch(buildApiUrl(path), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new ApiError(`Download failed with status ${response.status}`, response.status)
  }

  const blob = await response.blob()
  const contentDisposition = response.headers.get('content-disposition') || ''
  const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
  const filename = filenameMatch?.[1] || fallbackName

  return new File([blob], filename, { type: blob.type || 'application/octet-stream' })
}
