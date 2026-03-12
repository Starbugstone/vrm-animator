import { useCallback, useEffect, useState } from 'react'
import { fetchCurrentUser, loginUser, loginWithGoogle, refreshAuthToken, registerUser, updateCurrentUser } from '../api/auth'
import { clearAuthSession, registerAuthHandlers, syncAuthSession } from '../api/authSession'

const TOKEN_STORAGE_KEY = 'vrm-animator-token'
const REFRESH_TOKEN_STORAGE_KEY = 'vrm-animator-refresh-token'
const USER_STORAGE_KEY = 'vrm-animator-user'

function readStoredUser() {
  try {
    const raw = window.localStorage.getItem(USER_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function useAuth() {
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_STORAGE_KEY) || '')
  const [refreshToken, setRefreshToken] = useState(() => window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) || '')
  const [user, setUser] = useState(() => readStoredUser())
  const [isLoading, setIsLoading] = useState(Boolean(token || refreshToken))
  const [error, setError] = useState('')

  const applyAuthResponse = useCallback((response) => {
    const nextRefreshToken = response.refreshToken || ''

    window.localStorage.setItem(TOKEN_STORAGE_KEY, response.token)
    if (nextRefreshToken) {
      window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, nextRefreshToken)
    } else {
      window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
    }

    if (response.user) {
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user))
    } else {
      window.localStorage.removeItem(USER_STORAGE_KEY)
    }

    setToken(response.token)
    setRefreshToken(nextRefreshToken)
    setUser(response.user)
    setError('')
    syncAuthSession({ token: response.token, refreshToken: nextRefreshToken })
  }, [])

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
    window.localStorage.removeItem(USER_STORAGE_KEY)
    setToken('')
    setRefreshToken('')
    setUser(null)
    setError('')
    clearAuthSession()
  }, [])

  useEffect(() => {
    registerAuthHandlers({
      refresh: async (currentRefreshToken) => {
        const response = await refreshAuthToken(currentRefreshToken)
        applyAuthResponse(response)
        return response
      },
      logout,
    })
  }, [applyAuthResponse, logout])

  useEffect(() => {
    syncAuthSession({ token, refreshToken })
  }, [refreshToken, token])

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function loadUser() {
      setIsLoading(true)
      try {
        const currentUser = await fetchCurrentUser(token)
        if (!cancelled) {
          window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser))
          setUser(currentUser)
          setError('')
        }
      } catch (err) {
        if (!cancelled) {
          if (err?.status === 401) {
            logout()
          }
          setError(err.message || 'Unable to load your account.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadUser()

    return () => {
      cancelled = true
    }
  }, [logout, token])

  const login = useCallback(async (payload) => {
    const response = await loginUser(payload)
    const normalized = {
      token: response.token,
      refreshToken: response.refreshToken,
      user: response.user ?? (await fetchCurrentUser(response.token)),
    }
    applyAuthResponse(normalized)
    return normalized
  }, [applyAuthResponse])

  const register = useCallback(async (payload) => {
    const response = await registerUser(payload)
    applyAuthResponse(response)
    return response
  }, [applyAuthResponse])

  const googleLogin = useCallback(async (idToken) => {
    const response = await loginWithGoogle(idToken)
    applyAuthResponse(response)
    return response
  }, [applyAuthResponse])

  const saveProfile = useCallback(async (payload) => {
    const updatedUser = await updateCurrentUser(token, payload)
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser))
    setUser(updatedUser)
    return updatedUser
  }, [token])

  return {
    token,
    user,
    isLoading,
    error,
    isAuthenticated: Boolean(token && user),
    login,
    register,
    googleLogin,
    logout,
    saveProfile,
  }
}
