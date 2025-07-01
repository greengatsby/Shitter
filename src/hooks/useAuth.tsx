import { useState, useEffect } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/utils/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          setAuthState(prev => ({ ...prev, error: error.message, loading: false }))
          return
        }

        setAuthState({
          user: session?.user ?? null,
          session: session,
          loading: false,
          error: null
        })
      } catch (err) {
        console.error('Error in getInitialSession:', err)
        setAuthState(prev => ({ 
          ...prev, 
          error: err instanceof Error ? err.message : 'Unknown error', 
          loading: false 
        }))
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)
        
        setAuthState({
          user: session?.user ?? null,
          session: session,
          loading: false,
          error: null
        })

        // Redirect logic based on auth state
        if (event === 'SIGNED_IN') {
          console.log('✅ User signed in:', session?.user?.email)
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 User signed out')
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Auth helper functions
  const signIn = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      // Use your API route for sign in
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Sign in failed')
      }

      // The auth state will be updated automatically by the listener
      return { success: true, data }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign in failed'
      setAuthState(prev => ({ ...prev, error: errorMessage, loading: false }))
      return { success: false, error: errorMessage }
    }
  }

  const signOut = async () => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      // Clear any additional state if needed
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign out failed'
      setAuthState(prev => ({ ...prev, error: errorMessage, loading: false }))
      return { success: false, error: errorMessage }
    }
  }

  const refreshSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession()
      if (error) throw error
      
      return { success: true, session }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Session refresh failed'
      setAuthState(prev => ({ ...prev, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }

  return {
    // State
    user: authState.user,
    session: authState.session,
    loading: authState.loading,
    error: authState.error,
    
    // Helper booleans
    isAuthenticated: !!authState.user,
    isLoading: authState.loading,
    
    // Methods
    signIn,
    signOut,
    refreshSession,
    
    // Direct Supabase client access if needed
    supabase
  }
} 