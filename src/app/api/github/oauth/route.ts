import { NextRequest, NextResponse } from 'next/server'
import { githubHelpers } from '@/utils/supabase'

// POST /api/github/oauth - Handle GitHub OAuth callback
export async function POST(request: NextRequest) {
  try {
    const { 
      organization_id,
      code,
      access_token,
      github_user_id,
      github_username,
      repositories = []
    } = await request.json()

    if (!organization_id || (!code && !access_token)) {
      return NextResponse.json(
        { error: 'Organization ID and GitHub authorization code or access token are required' },
        { status: 400 }
      )
    }

    let finalAccessToken = access_token
    
    // If code provided instead of access_token, exchange it
    if (code && !access_token) {
      // In a real implementation, you'd exchange the code for an access_token here
      // For now, we'll assume the access_token is provided directly
      return NextResponse.json(
        { error: 'GitHub OAuth code exchange not implemented. Please provide access_token directly.' },
        { status: 400 }
      )
    }

    // Save GitHub integration
    const { data: integrationData, error: integrationError } = await githubHelpers.saveGitHubIntegration(
      organization_id,
      {
        github_user_id,
        github_username,
        access_token: finalAccessToken
      }
    )

    if (integrationError) {
      return NextResponse.json(
        { error: integrationError.message },
        { status: 400 }
      )
    }

    // Save repositories if provided
    let repositoryData = null
    if (repositories.length > 0 && integrationData?.[0]?.id) {
      const { data: repoData, error: repoError } = await githubHelpers.saveRepositories(
        integrationData[0].id,
        repositories
      )

      if (repoError) {
        console.error('Error saving repositories:', repoError)
      } else {
        repositoryData = repoData
      }
    }

    return NextResponse.json({
      integration: integrationData?.[0],
      repositories: repositoryData,
      message: 'GitHub integration completed successfully'
    })
  } catch (error) {
    console.error('GitHub OAuth error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// GET /api/github/oauth - Get GitHub OAuth URL
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

    const { data: integrations, error: integrationsError } = await githubHelpers.getOrganizationGitHubIntegrations(organizationId)
    
    if (integrationsError) {
      return NextResponse.json(
        { error: integrationsError.message },
        { status: 400 }
      )
    }

    const { data: repositories, error: repositoriesError } = await githubHelpers.getOrganizationRepositories(organizationId)
    
    if (repositoriesError) {
      return NextResponse.json(
        { error: repositoriesError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      integrations: integrations || [],
      repositories: repositories || []
    })
  } catch (error) {
    console.error('Get GitHub integrations error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
} 