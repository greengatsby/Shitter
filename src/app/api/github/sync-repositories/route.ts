import { NextRequest, NextResponse } from 'next/server'
import { githubHelpers } from '@/utils/supabase'
import { githubAppService } from '@/lib/github-app'

// POST /api/github/sync-repositories - Sync repositories from GitHub App installation
export async function POST(request: NextRequest) {
  try {
    const { installation_id, organization_id } = await request.json()

    if (!organization_id) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    if (!installation_id) {
      return NextResponse.json(
        { error: 'Installation ID is required' },
        { status: 400 }
      )
    }

    console.log(`🚀 Starting repository sync for installation ${installation_id}, organization ${organization_id}`)

    // Verify the installation belongs to the organization
    const { data: installation } = await githubHelpers.getInstallationFromDatabase(installation_id)
    if (!installation || installation.organization_id !== organization_id) {
      return NextResponse.json(
        { error: 'Installation not found or not authorized for this organization' },
        { status: 404 }
      )
    }

    console.log(`✅ Installation ${installation_id} verified for organization ${organization_id}`)

    // Step 1: Fetch repositories from GitHub API using Octokit
    console.log(`📡 Fetching repositories from GitHub API for installation ${installation_id}`)
    const repositories = await githubAppService.fetchRepositoriesFromGitHub(installation_id)
    
    console.log(`📦 Fetched ${repositories.length} repositories from GitHub:`, repositories.map(r => r.full_name))

    if (repositories.length === 0) {
      console.log('⚠️  No repositories found for this installation')
      return NextResponse.json({
        message: 'No repositories found for this installation',
        synced_count: 0,
        repositories: []
      })
    }

    // Step 2: Save repositories to our database
    console.log(`💾 Saving ${repositories.length} repositories to database`)
    const { data: savedRepositories, error: saveError } = await githubHelpers.saveRepositoriesToDatabase(
      installation_id, 
      repositories
    )

    if (saveError) {
      console.error('❌ Error saving repositories to database:', saveError)
      return NextResponse.json(
        { error: 'Failed to save repositories to database', details: saveError },
        { status: 500 }
      )
    }

    console.log(`✅ Successfully saved ${savedRepositories?.length || 0} repositories to database`)

    // Step 3: Update installation repository count
    console.log('📊 Updating installation repository count')
    try {
      await githubHelpers.saveInstallationToDatabase(organization_id, {
        installation_id: installation.installation_id,
        app_id: installation.app_id,
        app_slug: installation.app_slug,
        account_id: installation.account_id,
        account_login: installation.account_login,
        account_type: installation.account_type,
        account_avatar_url: installation.account_avatar_url,
        permissions: installation.permissions,
        events: installation.events,
        repository_selection: installation.repository_selection,
        repositories_count: repositories.length
      })
      console.log('✅ Installation repository count updated')
    } catch (updateError) {
      console.error('⚠️  Failed to update installation repository count:', updateError)
      // Don't fail the whole operation for this
    }

    console.log(`🎉 Repository sync completed successfully for installation ${installation_id}`)

    // Get updated repository count from database
    const { data: finalRepos } = await githubHelpers.getRepositoriesFromDatabase(organization_id)
    const installationRepos = finalRepos?.filter(repo => repo.installation_id === installation_id) || []

    return NextResponse.json({
      message: 'Repositories synced successfully',
      synced_count: savedRepositories?.length || 0,
      final_count: installationRepos.length,
      repositories: savedRepositories || [],
      installation_info: {
        installation_id: installation.installation_id,
        account_login: installation.account_login,
        account_type: installation.account_type
      }
    })

  } catch (error) {
    console.error('💥 Repository sync error:', error)
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch repositories')) {
        return NextResponse.json(
          { error: 'Unable to fetch repositories from GitHub. Please check your installation permissions.' },
          { status: 403 }
        )
      }
      
      if (error.message.includes('Installation not found')) {
        return NextResponse.json(
          { error: 'GitHub App installation not found or has been uninstalled.' },
          { status: 404 }
        )
      }
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred during repository sync', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 