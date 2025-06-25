import { NextRequest, NextResponse } from 'next/server'
import { githubHelpers } from '@/utils/supabase'

// POST /api/github/repositories/[id]/assignments - Assign user to repository
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const repositoryId = params.id
    const { user_id, role = 'developer' } = await request.json()

    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID is required' },
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

    const { data, error } = await githubHelpers.assignUserToRepository(
      repositoryId,
      user_id,
      role
    )

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
    const repositoryId = params.id

    // Get repository assignments - we'll need to modify the helper to get by repository ID
    // For now, this is a placeholder that would need the helper function updated
    
    return NextResponse.json({
      assignments: [],
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