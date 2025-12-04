import { createSignal, createContext, useContext, onMount, type JSX } from 'solid-js'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: () => Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>()

export function ThemeProvider(props: { children: JSX.Element }) {
  const [theme, setThemeSignal] = createSignal<Theme>('dark')

  onMount(() => {
    // Check localStorage first
    const saved = localStorage.getItem('theme') as Theme | null
    if (saved) {
      setThemeSignal(saved)
      applyTheme(saved)
      return
    }

    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initial = prefersDark ? 'dark' : 'light'
    setThemeSignal(initial)
    applyTheme(initial)

    // Listen for system changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        const newTheme = e.matches ? 'dark' : 'light'
        setThemeSignal(newTheme)
        applyTheme(newTheme)
      }
    })
  })

  const applyTheme = (t: Theme) => {
    if (t === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const setTheme = (t: Theme) => {
    setThemeSignal(t)
    localStorage.setItem('theme', t)
    applyTheme(t)
  }

  const toggleTheme = () => {
    const newTheme = theme() === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {props.children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
