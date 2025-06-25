import { NextRequest, NextResponse } from 'next/server'
import { githubHelpers } from '@/utils/supabase'

// Get user repositories from GitHub API
async function getGitHubRepositories(accessToken: string): Promise<any[]> {
  const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to get GitHub repositories')
  }

  return response.json()
}

// POST /api/github/sync-repositories - Sync repositories from GitHub
export async function POST(request: NextRequest) {
  try {
    const { integration_id, organization_id } = await request.json()

    if (!integration_id || !organization_id) {
      return NextResponse.json(
        { error: 'Integration ID and Organization ID are required' },
        { status: 400 }
      )
    }

    // Get the integration to retrieve the access token
    const { data: integrations, error: integrationsError } = await githubHelpers.getOrganizationGitHubIntegrations(organization_id)
    
    if (integrationsError || !integrations || integrations.length === 0) {
      return NextResponse.json(
        { error: 'GitHub integration not found' },
        { status: 404 }
      )
    }

    const integration = integrations.find(i => i.id === integration_id)
    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      )
    }

    // Fetch repositories from GitHub
    const repositories = await getGitHubRepositories(integration.access_token)

    // Save repositories to database
    const { data: repositoryData, error: repoError } = await githubHelpers.saveRepositories(
      integration_id,
      repositories
    )

    if (repoError) {
      return NextResponse.json(
        { error: repoError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      repositories: repositoryData,
      count: repositories.length,
      message: 'Repositories synced successfully'
    })
  } catch (error) {
    console.error('Sync repositories error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
} 