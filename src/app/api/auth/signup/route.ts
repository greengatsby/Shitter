import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { ROLES } from '@/utils/constants';
import { sanitizePhoneNumberClient } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { email, password, full_name, phone_number, organization_name, organization_slug } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Validate phone number format if provided
    if (phone_number) {
      const phoneRegex = /^\+?[\d\s\-\(\)]+$/
      if (!phoneRegex.test(phone_number)) {
        return NextResponse.json(
          { error: 'Invalid phone number format' },
          { status: 400 }
        )
      }
    }

    // Track cookies that need to be set in response
    const cookiesToSet: Array<{ name: string; value: string; options: any }> = []

    // Create server-side Supabase client for auth with proper cookie handling
    const supabase = createServerSupabaseClient()

    // Sign up user with auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          phone_number
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
      }
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Failed to create user' },
        { status: 400 }
      )
    }


    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: authData.user.email!,
        full_name,
        phone_number: sanitizePhoneNumberClient(phone_number),
        role: ROLES.ORG_OWNER
      })

    if (profileError) {
      console.error('Error creating user profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to create user profile' },
        { status: 500 }
      )
    }

    // If organization details provided, create organization
    let organizationData = null
    if (organization_name && organization_slug && authData.user) {
      const { data: orgId, error: orgError } = await supabase.rpc('create_organization_with_owner', {
        org_name: organization_name,
        org_slug: organization_slug,
        owner_auth_user_id: authData.user.id
      })

      if (orgError) {
        console.error('Error creating organization:', orgError)
        // Don't fail the signup if organization creation fails
      } else {
        // The RPC function now returns the organization_id and updates the users table
        // We can fetch the organization data if needed
        const { data: orgData, error: fetchError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .single()
        
        if (!fetchError && orgData) {
          organizationData = orgData
        }
      }
    }

    // Determine response based on whether user needs email confirmation
    const needsEmailConfirmation = !authData.session && authData.user && !authData.user.email_confirmed_at

    // Create response
    const response = NextResponse.json({
      user: authData.user,
      session: authData.session,
      organization: organizationData,
      needsEmailConfirmation,
      message: needsEmailConfirmation 
        ? 'Account created successfully! Please check your email to confirm your account before signing in.'
        : 'Account created and signed in successfully!'
    })

    // Set all cookies that Supabase wants to set
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, {
        ...options,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      })
    })

    return response
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
} 