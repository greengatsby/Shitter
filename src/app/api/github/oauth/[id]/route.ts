import { NextRequest, NextResponse } from 'next/server'
import { githubHelpers } from '@/utils/supabase'

// DELETE /api/github/oauth/[id] - Disconnect GitHub integration
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const integrationId = params.id

    if (!integrationId) {
      return NextResponse.json(
        { error: 'Integration ID is required' },
        { status: 400 }
      )
    }

    const { error } = await githubHelpers.disconnectGitHubIntegration(integrationId)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      message: 'GitHub integration disconnected successfully'
    })
  } catch (error) {
    console.error('Disconnect GitHub integration error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
} 