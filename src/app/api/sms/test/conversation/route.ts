import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Telnyx SMS test webhook received:', JSON.stringify(body, null, 2))

    const { data } = body
    
    if (data?.event_type === 'message.received') {
      const message = data.payload
      const messageId = message.id
      const fromNumber = message.from.phone_number
      const toNumber = message.to?.phone_number
      const messageText = message.text || ''
      const hasMedia = message.media && message.media.length > 0
      const receivedAt = message.received_at || new Date().toISOString()
      
      console.log(`Test message received:`, {
        messageId,
        from: fromNumber,
        to: toNumber,
        text: messageText,
        hasMedia,
        mediaCount: hasMedia ? message.media.length : 0,
        receivedAt
      })
      
      // Store the test conversation message for review
      try {
        await supabaseAdmin
          .from('test_conversations')
          .insert({
            message_id: messageId,
            from_number: fromNumber,
            to_number: toNumber,
            message_text: messageText,
            has_media: hasMedia,
            media_data: hasMedia ? message.media : null,
            received_at: receivedAt,
            full_payload: body,
            created_at: new Date().toISOString()
          })
        
        console.log('Test conversation message stored successfully')
      } catch (dbError) {
        console.error('Error storing test conversation:', dbError)
        // Continue processing even if DB storage fails
      }
      
      // Send a simple test response back
      const testResponse = `Test received! Message from ${fromNumber}: "${messageText}"${hasMedia ? ` (with ${message.media.length} media file(s))` : ''}`
      
      // Send response SMS back to sender
      const smsResult = await sendTestSMS(fromNumber, testResponse)
      
      if (smsResult) {
        console.log('Test response sent successfully')
      } else {
        console.error('Failed to send test response')
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Test message processed',
        messageId,
        responseSent: smsResult
      })
    }

    // Handle other event types
    console.log('Received non-message event:', data?.event_type)
    return NextResponse.json({ success: true, message: 'Event received but not processed' })

  } catch (error) {
    console.error('Telnyx SMS test webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Handle GET requests for webhook validation/testing and fetching received messages
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const challenge = url.searchParams.get('challenge')
  
  // If there's a challenge parameter, return it (for webhook verification)
  if (challenge) {
    return NextResponse.json({ challenge })
  }
  
  // Fetch recent received messages for the frontend
  try {
    const { data: messages, error } = await supabaseAdmin
      .from('test_conversations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (error) {
      console.error('Error fetching test conversations:', error)
      return NextResponse.json({
        status: 'SMS test conversation webhook endpoint active',
        endpoint: '/api/sms/test/conversation',
        timestamp: new Date().toISOString(),
        description: 'This endpoint receives test SMS messages from Telnyx for testing purposes',
        messages: [],
        error: 'Failed to fetch messages from database'
      })
    }
    
    return NextResponse.json({ 
      status: 'SMS test conversation webhook endpoint active',
      endpoint: '/api/sms/test/conversation',
      timestamp: new Date().toISOString(),
      description: 'This endpoint receives test SMS messages from Telnyx for testing purposes',
      messages: messages || []
    })
  } catch (error) {
    console.error('Error in GET request:', error)
    return NextResponse.json({
      status: 'SMS test conversation webhook endpoint active',
      endpoint: '/api/sms/test/conversation',
      timestamp: new Date().toISOString(),
      description: 'This endpoint receives test SMS messages from Telnyx for testing purposes',
      messages: [],
      error: 'Database connection failed'
    })
  }
}

// Helper function to send test SMS response via Telnyx
async function sendTestSMS(toNumber: string, message: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.TELNYX_PHONE_NUMBER || '+16288959010', // Use the test number as sender
        to: toNumber,
        text: message
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Test SMS send failed: ${response.statusText} - ${errorText}`)
      return false
    }
    
    const result = await response.json()
    console.log('Test SMS sent successfully:', result.data?.id)
    return true
    
  } catch (error) {
    console.error('Error sending test SMS:', error)
    return false
  }
}
