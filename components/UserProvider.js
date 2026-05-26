'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const UserContext = createContext(null)
const CACHE_KEY = 'fsync_user'

function restoreUser() {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function persistUser(user) {
  if (typeof window === 'undefined') return
  try {
    if (user) sessionStorage.setItem(CACHE_KEY, JSON.stringify(user))
    else sessionStorage.removeItem(CACHE_KEY)
  } catch {}
}

let cachedUser = restoreUser()

export function useUser() {
  return useContext(UserContext)
}

export default function UserProvider({ children }) {
  const [user, setUser] = useState(cachedUser)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user: fetched } }) => {
      cachedUser = fetched
      persistUser(fetched)
      setUser(fetched)
    })
  }, [])

  return (
    <UserContext.Provider value={user}>
      {children}
    </UserContext.Provider>
  )
}
