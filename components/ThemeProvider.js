'use client'
import { createContext, useContext, useCallback, useEffect, useSyncExternalStore } from 'react'

const ThemeContext = createContext(null)

const THEME_KEY = 'theme'
const DEVTOOLS_KEY = 'devToolsVisible'
const PREFS_EVENT = 'fsync-prefs-change'

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

// Preferences live in localStorage, which is an external store. Reading it
// through useSyncExternalStore keeps the server snapshot ('dark') for
// hydration and switches to the stored value afterwards, without setting
// state from an effect.
function subscribe(callback) {
  window.addEventListener('storage', callback)
  window.addEventListener(PREFS_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(PREFS_EVENT, callback)
  }
}

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'dark'
  } catch {
    return 'dark'
  }
}

function readDevToolsVisible() {
  try {
    return localStorage.getItem(DEVTOOLS_KEY) === 'true'
  } catch {
    return false
  }
}

function writePref(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable (private mode); the DOM still updates.
  }
  window.dispatchEvent(new Event(PREFS_EVENT))
}

const subscribeMounted = () => () => {}
const getMounted = () => true
const getMountedServer = () => false

export default function ThemeProvider({ children }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'dark')
  const devToolsVisible = useSyncExternalStore(subscribe, readDevToolsVisible, () => false)
  const mounted = useSyncExternalStore(subscribeMounted, getMounted, getMountedServer)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.classList.toggle('dev-tools-visible', devToolsVisible)
  }, [theme, devToolsVisible])

  const setThemePref = useCallback(t => {
    document.documentElement.setAttribute('data-theme', t)
    writePref(THEME_KEY, t)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemePref(readTheme() === 'dark' ? 'light' : 'dark')
  }, [setThemePref])

  const toggleDevTools = useCallback(() => {
    writePref(DEVTOOLS_KEY, String(!readDevToolsVisible()))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, mounted, devToolsVisible, toggleTheme, setThemePref, toggleDevTools }}>
      {children}
    </ThemeContext.Provider>
  )
}
