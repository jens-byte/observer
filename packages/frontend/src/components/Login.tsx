import { createSignal, Show, onMount } from 'solid-js'
import { useNavigate, useSearchParams } from '@solidjs/router'
import { useAuth } from '../lib/auth'

export default function Login() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Check if we should show signup form (from invite link)
  const [isRegister, setIsRegister] = createSignal(searchParams.signup === 'true')
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [firstName, setFirstName] = createSignal('')
  const [lastName, setLastName] = createSignal('')
  const [error, setError] = createSignal('')
  const [isSubmitting, setIsSubmitting] = createSignal(false)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      if (isRegister()) {
        await auth.register(email(), password(), firstName(), lastName())
      } else {
        await auth.login(email(), password())
      }
      // Redirect to return URL if provided, otherwise home
      const returnUrl = searchParams.return ? decodeURIComponent(searchParams.return) : '/'
      navigate(returnUrl)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div class="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4 transition-theme">
      {/* Subtle gradient background */}
      <div class="pointer-events-none fixed inset-0 bg-gradient-to-b from-[var(--bg-secondary)] via-[var(--bg)] to-[var(--bg)]" />

      <div class="relative w-full max-w-sm">
        {/* Logo */}
        <div class="mb-12 text-center">
          <div class="mb-6 inline-flex items-center justify-center">
            <div class="relative">
              <div class="h-10 w-10 rounded-full bg-[var(--text)]" />
              <div class="absolute inset-0 flex items-center justify-center">
                <div class="h-4 w-4 rounded-full bg-[var(--bg)]" />
              </div>
            </div>
          </div>
          <h1 class="text-2xl font-medium tracking-tight text-[var(--text)]">
            {isRegister() ? 'Create your account' : 'Welcome back'}
          </h1>
        </div>

        {/* Form Card */}
        <div class="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/50 p-6 backdrop-blur-sm">
          <Show when={error()}>
            <div class="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error()}
            </div>
          </Show>

          <form onSubmit={handleSubmit} class="space-y-4">
            <Show when={isRegister()}>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="mb-2 block text-sm font-medium text-[var(--text-secondary)]">First Name</label>
                  <input
                    type="text"
                    value={firstName()}
                    onInput={(e) => setFirstName(e.currentTarget.value)}
                    class="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-4 py-3 text-[var(--text)] placeholder-[var(--text-tertiary)] transition-colors focus:border-[var(--accent)] focus:outline-none"
                    placeholder="First name"
                    required={isRegister()}
                  />
                </div>
                <div>
                  <label class="mb-2 block text-sm font-medium text-[var(--text-secondary)]">Last Name</label>
                  <input
                    type="text"
                    value={lastName()}
                    onInput={(e) => setLastName(e.currentTarget.value)}
                    class="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-4 py-3 text-[var(--text)] placeholder-[var(--text-tertiary)] transition-colors focus:border-[var(--accent)] focus:outline-none"
                    placeholder="Last name"
                    required={isRegister()}
                  />
                </div>
              </div>
            </Show>

            <div>
              <label class="mb-2 block text-sm font-medium text-[var(--text-secondary)]">Email</label>
              <input
                type="email"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                class="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-4 py-3 text-[var(--text)] placeholder-[var(--text-tertiary)] transition-colors focus:border-[var(--accent)] focus:outline-none"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label class="mb-2 block text-sm font-medium text-[var(--text-secondary)]">Password</label>
              <input
                type="password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                class="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-4 py-3 text-[var(--text)] placeholder-[var(--text-tertiary)] transition-colors focus:border-[var(--accent)] focus:outline-none"
                placeholder="Min 8 characters"
                required
                minLength={8}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting()}
              class="w-full rounded-full border border-[var(--text)] px-4 py-3 font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
            >
              {isSubmitting() ? 'Please wait...' : isRegister() ? 'Create Account' : 'Continue'}
            </button>
          </form>

          <div class="mt-6 text-center">
            <span class="text-sm text-[var(--text-tertiary)]">
              {isRegister() ? 'Already have an account?' : "Don't have an account?"}{' '}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister())
                setError('')
              }}
              class="text-sm text-[var(--accent)] hover:underline"
            >
              {isRegister() ? 'Sign in' : 'Sign up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
