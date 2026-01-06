import { Router, Route, useNavigate } from '@solidjs/router'
import { Show, createEffect } from 'solid-js'
import type { JSX } from 'solid-js'
import { AuthProvider, useAuth } from './lib/auth'
import { ThemeProvider } from './lib/theme'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import SiteDetail from './components/SiteDetail'
import InviteAccept from './components/InviteAccept'
import WorkspaceRedirect from './components/WorkspaceRedirect'

function LoadingScreen() {
  return (
    <div class="flex min-h-screen items-center justify-center bg-[var(--bg)] transition-theme">
      <div class="flex flex-col items-center gap-6">
        <div class="relative">
          <div class="h-12 w-12 rounded-full bg-[var(--text)]" />
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="h-5 w-5 rounded-full bg-[var(--bg)]" />
          </div>
        </div>
        <div class="h-5 w-5 animate-spin rounded-full border-2 border-[var(--text)] border-t-transparent" />
      </div>
    </div>
  )
}

function ProtectedRoute(props: { children: JSX.Element }) {
  const auth = useAuth()
  const navigate = useNavigate()

  createEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      navigate('/login', { replace: true })
    }
  })

  return (
    <Show when={!auth.isLoading} fallback={<LoadingScreen />}>
      <Show when={auth.isAuthenticated}>
        {props.children}
      </Show>
    </Show>
  )
}

function PublicRoute(props: { children: JSX.Element }) {
  const auth = useAuth()
  const navigate = useNavigate()

  createEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      // Check for return URL in query params - if present, navigate there instead of /
      const params = new URLSearchParams(window.location.search)
      const returnUrl = params.get('return')
      if (returnUrl) {
        navigate(decodeURIComponent(returnUrl), { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    }
  })

  return (
    <Show when={!auth.isLoading} fallback={<LoadingScreen />}>
      {props.children}
    </Show>
  )
}

function ProtectedLogin() {
  return (
    <PublicRoute>
      <Login />
    </PublicRoute>
  )
}

function ProtectedDashboard() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  )
}

function ProtectedSiteDetail() {
  return (
    <ProtectedRoute>
      <SiteDetail />
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <Router
        root={(props) => (
          <AuthProvider>
            {props.children}
          </AuthProvider>
        )}
      >
        <Route path="/login" component={ProtectedLogin} />
        <Route path="/invite/:token" component={InviteAccept} />
        <Route path="/" component={ProtectedDashboard} />
        <Route path="/sites/:siteId" component={ProtectedSiteDetail} />
        <Route path="/:slug" component={WorkspaceRedirect} />
      </Router>
    </ThemeProvider>
  )
}
