import { NextRequest, NextResponse } from 'next/server'
import { githubAppService } from '@/lib/github-app'
import { githubHelpers } from '@/utils/supabase'

// POST method removed - installation processing now handled by authorize-callback route

// GET /api/github/install - Get installation URL
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organization_id')

    const installationUrl = githubAppService.generateInstallationURL(organizationId || undefined)

    return NextResponse.json({
      installation_url: installationUrl,
      app_slug: process.env.GH_APP_SLUG || 'org-flow'
    })
  } catch (error) {
    console.error('Error generating installation URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate installation URL' },
      { status: 500 }
    )
  }
}

// DELETE /api/github/install - Handle installation deletion
export async function DELETE(request: NextRequest) {
  try {
    const { installation_id, organization_id } = await request.json()

    if (!installation_id) {
      return NextResponse.json(
        { error: 'Installation ID is required' },
        { status: 400 }
      )
    }

    // Suspend the installation in our database
    const { error } = await githubHelpers.suspendGitHubInstallation(
      installation_id,
      'user_requested'
    )

    if (error) {
      console.error('Error suspending installation:', error)
      return NextResponse.json(
        { error: 'Failed to remove installation' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Installation removed successfully'
    })
  } catch (error) {
    console.error('Error removing installation:', error)
    return NextResponse.json(
      { error: 'Failed to remove installation' },
      { status: 500 }
    )
  }
} 