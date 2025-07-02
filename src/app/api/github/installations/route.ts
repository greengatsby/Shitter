import { NextRequest, NextResponse } from 'next/server'
import { githubHelpers } from '@/utils/supabase'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

// GET /api/github/installations - Get GitHub App installations for organization from our database
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organization_id')
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    console.log(`📋 Fetching GitHub installations from database for organization: ${organizationId}`)

    // Get GitHub App installations from our database
    const { data: installations, error: installationsError } = await githubHelpers.getInstallationsFromDatabase(organizationId)
    
    if (installationsError) {
      console.error('❌ Error fetching installations from database:', installationsError)
      return NextResponse.json(
        { error: 'Failed to fetch installations from database' },
        { status: 500 }
      )
    }

    console.log(`✅ Found ${installations?.length || 0} installations in database`)

    // Get repositories for all installations from our database
    const { data: repositories, error: repositoriesError } = await githubHelpers.getRepositoriesFromDatabase(organizationId)
    
    if (repositoriesError) {
      console.error('⚠️  Error fetching repositories from database:', repositoriesError)
      // Don't fail if repositories can't be fetched
    }

    console.log(`✅ Found ${repositories?.length || 0} repositories in database`)

    return NextResponse.json({
      installations: installations || [],
      repositories: repositories || [],
      count: installations?.length || 0,
      message: `Found ${installations?.length || 0} installations and ${repositories?.length || 0} repositories in database`
    })
  } catch (error) {
    console.error('💥 Get GitHub installations error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred while fetching installations' },
      { status: 500 }
    )
  }
} 