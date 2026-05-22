import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, isConfigured } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  role: 'admin' | 'staff'
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<'admin' | 'staff'>('staff')
  const [isLoading, setIsLoading] = useState(isConfigured) // only load if Supabase configured

  async function fetchRole(userId: string) {
    if (!isConfigured) return
    try {
      const { data } = await (supabase as any)
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()
      if (data?.role === 'admin') setRole('admin')
      else setRole('staff')
    } catch {
      setRole('staff')
    }
  }

  useEffect(() => {
    if (!isConfigured) {
      setIsLoading(false)
      return
    }

    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchRole(session.user.id)
      setIsLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchRole(session.user.id)
      else setRole('staff')
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  function signOut() {
    if (isConfigured) supabase.auth.signOut()
    setUser(null)
    setRole('staff')
  }

  return (
    <AuthContext.Provider value={{ user, role, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
