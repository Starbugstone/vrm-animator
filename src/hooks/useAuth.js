import { useCallback, useEffect, useState } from 'react'
import { fetchCurrentUser, loginUser, loginWithGoogle, registerUser, updateCurrentUser } from '../api/auth'

const TOKEN_STORAGE_KEY = 'vrm-animator-token'

export default function useAuth() {
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_STORAGE_KEY) || '')
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(Boolean(token))
  const [error, setError] = useState('')

  const applyAuthResponse = useCallback((response) => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, response.token)
    setToken(response.token)
    setUser(response.user)
    setError('')
  }, [])

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken('')
    setUser(null)
    setError('')
  }, [])

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
          setUser(currentUser)
          setError('')
        }
      } catch (err) {
        if (!cancelled) {
          logout()
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
