import { NextRequest, NextResponse } from 'next/server'
import { githubHelpers } from '@/utils/supabase'

// GET /api/github/installations/pending - Get pending installations from our database that need organization linking
export async function GET(request: NextRequest) {
  try {
    console.log('📋 Fetching pending installations from database')

    // Get installations without organization mapping from our database
    const { data: installations, error } = await githubHelpers.getPendingInstallationsFromDatabase()
    
    if (error) {
      console.error('❌ Error fetching pending installations from database:', error)
      return NextResponse.json(
        { error: 'Failed to fetch pending installations from database' },
        { status: 500 }
      )
    }

    console.log(`✅ Found ${installations?.length || 0} pending installations in database`)

    return NextResponse.json({
      installations: installations || [],
      count: installations?.length || 0,
      message: `Found ${installations?.length || 0} pending installations in database`
    })
  } catch (error) {
    console.error('💥 Get pending installations error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred while fetching pending installations' },
      { status: 500 }
    )
  }
} 