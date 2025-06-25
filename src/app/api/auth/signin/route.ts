import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Create the response with proper cookie handling
    const response = new NextResponse()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { data, error } = await supabase.auth.signInWithPassword({ 
      email, 
      password 
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    // Return the response with cookies automatically set by Supabase
    response.headers.set('Content-Type', 'application/json')
    response.headers.set('Content-Length', JSON.stringify({
      message: 'Signed in successfully',
      user: data.user
    }).length.toString())

    const body = JSON.stringify({
      message: 'Signed in successfully',
      user: data.user
    })

    const finalResponse = new NextResponse(body, {
      status: 200,
      headers: response.headers
    })
    
    // Copy cookies from the intermediate response
    response.cookies.getAll().forEach(cookie => {
      finalResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    
    return finalResponse
  } catch (error) {
    console.error('Signin error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 