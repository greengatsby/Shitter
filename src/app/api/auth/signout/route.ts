import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(request: NextRequest) {
  try {
    // Track cookies that need to be set in response
    const cookiesToSet: Array<{ name: string; value: string; options: any }> = []

    // Create server-side Supabase client with proper cookie handling
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          // Store cookie changes for response
          cookiesToSet.push({ name, value, options })
        },
        remove(name: string, options: any) {
          // Store cookie changes for response
          cookiesToSet.push({ name, value: '', options })
        },
      },
    })

    // Sign out with server-side client
    const { error } = await supabase.auth.signOut()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Create response
    const response = NextResponse.json({
      message: 'Signed out successfully'
    })

    // Set all cookies that Supabase wants to set (clearing them)
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, {
        ...options,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      })
    })

    return response
    
  } catch (error) {
    console.error('Signout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 