import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/utils/supabase-server'

// GET /api/github/repositories/assignments/phone/[phoneNumber] - Get repositories assigned to a user by phone number
export async function GET(
  request: NextRequest,
  { params }: { params: { phoneNumber: string } }
) {
  try {
    const supabase = createServerSupabaseClient()

    const phoneNumber = decodeURIComponent(params.phoneNumber)

    console.log(`🔍 Fetching repository assignments for phone number: ${phoneNumber}`)

    // First, find the user by phone number
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, phone_number')
      .eq('phone_number', phoneNumber)
      .single()

    if (userError || !userData) {
      console.error('Error finding user by phone number:', userError)
      return NextResponse.json(
        { 
          error: 'User not found with this phone number',
          details: userError?.message
        },
        { status: 404 }
      )
    }

    console.log(`📱 Found user: ${userData.full_name || userData.email} (ID: ${userData.id})`)

    // Get repositories assigned to the user
    const { data: assignments, error } = await supabase
      .from('user_repository_assignments')
      .select(`
        *,
        repository:github_repositories(
          *,
          installation:github_app_installations(
            account_login,
            account_type,
            account_avatar_url,
            installation_id,
            organization_id,
            is_active
          )
        )
      `)
      .eq('user_id', userData.id)
    
    if (error) {
      console.error('Error fetching user repository assignments:', {
        error,
        phoneNumber,
        userId: userData.id,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details
      })
      return NextResponse.json(
        { 
          error: 'Failed to fetch user repository assignments',
          details: error.message,
          code: error.code
        },
        { status: 500 }
      )
    }

    console.log(`📋 Raw assignments data:`, assignments)

    // Extract repositories from assignments and filter out any null repositories
    const repositories = (assignments || [])
      .map(assignment => assignment.repository)
      .filter(repo => repo !== null)

    console.log(`✅ Processed ${repositories.length} repositories for user with phone ${phoneNumber}`)

    return NextResponse.json({
      repositories: repositories,
      assignments: assignments || [],
      user: userData,
      message: `Found ${repositories.length} repositories assigned to user with phone ${phoneNumber}`
    })
  } catch (error) {
    console.error('Get user repository assignments by phone error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
} 