'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const ThemeContext = createContext(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark'
    return localStorage.getItem('theme') || 'dark'
  })
  const [mounted, setMounted] = useState(false)
  const [devToolsVisible, setDevToolsVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('devToolsVisible') === 'true'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (devToolsVisible) document.documentElement.classList.add('dev-tools-visible')
    setMounted(true)
  }, [theme, devToolsVisible])

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('theme', next)
      document.documentElement.setAttribute('data-theme', next)
      return next
    })
  }, [])

  const setThemePref = useCallback((t) => {
    setTheme(t)
    localStorage.setItem('theme', t)
    document.documentElement.setAttribute('data-theme', t)
  }, [])

  const toggleDevTools = useCallback(() => {
    setDevToolsVisible(prev => {
      const next = !prev
      localStorage.setItem('devToolsVisible', next)
      document.documentElement.classList.toggle('dev-tools-visible', next)
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, mounted, devToolsVisible, toggleTheme, setThemePref, toggleDevTools }}>
      {children}
    </ThemeContext.Provider>
  )
}
