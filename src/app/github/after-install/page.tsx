'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, Loader2, AlertCircle, Github } from "lucide-react"

export default function AfterInstallPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const installationId = searchParams.get('installation_id')
    const setupAction = searchParams.get('setup_action')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const needsLinking = searchParams.get('needs_linking')

    console.log('After install page params:', {
      installationId,
      setupAction,
      state,
      error,
      needsLinking
    })

    if (error) {
      setStatus('error')
      setMessage(getErrorMessage(error))
      return
    }

    if (!installationId) {
      setStatus('error')
      setMessage('Installation ID not found. Please try installing the GitHub App again.')
      return
    }

    // If needs linking, handle differently
    if (needsLinking === 'true') {
      handlePendingInstallation(installationId)
    } else {
      // Process the installation normally
      processInstallation(installationId, state)
    }
  }, [searchParams])

  const handlePendingInstallation = async (installationId: string) => {
    setStatus('success')
    setMessage('GitHub App installed successfully! The installation will be linked to your organization when you return to the dashboard.')
    
    // Auto-redirect to dashboard after a short delay
    setTimeout(() => {
      router.push('/dashboard?installation_pending=true')
    }, 3000)
  }

  const processInstallation = async (installationId: string, state: string | null) => {
    try {
      setStatus('processing')
      setMessage('Processing your GitHub App installation...')

      // Extract organization ID from state
      let organizationId = null
      if (state) {
        const stateMatch = state.match(/^org_([^_]+)_\d+$/)
        if (stateMatch) {
          organizationId = stateMatch[1]
        }
      }

      if (!organizationId) {
        throw new Error('Organization information missing. Please try again from your dashboard.')
      }

      // Call our callback endpoint to process the installation
      const response = await fetch(`/api/github/authorize-callback?installation_id=${installationId}&state=${state}`, {
        method: 'GET'
      })

      if (response.ok || response.redirected) {
        setStatus('success')
        setMessage('GitHub App installed successfully! Redirecting to your dashboard...')
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push('/dashboard?github_connected=true')
        }, 2000)
      } else {
        throw new Error('Failed to process installation')
      }
    } catch (error) {
      console.error('Installation processing error:', error)
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Failed to process installation')
    }
  }

  const getErrorMessage = (error: string) => {
    switch (error) {
      case 'missing_installation_id':
        return 'Installation ID is missing. Please try installing the GitHub App again.'
      case 'missing_organization_id':
        return 'Organization information is missing. Please start the installation from your dashboard.'
      case 'installation_save_failed':
        return 'Failed to save installation data. Please contact support.'
      case 'installation_processing_failed':
        return 'Failed to process the installation. Please try again.'
      case 'callback_failed':
        return 'Installation callback failed. Please try again.'
      default:
        return 'An error occurred during installation. Please try again.'
    }
  }

  const handleRetry = () => {
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {status === 'processing' && <Loader2 className="h-12 w-12 animate-spin text-blue-600" />}
            {status === 'success' && <CheckCircle2 className="h-12 w-12 text-green-600" />}
            {status === 'error' && <AlertCircle className="h-12 w-12 text-red-600" />}
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            <Github className="h-6 w-6" />
            GitHub App Installation
          </CardTitle>
          <CardDescription>
            {status === 'processing' && 'Setting up your GitHub integration...'}
            {status === 'success' && 'Installation completed successfully!'}
            {status === 'error' && 'Installation encountered an error'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'processing' && (
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                Please wait while we configure your GitHub App integration.
              </p>
              <div className="space-y-2 text-xs text-gray-500">
                <p>✓ Verifying installation</p>
                <p>✓ Connecting to your organization</p>
                <p>• Syncing repositories...</p>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <Alert className="mb-4">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Your GitHub App has been successfully installed and configured!
                </AlertDescription>
              </Alert>
              <p className="text-sm text-gray-600 mb-4">
                You can now manage repositories and team access from your dashboard.
              </p>
              <Button onClick={() => router.push('/dashboard')} className="w-full">
                Go to Dashboard
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {message}
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Button onClick={handleRetry} className="w-full">
                  Return to Dashboard
                </Button>
                <p className="text-xs text-gray-500">
                  If the problem persists, please contact support.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 