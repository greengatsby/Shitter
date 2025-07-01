import { NextRequest, NextResponse } from 'next/server'
import { githubHelpers } from '@/utils/supabase'
import { githubAppService } from '@/lib/github-app'

// POST /api/github/installations/link - Link a GitHub App installation to an organization in our database
export async function POST(request: NextRequest) {
  try {
    const { installation_id, organization_id } = await request.json()

    if (!installation_id || !organization_id) {
      return NextResponse.json(
        { error: 'Installation ID and Organization ID are required' },
        { status: 400 }
      )
    }

    console.log(`🔗 Linking installation ${installation_id} to organization ${organization_id} in database`)

    // Link the installation to the organization in our database
    const { data, error } = await githubHelpers.linkInstallationToOrganizationInDatabase(
      installation_id, 
      organization_id
    )

    if (error) {
      console.error('❌ Error linking installation to organization in database:', error)
      return NextResponse.json(
        { error: 'Failed to link installation to organization in database' },
        { status: 500 }
      )
    }

    // Sync repositories after linking
    try {
      const repositories = await githubAppService.getInstallationRepositories(installation_id)
      await githubHelpers.saveRepositoriesForInstallation(installation_id, repositories)
      console.log(`Synced ${repositories.length} repositories after linking installation`)
    } catch (repoError) {
      console.error('Error syncing repositories after linking:', repoError)
      // Don't fail the linking if repo sync fails
    }

    console.log(`✅ Successfully linked installation ${installation_id} to organization ${organization_id}`)

    return NextResponse.json({
      message: 'Installation linked to organization successfully',
      installation_id,
      organization_id,
      linked: true
    })
  } catch (error) {
    console.error('💥 Installation link error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred while linking installation' },
      { status: 500 }
    )
  }
} 