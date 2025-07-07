import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/utils/supabase/server'

// GET /api/github/repositories/assignments/phone/[phoneNumber] - Get repositories assigned to a user by phone number
export async function GET(
  request: NextRequest,
  { params }: { params: { phoneNumber: string } }
) {
  try {
    const supabase = createServerSupabaseClient()

    console.log('params', params)

    const phoneNumber = decodeURIComponent(params.phoneNumber)

    console.log(`🔍 Fetching repository assignments for phone number: ${phoneNumber}`)

    // First, find the user by phone number in organization_clients table
    // Try both direct phone field and client_profile phone_number
    let userData = null
    let userError = null

    // First try to find by direct phone in organization_clients
    const { data: clientData, error: clientError } = await supabase
      .from('organization_clients')
      .select(`
        phone,
        role,
        id
      `)
      .eq('phone', phoneNumber)
      // .not('org_client_id', 'is', null)
      .single()

    if (clientData) {
      // Handle both array and single object responses

      if (clientData?.phone) {
        userData = {
          phone: clientData.phone,
          role: clientData.role,
          id: clientData.id
        }
      }

      console.log('clientData', clientData)
    }

    if (!userData) {
      // If not found by direct phone, try by client_profile phone_number
      const { data: profileData, error: profileError } = await supabase
        .from('organization_clients_profile')
        .select('auth_user_id, email, full_name, phone_number')
        .eq('phone_number', phoneNumber)
        .single()

      if (profileData?.auth_user_id) {
        userData = {
          id: profileData.auth_user_id,
          email: profileData.email,
          full_name: profileData.full_name,
          phone_number: phoneNumber
        }
      } else {
        userError = profileError || new Error('User not found')
      }
    }

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
      .eq('client_id', userData.id)

    if (error) {
      console.error('Error fetching repository assignments:', error)
      return NextResponse.json(
        { 
          error: 'Failed to fetch repository assignments',
          details: error.message
        },
        { status: 500 }
      )
    }

    const repositories = assignments?.map(assignment => assignment.repository).filter(Boolean) || []

    console.log(`📦 Found ${repositories.length} repository assignments for user`)

    return NextResponse.json({
      user: userData,
      repositories,
      assignments
    })

  } catch (error) {
    console.error('Unexpected error in repository assignments API:', error)
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 