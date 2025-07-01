import { NextRequest, NextResponse } from 'next/server'

// GET /api/github/callback - Redirect to the new authorize-callback route
export async function GET(request: NextRequest) {
  // Helper function to create redirect URLs with correct protocol
  const createRedirectURL = (path: string) => {
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : request.url.split('/api/')[0]; // Use the same origin as the request
    return new URL(path, baseUrl);
  }
  
  const { searchParams } = new URL(request.url)
  
  // Get all query parameters
  const code = searchParams.get('code')
  const installationId = searchParams.get('installation_id')
  const setupAction = searchParams.get('setup_action')
  const state = searchParams.get('state')
  
  // Build the redirect URL with all parameters
  const redirectUrl = createRedirectURL('/api/github/authorize-callback')
  
  if (code) redirectUrl.searchParams.set('code', code)
  if (installationId) redirectUrl.searchParams.set('installation_id', installationId)
  if (setupAction) redirectUrl.searchParams.set('setup_action', setupAction)
  if (state) redirectUrl.searchParams.set('state', state)
  
  console.log('Redirecting from old callback to new authorize-callback:', redirectUrl.toString())
  
  return NextResponse.redirect(redirectUrl)
} 