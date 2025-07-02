import { NextRequest, NextResponse } from 'next/server'
import { organizationHelpers } from '@/utils/supabase'
import { createServerSupabaseClient } from '@/utils/supabase-server'

// GET /api/organizations - Get user's organizations
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('Authentication failed:', {
        authError: authError?.message,
        hasUser: !!user,
        cookies: request.cookies.getAll().map(c => ({ name: c.name, hasValue: !!c.value }))
      })
      return NextResponse.json(
        { error: 'User not authenticated', debug: { authError: authError?.message } },
        { status: 401 }
      )
    }

    console.log('User authenticated successfully:', {
      userId: user.id,
      email: user.email,
      profileName: user.user_metadata?.full_name
    })

    // Verify user exists in our users table
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('User profile not found:', {
        userId: user.id,
        profileError: profileError?.message
      })
      return NextResponse.json(
        { error: 'User profile not found', debug: { profileError: profileError?.message } },
        { status: 404 }
      )
    }

    console.log('User profile found:', profile)

    // Get user's organizations using the server-side client (combined approach)
    const { data: organizations, error: orgsError } = await organizationHelpers.getUserOrganizationsCombined(supabase)

    if (orgsError) {
      console.error('Error fetching organizations:', orgsError)
      return NextResponse.json(
        { error: 'Failed to fetch organizations', debug: { orgsError: orgsError.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({ organizations })
  } catch (error) {
    console.error('Error fetching organizations:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: { message: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    )
  }
}

// POST /api/organizations - Create a new organization
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { name, slug } = body

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })
    }

    // Create organization using the server-side client
    const { data, error } = await organizationHelpers.createOrganization(name, slug, user.id, supabase)

    if (error) {
      console.error('Error creating organization:', error)
      return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 })
    }

    return NextResponse.json({ organization: data })
  } catch (error) {
    console.error('Error creating organization:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 