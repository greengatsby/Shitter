import { NextRequest, NextResponse } from 'next/server'
import { githubAppService } from '@/lib/github-app'
import { githubHelpers } from '@/utils/supabase'

interface WebhookEvent {
  action?: string
  installation?: {
    id: number
    account: {
      id: number
      login: string
      type: string
      avatar_url: string
    }
    app_id: number
    app_slug: string
    target_type: string
    permissions: Record<string, string>
    events: string[]
    repository_selection: 'all' | 'selected'
    repositories_url?: string
    suspended_at?: string
    suspended_by?: any
  }
  repositories?: Array<{
    id: number
    name: string
    full_name: string
    private: boolean
  }>
  repository?: {
    id: number
    name: string
    full_name: string
    private: boolean
  }
  sender?: {
    id: number
    login: string
    type: string
  }
}

// POST /api/github/webhook - Handle GitHub App webhook events
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-hub-signature-256')
    const deliveryId = request.headers.get('x-github-delivery')
    const eventType = request.headers.get('x-github-event')

    if (!signature || !deliveryId || !eventType) {
      return NextResponse.json(
        { error: 'Missing required webhook headers' },
        { status: 400 }
      )
    }

    // Verify webhook signature
    const isValid = githubAppService.verifyWebhookSignature(body, signature)
    if (!isValid) {
      console.error('Invalid webhook signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const payload: WebhookEvent = JSON.parse(body)
    
    // Log webhook delivery
    await githubHelpers.logWebhookDelivery({
      delivery_id: deliveryId,
      event_type: eventType,
      action: payload.action,
      installation_id: payload.installation?.id,
      payload: payload,
      headers: {
        'x-github-event': eventType,
        'x-github-delivery': deliveryId,
        'x-hub-signature-256': signature
      }
    })

    // Process different event types
    switch (eventType) {
      case 'installation':
        await handleInstallationEvent(payload, deliveryId)
        break
        
      case 'installation_repositories':
        await handleRepositoriesEvent(payload, deliveryId)
        break
        
      case 'repository':
        await handleRepositoryEvent(payload, deliveryId)
        break
        
      case 'push':
        await handlePushEvent(payload, deliveryId)
        break
        
      default:
        console.log(`Unhandled webhook event: ${eventType}`)
        await githubHelpers.markWebhookProcessed(deliveryId, `Unhandled event type: ${eventType}`)
    }

    return NextResponse.json({ message: 'Webhook processed successfully' })
  } catch (error) {
    console.error('Webhook processing error:', error)
    
    // Try to mark as processed with error if we have the delivery ID
    const deliveryId = request.headers.get('x-github-delivery')
    if (deliveryId) {
      await githubHelpers.markWebhookProcessed(
        deliveryId, 
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
    
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handleInstallationEvent(payload: WebhookEvent, deliveryId: string) {
  try {
    const { action, installation } = payload

    if (!installation) {
      throw new Error('Installation data missing from payload')
    }

    switch (action) {
      case 'created':
        // New installation - save to database
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

        // Save installation without organization mapping - will be linked in callback
        // Use null instead of empty string for organization_id
        await githubHelpers.saveGitHubInstallation(null, installationData)
        
        // Don't sync repositories here - wait until installation is linked to organization
        // Repositories will be synced in the authorize callback or when explicitly requested
        console.log(`Installation ${installation.id} created, repositories will be synced after organization linking`)
        break

      case 'deleted':
        // Installation deleted - suspend in our database
        await githubHelpers.suspendGitHubInstallation(installation.id, 'github_deletion')
        break

      case 'suspend':
        // Installation suspended
        await githubHelpers.suspendGitHubInstallation(installation.id, 'github_suspension')
        break

      case 'unsuspend':
        // Installation unsuspended - reactivate
        const { error } = await githubHelpers.saveGitHubInstallation('', {
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
        })
        if (error) console.error('Error reactivating installation:', error)
        break

      default:
        console.log(`Unhandled installation action: ${action}`)
    }

    await githubHelpers.markWebhookProcessed(deliveryId)
  } catch (error) {
    console.error('Error handling installation event:', error)
    await githubHelpers.markWebhookProcessed(
      deliveryId, 
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}

async function handleRepositoriesEvent(payload: WebhookEvent, deliveryId: string) {
  try {
    const { action, installation, repositories } = payload

    if (!installation) {
      throw new Error('Installation data missing from payload')
    }

    switch (action) {
      case 'added':
        // Repositories added to installation
        if (repositories && repositories.length > 0) {
          await githubHelpers.saveRepositoriesToDatabase(installation.id, repositories)
        }
        break

      case 'removed':
        // Repositories removed from installation
        if (repositories && repositories.length > 0) {
          // Mark repositories as inactive
          for (const repo of repositories) {
            // Note: We'd need to add a method to deactivate specific repositories
            console.log(`Repository ${repo.full_name} removed from installation ${installation.id}`)
          }
        }
        break

      default:
        console.log(`Unhandled repositories action: ${action}`)
    }

    await githubHelpers.markWebhookProcessed(deliveryId)
  } catch (error) {
    console.error('Error handling repositories event:', error)
    await githubHelpers.markWebhookProcessed(
      deliveryId,
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}

async function handleRepositoryEvent(payload: WebhookEvent, deliveryId: string) {
  try {
    const { action, repository, installation } = payload

    if (!repository || !installation) {
      throw new Error('Repository or installation data missing from payload')
    }

    switch (action) {
      case 'created':
      case 'publicized':
      case 'privatized':
        // Repository created or visibility changed - resync
        const repositories = await githubAppService.fetchRepositoriesFromGitHub(installation.id)
        await githubHelpers.saveRepositoriesToDatabase(installation.id, repositories)
        break

      case 'deleted':
      case 'archived':
        // Repository deleted or archived - mark as inactive
        console.log(`Repository ${repository.full_name} ${action}`)
        break

      default:
        console.log(`Unhandled repository action: ${action}`)
    }

    await githubHelpers.markWebhookProcessed(deliveryId)
  } catch (error) {
    console.error('Error handling repository event:', error)
    await githubHelpers.markWebhookProcessed(
      deliveryId,
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}

async function handlePushEvent(payload: WebhookEvent, deliveryId: string) {
  try {
    // Handle push events if needed for triggering builds, etc.
    console.log('Push event received:', payload.repository?.full_name)
    
    await githubHelpers.markWebhookProcessed(deliveryId)
  } catch (error) {
    console.error('Error handling push event:', error)
    await githubHelpers.markWebhookProcessed(
      deliveryId,
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}

// GET /api/github/webhook - Webhook verification endpoint
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const hubChallenge = searchParams.get('hub.challenge')
  
  if (hubChallenge) {
    return new NextResponse(hubChallenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
  
  return NextResponse.json({ 
    message: 'GitHub webhook endpoint is configured correctly',
    app_id: process.env.GH_APP_ID 
  })
} 