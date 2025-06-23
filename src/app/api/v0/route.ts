import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    // Check if API key is available
    if (!process.env.V0_API_KEY) {
      return NextResponse.json({ 
        error: 'V0_API_KEY environment variable is required. Get your key from v0.dev' 
      }, { status: 400 })
    }

    const response = await fetch('https://api.v0.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.V0_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'v0-1.0-md',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`V0 API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('Error calling V0 API:', error)
    return NextResponse.json(
      { error: 'Failed to generate code', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    )
  }
}