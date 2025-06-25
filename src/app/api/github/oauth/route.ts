import { NextRequest, NextResponse } from 'next/server'
import { githubHelpers } from '@/utils/supabase'

// Exchange GitHub OAuth code for access token
async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  token_type: string;
  scope: string;
}> {
  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('GitHub OAuth not properly configured')
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to exchange code for token')
  }

  const data = await response.json()
  
  if (data.error) {
    throw new Error(data.error_description || data.error)
  }

  return data
}

// Get GitHub user info
async function getGitHubUser(accessToken: string): Promise<{
  id: number;
  login: string;
  name: string;
  email: string;
}> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to get GitHub user info')
  }

  return response.json()
}

// Get user repositories
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
    let userInfo = null
    let userRepositories = []
    
    // If code provided, exchange it for access token
    if (code && !access_token) {
      try {
        const tokenData = await exchangeCodeForToken(code)
        finalAccessToken = tokenData.access_token

        // Get user info and repositories
        userInfo = await getGitHubUser(finalAccessToken)
        userRepositories = await getGitHubRepositories(finalAccessToken)
      } catch (error) {
        console.error('GitHub OAuth error:', error)
        return NextResponse.json(
          { error: 'Failed to exchange code for access token' },
          { status: 400 }
        )
      }
    }

    // Save GitHub integration
    const { data: integrationData, error: integrationError } = await githubHelpers.saveGitHubIntegration(
      organization_id,
      {
        github_user_id: userInfo?.id || github_user_id,
        github_username: userInfo?.login || github_username,
        access_token: finalAccessToken
      }
    )

    if (integrationError) {
      return NextResponse.json(
        { error: integrationError.message },
        { status: 400 }
      )
    }

    // Save repositories
    let repositoryData = null
    const reposToSave = userRepositories.length > 0 ? userRepositories : repositories
    
    if (reposToSave.length > 0 && integrationData?.[0]?.id) {
      const { data: repoData, error: repoError } = await githubHelpers.saveRepositories(
        integrationData[0].id,
        reposToSave
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

// GET /api/github/oauth - Get GitHub integrations and repositories
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