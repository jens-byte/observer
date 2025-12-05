import { createEffect, createSignal, Show } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { workspaces } from '../lib/api'
import { useAuth } from '../lib/auth'

export default function WorkspaceRedirect() {
  const params = useParams()
  const navigate = useNavigate()
  const auth = useAuth()
  const [error, setError] = createSignal('')
  const [hasAttempted, setHasAttempted] = createSignal(false)

  createEffect(async () => {
    // Wait for auth to finish loading
    if (auth.isLoading) return

    // Only attempt once
    if (hasAttempted()) return
    setHasAttempted(true)

    // If not authenticated, redirect to login
    if (!auth.isAuthenticated) {
      navigate('/login', { replace: true })
      return
    }

    try {
      // Try to get workspace by slug
      const workspace = await workspaces.getBySlug(params.slug)

      // Set as current workspace and go to dashboard
      auth.setCurrentWorkspace(workspace)
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    }
  })

  return (
    <div class="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4 transition-theme">
      <div class="w-full max-w-md">
        <div class="mb-8 text-center">
          <div class="mb-4 flex justify-center">
            <div class="relative">
              <div class="h-12 w-12 rounded-full bg-[var(--text)]" />
              <div class="absolute inset-0 flex items-center justify-center">
                <div class="h-5 w-5 rounded-full bg-[var(--bg)]" />
              </div>
            </div>
          </div>
          <h1 class="text-3xl font-bold text-[var(--text)]">Observer</h1>
        </div>

        <div class="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-6">
          <Show when={!error()}>
            <div class="flex flex-col items-center gap-4 py-8">
              <div class="h-8 w-8 animate-spin rounded-full border-2 border-[var(--text)] border-t-transparent" />
              <p class="text-[var(--text-secondary)]">Loading workspace...</p>
            </div>
          </Show>

          <Show when={error()}>
            <div class="text-center">
              <div class="mb-4 flex justify-center">
                <svg class="h-12 w-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 class="mb-2 text-xl font-semibold text-[var(--text)]">Workspace Not Found</h2>
              <p class="mb-6 text-[var(--text-secondary)]">{error()}</p>
              <a
                href="/"
                class="inline-block rounded-full border border-[var(--text)] px-4 py-2 font-medium text-[var(--text)] hover:bg-[var(--bg-hover)]"
              >
                Go to Dashboard
              </a>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}
