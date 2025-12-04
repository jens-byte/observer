import { createSignal, createContext, useContext, type JSX } from 'solid-js'
import type { User, WorkspaceWithRole } from '@observer/shared'
import { auth } from './api'

interface AuthState {
  user: User | null
  workspaces: WorkspaceWithRole[]
  currentWorkspace: WorkspaceWithRole | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
  setCurrentWorkspace: (workspace: WorkspaceWithRole) => void
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>()

export function AuthProvider(props: { children: JSX.Element }) {
  const [user, setUser] = createSignal<User | null>(null)
  const [workspaces, setWorkspaces] = createSignal<WorkspaceWithRole[]>([])
  const [currentWorkspace, setCurrentWorkspaceSignal] = createSignal<WorkspaceWithRole | null>(null)
  const [isLoading, setIsLoading] = createSignal(true)

  const refreshAuth = async () => {
    try {
      setIsLoading(true)
      const response = await auth.me()
      setUser(response.user)
      setWorkspaces(response.workspaces)

      // Set current workspace from localStorage or first workspace
      const savedWorkspaceId = localStorage.getItem('currentWorkspaceId')
      const saved = response.workspaces.find((w) => w.id === Number(savedWorkspaceId))
      setCurrentWorkspaceSignal(saved || response.workspaces[0] || null)
    } catch {
      setUser(null)
      setWorkspaces([])
      setCurrentWorkspaceSignal(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    const response = await auth.login({ email, password })
    setUser(response.user)
    setWorkspaces(response.workspaces)
    setCurrentWorkspaceSignal(response.workspaces[0] || null)
    if (response.workspaces[0]) {
      localStorage.setItem('currentWorkspaceId', String(response.workspaces[0].id))
    }
  }

  const register = async (email: string, password: string, name: string) => {
    const response = await auth.register({ email, password, name })
    setUser(response.user)
    setWorkspaces(response.workspaces)
    setCurrentWorkspaceSignal(response.workspaces[0] || null)
    if (response.workspaces[0]) {
      localStorage.setItem('currentWorkspaceId', String(response.workspaces[0].id))
    }
  }

  const logout = async () => {
    await auth.logout()
    setUser(null)
    setWorkspaces([])
    setCurrentWorkspaceSignal(null)
    localStorage.removeItem('currentWorkspaceId')
  }

  const setCurrentWorkspace = (workspace: WorkspaceWithRole) => {
    setCurrentWorkspaceSignal(workspace)
    localStorage.setItem('currentWorkspaceId', String(workspace.id))
  }

  // Initialize auth on mount
  refreshAuth()

  const value: AuthContextValue = {
    get user() {
      return user()
    },
    get workspaces() {
      return workspaces()
    },
    get currentWorkspace() {
      return currentWorkspace()
    },
    get isLoading() {
      return isLoading()
    },
    get isAuthenticated() {
      return !!user()
    },
    login,
    register,
    logout,
    setCurrentWorkspace,
    refreshAuth,
  }

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
