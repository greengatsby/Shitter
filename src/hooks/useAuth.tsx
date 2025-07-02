import { useState, useEffect } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { authHelpers, supabase } from '@/utils/supabase'

interface UserProfile {
  id: string
  created_at: string
  updated_at: string
  email: string
  full_name: string | null
  phone_number: string | null
  avatar_url: string | null
  status: string | null
  phone_verified: boolean | null
  phone_verification_code: string | null
  phone_verification_expires_at: string | null
}

interface Organization {
  id: string
  created_at: string
  updated_at: string
  name: string
  slug: string
  description: string | null
}

interface OrganizationMember {
  id: string
  created_at: string
  updated_at: string
  organization_id: string
  user_id: string
  role: string | null
  invited_by: string | null
  invited_at: string | null
  joined_at: string | null
  organization: Organization
}

interface AuthState {
  user: User | null
  userProfile: UserProfile | null
  organizationMemberships: OrganizationMember[] | null
  session: Session | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    userProfile: null,
    organizationMemberships: null,
    session: null,
    loading: true,
    error: null
  })

  // Helper function to fetch user profile
  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
        return null
      }

      return profile
    } catch (err) {
      console.error('Exception fetching user profile:', err)
      return null
    }
  }

  // Helper function to fetch user's organization memberships
  const fetchOrganizationMemberships = async (userId: string): Promise<OrganizationMember[] | null> => {
    try {
      const { data: memberships, error } = await supabase
        .from('organization_members')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('user_id', userId)
        .order('joined_at', { ascending: false })

      if (error) {
        console.error('Error fetching organization memberships:', error)
        return null
      }

      return memberships
    } catch (err) {
      console.error('Exception fetching organization memberships:', err)
      return null
    }
  }

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

        let userProfile = null
        let organizationMemberships = null
        
        if (session?.user) {
          // Fetch both profile and organization memberships
          const [profileData, membershipData] = await Promise.all([
            fetchUserProfile(session.user.id),
            fetchOrganizationMemberships(session.user.id)
          ])
          
          userProfile = profileData
          organizationMemberships = membershipData
        }

        setAuthState({
          user: session?.user ?? null,
          userProfile: userProfile,
          organizationMemberships: organizationMemberships,
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
        
        let userProfile = null
        let organizationMemberships = null
        
        if (session?.user) {
          // Fetch both profile and organization memberships when user signs in
          const [profileData, membershipData] = await Promise.all([
            fetchUserProfile(session.user.id),
            fetchOrganizationMemberships(session.user.id)
          ])
          
          userProfile = profileData
          organizationMemberships = membershipData
        }

        setAuthState({
          user: session?.user ?? null,
          userProfile: userProfile,
          organizationMemberships: organizationMemberships,
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
      // Use server-side API authentication
      const { data, error } = await authHelpers.signIn(email, password)

      if (error) {
        throw error
      }

      // After server-side auth, refresh the client-side session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.warn('Warning: Could not get session after signin:', sessionError)
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

  const updateUserProfile = async (updates: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>) => {
    if (!authState.user) {
      return { success: false, error: 'User not authenticated' }
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', authState.user.id)
        .select()
        .single()

      if (error) throw error

      // Update local state
      setAuthState(prev => ({
        ...prev,
        userProfile: data
      }))

      return { success: true, data }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Profile update failed'
      return { success: false, error: errorMessage }
    }
  }

  const refreshOrganizationMemberships = async () => {
    if (!authState.user) {
      return { success: false, error: 'User not authenticated' }
    }

    try {
      const memberships = await fetchOrganizationMemberships(authState.user.id)
      
      setAuthState(prev => ({
        ...prev,
        organizationMemberships: memberships
      }))

      return { success: true, data: memberships }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh memberships'
      return { success: false, error: errorMessage }
    }
  }

  // Helper computed properties
  const primaryOrganization = authState.organizationMemberships?.[0] || null
  const organizations = authState.organizationMemberships?.map(m => m.organization) || []
  const isOrgAdmin = authState.organizationMemberships?.some(m => m.role === 'admin') || false
  const isOrgOwner = authState.organizationMemberships?.some(m => m.role === 'owner') || false
  const isOrgMember = authState.organizationMemberships?.some(m => m.role === 'member') || false

  return {
    // State
    user: authState.user,
    userProfile: authState.userProfile,
    organizationMemberships: authState.organizationMemberships,
    session: authState.session,
    loading: authState.loading,
    error: authState.error,
    
    // Helper booleans
    isAuthenticated: !!authState.user,
    isLoading: authState.loading,
    hasProfile: !!authState.userProfile,
    hasOrganizations: !!authState.organizationMemberships?.length,
    isOrgAdmin,
    isOrgOwner,
    isOrgMember,
    
    // Computed data
    primaryOrganization,
    organizations,
    
    // Methods
    signIn,
    signOut,
    refreshSession,
    updateUserProfile,
    refreshOrganizationMemberships,
    
    // Direct Supabase client access if needed
    supabase
  }
} 