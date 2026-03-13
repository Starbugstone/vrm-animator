import { useEffect, useState } from 'react'
import AuthScreen from './components/AuthScreen.jsx'
import ManagePage from './components/ManagePage.jsx'
import ViewerPage from './components/ViewerPage.jsx'
import useAuth from './hooks/useAuth.js'
import useWorkspace from './hooks/useWorkspace.js'

const DEFAULT_PAGE = 'viewer'

function readInitialPage() {
  if (typeof window === 'undefined') return DEFAULT_PAGE

  const storedPage = window.localStorage.getItem('workspace.activePage')
  return storedPage === 'manage' ? 'manage' : DEFAULT_PAGE
}

function LoadingStage({ title, detail }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#18355c_0%,_#08111f_36%,_#04070d_100%)] px-4 text-white">
      <div className="w-full max-w-md rounded-[32px] border border-cyan-300/16 bg-[rgba(6,10,20,0.82)] p-8 text-center shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10">
          <div className="h-10 w-10 rounded-full border-2 border-cyan-100/20 border-t-cyan-100 animate-spin" />
        </div>
        <div className="mt-5 text-xs uppercase tracking-[0.34em] text-cyan-200/70">Loading</div>
        <div className="mt-3 text-2xl font-semibold tracking-tight">{title}</div>
        <div className="mt-3 text-sm leading-6 text-white/62">{detail}</div>
      </div>
    </div>
  )
}

export default function App() {
  const auth = useAuth()
  const [busy, setBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [activePage, setActivePage] = useState(readInitialPage)
  const workspace = useWorkspace(auth.token)

  useEffect(() => {
    window.localStorage.setItem('workspace.activePage', activePage)
  }, [activePage])

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

  if (auth.token && auth.isLoading && !auth.user) {
    return (
      <LoadingStage
        title="Restoring your session"
        detail="Reconnecting to your account and workspace after refresh."
      />
    )
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

  const commonPageProps = {
    user: auth.user,
    workspace: {
      ...workspace,
      token: auth.token,
    },
  }

  return (
    <div className="min-h-screen bg-[#04070d]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[rgba(3,7,18,0.92)] backdrop-blur">
        <div className="mx-auto flex max-w-[1680px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div>
            <div className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">VRM Animator</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight text-white">Avatar workspace</div>
            <div className="mt-2 text-sm text-white/58">Manage setup in one tab, then run and chat in Viewer.</div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setActivePage('viewer')}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  activePage === 'viewer'
                    ? 'bg-cyan-300/18 text-cyan-100'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                Viewer
              </button>
              <button
                type="button"
                onClick={() => setActivePage('manage')}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  activePage === 'manage'
                    ? 'bg-cyan-300/18 text-cyan-100'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                Manage
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right text-sm text-white/60">
                <div>{auth.user?.displayName || auth.user?.email}</div>
                <div className="text-xs text-white/42">{auth.user?.email}</div>
              </div>
              <button
                type="button"
                onClick={auth.logout}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:border-cyan-300/30 hover:bg-white/10"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {workspace.isBootstrapping ? (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-end justify-center p-6">
          <div className="inline-flex items-center gap-3 rounded-full border border-cyan-300/20 bg-[rgba(6,10,20,0.86)] px-5 py-3 text-sm text-cyan-100 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur">
            <span className="h-5 w-5 rounded-full border-2 border-cyan-100/20 border-t-cyan-100 animate-spin" />
            Syncing data from the backend...
          </div>
        </div>
      ) : null}

      {activePage === 'manage' ? <ManagePage {...commonPageProps} /> : <ViewerPage {...commonPageProps} />}
    </div>
  )
}
