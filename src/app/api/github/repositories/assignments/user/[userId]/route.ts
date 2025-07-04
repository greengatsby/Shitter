import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/utils/supabase/server'

let CHECK_AUTH = true;

// GET /api/github/repositories/assignments/user/[userId] - Get repositories assigned to a specific user
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()

    const userId = params.userId

    let currentUserId = ""
    if (CHECK_AUTH) {
        // Get current user from auth
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
        return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
        )
        }
        currentUserId = user.id
    }
    console.log(`🔍 Fetching repository assignments for user ID: ${userId}`)

    // Get repositories assigned to the specific user
    const { data: assignments, error } = await supabase
      .from('user_repository_assignments')
      .select(`
        *,
        repository:github_repositories(
          *,
          installation:github_app_installations(
            account_login,
            account_type,
            account_avatar_url,
            installation_id,
            organization_id,
            is_active
          )
        )
      `)
      .eq('user_id', userId)
    
    if (error) {
      console.error('Error fetching user repository assignments:', {
        error,
        userId,
        currentUserId: currentUserId,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details
      })
      return NextResponse.json(
        { 
          error: 'Failed to fetch user repository assignments',
          details: error.message,
          code: error.code
        },
        { status: 500 }
      )
    }

    console.log(`📋 Raw assignments data:`, assignments)

    // Extract repositories from assignments and filter out any null repositories
    const repositories = (assignments || [])
      .map(assignment => assignment.repository)
      .filter(repo => repo !== null)

    console.log(`✅ Processed ${repositories.length} repositories for user`)

    return NextResponse.json({
      repositories: repositories,
      assignments: assignments || [],
      message: `Found ${repositories.length} repositories assigned to user`
    })
  } catch (error) {
    console.error('Get user repository assignments error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
} 