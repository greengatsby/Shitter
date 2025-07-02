import { NextRequest, NextResponse } from 'next/server'
import { githubHelpers } from '@/utils/supabase'
import { githubAppService } from '@/lib/github-app'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

// GET /api/github/authorize-callback - Handle GitHub App installation callback
export async function GET(request: NextRequest) {
  // Helper function to create redirect URLs with correct protocol
  const createRedirectURL = (path: string) => {
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : request.url.split('/api/')[0]; // Use the same origin as the request
    return new URL(path, baseUrl);
  }
  
  try {
    const { searchParams } = new URL(request.url)
    const installationId = searchParams.get('installation_id')
    const setupAction = searchParams.get('setup_action')
    const state = searchParams.get('state') // Contains organization_id
    
    console.log('GitHub installation callback:', {
      installationId,
      setupAction,
      state
    })

    if (!installationId) {
      return NextResponse.redirect(
        createRedirectURL('/dashboard?error=missing_installation_id')
      )
    }

    // Extract organization_id from state parameter (if our format)
    let organizationId = null
    if (state) {
      // Try our format first: "org_${orgId}_${timestamp}"
      const stateMatch = state.match(/^org_([^_]+)_\d+$/)
      if (stateMatch) {
        organizationId = stateMatch[1]
      }
    }

    // If we don't have organization ID from state (GitHub generated UUID),
    // we need to handle this differently - store installation and let polling find it
    if (!organizationId) {
      console.log('GitHub generated state parameter (UUID):', state)
      console.log('Installation will be linked via dashboard polling')
      
      // Store the installation without organization mapping for now
      try {
        const installation = await githubAppService.fetchInstallationFromGitHub(parseInt(installationId))
        
        const installationData = {
          installation_id: installation.id,
          app_id: installation.app_id,
          app_slug: installation.app_slug,
          account_id: installation.account.id,
          account_login: installation.account.login,
          account_type: installation.account.type,
          account_avatar_url: installation.account.avatar_url,
          permissions: installation.permissions,
          events: installation.events,
          repository_selection: installation.repository_selection,
          repositories_count: 0
        }

        await githubHelpers.saveGitHubInstallation(null, installationData)
        
        // Don't sync repositories here - no organization linked yet
        // Repositories will be synced when user links the installation via dashboard

        // Redirect to after-install page with installation info
        return NextResponse.redirect(
          createRedirectURL(`/github/after-install?installation_id=${installationId}&setup_action=install&needs_linking=true`)
        )
      } catch (error) {
        console.error('Error processing installation:', error)
        return NextResponse.redirect(
          createRedirectURL('/dashboard?error=installation_processing_failed')
        )
      }
    }

    try {
      // Check if installation already exists (created by webhook)
      const { data: existingInstallation, error: checkError } = await githubHelpers.getGitHubInstallationById(parseInt(installationId))
      
      if (existingInstallation) {
        // Installation exists, just link it to the organization
        console.log('Linking existing installation to organization:', organizationId)
        const { error: linkError } = await githubHelpers.linkInstallationToOrganization(
          parseInt(installationId), 
          organizationId
        )
        
        if (linkError) {
          console.error('Error linking installation to organization:', linkError)
          return NextResponse.redirect(
            createRedirectURL('/dashboard?error=installation_link_failed')
          )
        }
      } else {
        // Installation doesn't exist, create it
        const installation = await githubAppService.fetchInstallationFromGitHub(parseInt(installationId))
        
        const installationData = {
          installation_id: installation.id,
          app_id: installation.app_id,
          app_slug: installation.app_slug,
          account_id: installation.account.id,
          account_login: installation.account.login,
          account_type: installation.account.type,
          account_avatar_url: installation.account.avatar_url,
          permissions: installation.permissions,
          events: installation.events,
          repository_selection: installation.repository_selection,
          repositories_count: 0
        }

        console.log('Creating new installation for organization:', organizationId)
        const { error: installationError } = await githubHelpers.saveGitHubInstallation(
          organizationId,
          installationData
        )

        if (installationError) {
          console.error('Error saving installation:', installationError)
          return NextResponse.redirect(
            createRedirectURL('/dashboard?error=installation_save_failed')
          )
        }
      }

      // Sync repositories
      try {
        const repositories = await githubAppService.fetchRepositoriesFromGitHub(parseInt(installationId))
        await githubHelpers.saveRepositoriesToDatabase(parseInt(installationId), repositories)
        console.log(`Synced ${repositories.length} repositories`)
      } catch (repoError) {
        console.error('Error syncing repositories:', repoError)
        // Don't fail the installation if repo sync fails
      }

      // Redirect back to dashboard with success
      return NextResponse.redirect(
        createRedirectURL('/dashboard?github_connected=true')
      )
    } catch (error) {
      console.error('Error processing installation:', error)
      return NextResponse.redirect(
        createRedirectURL('/dashboard?error=installation_processing_failed')
      )
    }
  } catch (error) {
    console.error('Installation callback error:', error)
    return NextResponse.redirect(
      createRedirectURL('/dashboard?error=callback_failed')
    )
  }
} 