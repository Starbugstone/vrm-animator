import { useEffect, useRef, useState } from 'react'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

function GoogleButton({ onCredential, disabled }) {
  const buttonRef = useRef(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !buttonRef.current) return undefined

    const existingScript = document.querySelector('script[data-google-gsi]')
    const script =
      existingScript ||
      Object.assign(document.createElement('script'), {
        src: 'https://accounts.google.com/gsi/client',
        async: true,
        defer: true,
      })

    if (!existingScript) {
      script.setAttribute('data-google-gsi', 'true')
      document.body.appendChild(script)
    }

    const renderButton = () => {
      if (!window.google?.accounts?.id || !buttonRef.current) return

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          if (response.credential) {
            onCredential(response.credential)
          }
        },
      })

      buttonRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
      })
      setIsReady(true)
    }

    if (window.google?.accounts?.id) {
      renderButton()
      return undefined
    }

    script.addEventListener('load', renderButton)
    return () => script.removeEventListener('load', renderButton)
  }, [onCredential])

  if (!GOOGLE_CLIENT_ID) {
    return <div className="text-xs text-white/50">Google sign-in is disabled until `VITE_GOOGLE_CLIENT_ID` is set.</div>
  }

  return (
    <div className={disabled ? 'pointer-events-none opacity-60' : ''}>
      <div ref={buttonRef} />
      {!isReady ? <div className="mt-2 text-xs text-white/50">Loading Google sign-in…</div> : null}
    </div>
  )
}

export default function AuthScreen({ onLogin, onRegister, onGoogleLogin, busy, error }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()

    if (mode === 'register') {
      await onRegister({
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
      })
      return
    }

    await onLogin({
      username: email.trim(),
      password,
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#11214b_0%,_#071125_35%,_#030712_100%)] px-4 text-white">
      <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-black/30 p-8 shadow-2xl backdrop-blur">
        <div className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">VRM Animator</div>
        <h1 className="mt-3 text-3xl font-semibold">{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
        <p className="mt-3 text-sm leading-6 text-white/65">
          Use email/password or Google, then manage your private avatars, animations, and avatar memory.
        </p>

        <div className="mt-6 flex gap-2 rounded-2xl border border-white/10 bg-black/20 p-1">
          {['login', 'register'].map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setMode(entry)}
              className={`flex-1 rounded-2xl px-4 py-2 text-sm ${
                mode === entry ? 'bg-cyan-300/20 text-cyan-100' : 'text-white/65'
              }`}
            >
              {entry === 'login' ? 'Login' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === 'register' ? (
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Display name"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
            />
          ) : null}
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="Email"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="Password"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
          />
          {error ? <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-3 font-medium text-cyan-100 transition hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Working…' : mode === 'login' ? 'Login' : 'Register'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.24em] text-white/35">
          <div className="h-px flex-1 bg-white/10" />
          or
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <GoogleButton onCredential={onGoogleLogin} disabled={busy} />
      </div>
    </div>
  )
}
