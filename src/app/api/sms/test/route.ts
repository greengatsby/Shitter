import { NextRequest, NextResponse } from 'next/server'

const TEST_PHONE_NUMBER = '+16288959010' // Test number for sending
const MAIN_PHONE_NUMBER = process.env.TELNYX_PHONE_NUMBER // Main number that receives (from env)

export async function POST(request: NextRequest) {
  try {
    const { message, phoneNumber } = await request.json()
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Use provided phone number or default to main number
    const toNumber = phoneNumber || MAIN_PHONE_NUMBER
    
    if (!toNumber) {
      return NextResponse.json(
        { error: 'No target phone number configured' },
        { status: 400 }
      )
    }

    console.log(`Sending test SMS from ${TEST_PHONE_NUMBER} to ${toNumber}:`, message)

    const response = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: TEST_PHONE_NUMBER,
        to: toNumber,
        text: message
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Telnyx API error:', errorText)
      return NextResponse.json(
        { error: `SMS send failed: ${response.statusText}` },
        { status: response.status }
      )
    }
    
    const responseData = await response.json()
    console.log('Test SMS sent successfully:', responseData)
    
    return NextResponse.json({
      success: true,
      message: 'Test SMS sent successfully',
      messageId: responseData.data?.id,
      from: TEST_PHONE_NUMBER,
      to: toNumber,
      text: message
    })

  } catch (error) {
    console.error('Error sending test SMS:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    testNumber: TEST_PHONE_NUMBER,
    mainNumber: MAIN_PHONE_NUMBER,
    status: 'SMS test endpoint ready'
  })
} 