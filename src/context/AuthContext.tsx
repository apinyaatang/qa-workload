import React, { createContext, useContext } from 'react'

interface AuthContextType {
  user: null
  role: 'admin'
  isLoading: false
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: 'admin',
  isLoading: false,
  signIn: async () => {},
  signOut: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={{ user: null, role: 'admin', isLoading: false, signIn: async () => {}, signOut: () => {} }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
