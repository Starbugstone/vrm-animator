import { useState } from 'react'
import AuthScreen from './components/AuthScreen.jsx'
import useAuth from './hooks/useAuth.js'
import WaifuHologramPage from '../waifu_hologram_webpage.jsx'

export default function App() {
  const auth = useAuth()
  const [busy, setBusy] = useState(false)
  const [authError, setAuthError] = useState('')

  async function runAuthAction(action) {
    setBusy(true)
    setAuthError('')

    try {
      await action()
    } catch (error) {
      setAuthError(error.message || 'Authentication failed.')
    } finally {
      setBusy(false)
    }
  }

  if (!auth.isAuthenticated) {
    return (
      <AuthScreen
        busy={busy || auth.isLoading}
        error={authError || auth.error}
        onLogin={(payload) => runAuthAction(() => auth.login(payload))}
        onRegister={(payload) => runAuthAction(() => auth.register(payload))}
        onGoogleLogin={(credential) => runAuthAction(() => auth.googleLogin(credential))}
      />
    )
  }

  return (
    <WaifuHologramPage
      token={auth.token}
      user={auth.user}
      onLogout={auth.logout}
    />
  )
}
