import { NextRequest, NextResponse } from 'next/server'
import { githubHelpers } from '@/utils/supabase'

// GET /api/organizations/[id]/repositories - Get repositories for an organization from our database
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const organizationId = params.id

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    console.log(`📋 Fetching repositories from database for organization: ${organizationId}`)

    // Get repositories for the organization from our database
    const { data: repositories, error } = await githubHelpers.getRepositoriesFromDatabase(organizationId)

    if (error) {
      console.error('❌ Error fetching organization repositories from database:', error)
      return NextResponse.json(
        { error: 'Failed to fetch repositories from database' },
        { status: 500 }
      )
    }

    console.log(`✅ Found ${repositories?.length || 0} repositories in database for organization ${organizationId}`)

    return NextResponse.json({
      repositories: repositories || [],
      count: repositories?.length || 0,
      message: `Found ${repositories?.length || 0} repositories in database`
    })
  } catch (error) {
    console.error('💥 Organization repositories error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred while fetching repositories' },
      { status: 500 }
    )
  }
} 