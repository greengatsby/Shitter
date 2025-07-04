import { NextRequest, NextResponse } from 'next/server'
import { githubHelpers } from '@/utils/supabase'
import { createServerSupabaseClient } from '@/utils/supabase/server'

let CHECK_AUTH = true;

// POST /api/github/repositories/[id]/assignments - Assign user to repository
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    
    const repositoryId = params.id
    const { client_id, role = 'developer', current_auth_user_id } = await request.json()

    let userId = ""

    // Get current user from auth
    if (CHECK_AUTH) {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
      userId = user.id
    }

    if (!client_id) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      )
    }

    // Validate role
    const validRoles = ['developer', 'reviewer', 'admin']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Role must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      )
    }

    // Assign user to repository directly using the server supabase client
    const { data, error } = await supabase
      .from('user_repository_assignments')
      .upsert({
        repository_id: repositoryId,
        client_id: client_id,
        assigned_by: userId,
        role: role,
        permissions: ['read', 'write'] // Default permissions
      }, {
        onConflict: 'client_id,repository_id',
        ignoreDuplicates: false
      })
      .select()

    if (error) {
      if (error.message.includes('duplicate key value')) {
        return NextResponse.json(
          { error: 'User is already assigned to this repository' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      assignment: data,
      message: 'User assigned to repository successfully'
    })
  } catch (error) {
    console.error('Repository assignment error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// GET /api/github/repositories/[id]/assignments - Get repository assignments
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()

    const repositoryId = params.id

    // Get current user from auth
    let userId = ""

    if (CHECK_AUTH) {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
      userId = user.id
    }

    // Get repository assignments directly using the server supabase client
    const { data: assignments, error } = await supabase
      .from('user_repository_assignments')
      .select(`
        *,
        user:organization_clients!client_id(
          id,
          role,
          phone
        ),
        assigned_by_user:users!assigned_by(
          id,
          email,
          full_name
        )
      `)
      .eq('repository_id', repositoryId)
    
    if (error) {
      console.error('Error fetching repository assignments:', {
        error,
        repositoryId,
        userId: userId,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details
      })
      return NextResponse.json(
        { 
          error: 'Failed to fetch repository assignments',
          details: error.message,
          code: error.code
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      assignments: assignments || [],
      message: 'Repository assignments retrieved successfully'
    })
  } catch (error) {
    console.error('Get repository assignments error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// DELETE /api/github/repositories/[id]/assignments - Remove user assignment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()

    const repositoryId = params.id
    const { client_id } = await request.json()

    if (CHECK_AUTH) {
    // Get current user from auth
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
    }

    if (!client_id) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      )
    }

    // Remove user from repository directly using the server supabase client
    const { data, error } = await supabase
      .from('user_repository_assignments')
      .delete()
      .eq('repository_id', repositoryId)
      .eq('client_id', client_id)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      message: 'User removed from repository successfully'
    })
  } catch (error) {
    console.error('Repository assignment removal error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
} 