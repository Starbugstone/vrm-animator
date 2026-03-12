let accessToken = ''
let refreshToken = ''
let refreshHandler = null
let logoutHandler = null
let refreshPromise = null

export function registerAuthHandlers({ refresh, logout }) {
  refreshHandler = refresh || null
  logoutHandler = logout || null
}

export function syncAuthSession({ token = '', refreshToken: nextRefreshToken = '' }) {
  accessToken = token || ''
  refreshToken = nextRefreshToken || ''
}

export function clearAuthSession() {
  syncAuthSession({})
}

export function getSessionAccessToken() {
  return accessToken
}

export async function refreshSessionAccessToken() {
  if (!refreshToken || !refreshHandler) {
    throw new Error('No refresh token is available.')
  }

  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    try {
      const response = await refreshHandler(refreshToken)

      accessToken = response?.token || ''
      refreshToken = response?.refreshToken || ''

      return accessToken
    } catch (error) {
      clearAuthSession()
      logoutHandler?.()
      throw error
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}
