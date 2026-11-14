'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { fetchUser, login as apiLogin, logout as apiLogout } from '@/lib/api'

const UserContext = createContext(null)

export function useUser() {
  return useContext(UserContext)
}

export default function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const fetched = await fetchUser()
    setUser(fetched)
    return fetched
  }, [])

  const login = useCallback(async (email, password) => {
    const fetched = await apiLogin(email, password)
    setUser(fetched)
    return fetched
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setUser(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchUser()
      .then(fetched => {
        if (!cancelled) setUser(fetched)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <UserContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </UserContext.Provider>
  )
}