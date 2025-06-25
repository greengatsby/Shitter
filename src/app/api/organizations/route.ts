import { NextRequest, NextResponse } from 'next/server'
import { organizationHelpers, createServerSupabaseClient } from '@/utils/supabase'

// GET /api/organizations - Get user's organizations
export async function GET(request: NextRequest) {
  try {
    // Debug: Log cookies
    console.log('Request cookies:', request.cookies.getAll())
    
    const supabase = createServerSupabaseClient(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    console.log('Auth result:', { user: user?.id, authError })

    if (authError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated', debug: { authError: authError?.message } },
        { status: 401 }
      )
    }

    console.log('About to query organization_members for user:', user.id)

    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        id,
        role,
        joined_at,
        organization_id
      `)
      .eq('user_id', user.id)

    console.log('Query result:', { 
      data, 
      error: error ? { message: error.message, details: error.details, hint: error.hint, code: error.code } : null, 
      userId: user.id 
    })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: error.message, details: error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      organizations: data || []
    })
  } catch (error) {
    console.error('Get organizations error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// POST /api/organizations - Create new organization
export async function POST(request: NextRequest) {
  try {
    const { name, slug } = await request.json()

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Organization name and slug are required' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    const { data, error } = await supabase.rpc('create_organization_with_owner', {
      org_name: name,
      org_slug: slug,
      owner_user_id: user.id
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      organization: data,
      message: 'Organization created successfully'
    })
  } catch (error) {
    console.error('Organization creation error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
} 