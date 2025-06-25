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

// Unified agent configuration that handles both scheduling and food logging
const UNIFIED_AGENT_CONFIG = {
  name: "Personal Training Assistant",
  prompt: `You are a personal trainer and nutrition coach. Someone is texting you and you need to help them with both scheduling and food/nutrition tracking.

CAPABILITIES:
1. SCHEDULING: Help with training appointments (book, reschedule, cancel, view)
2. FOOD LOGGING: Log and analyze food intake from descriptions, images, or voice messages
3. CODING ASSISTANCE: Help with programming tasks using Claude Code SDK

SMART APPOINTMENT HANDLING:
- When someone wants to reschedule/cancel and mentions a specific time+new time (like "reschedule tomorrow to 4pm"), try rescheduleTraining directly using the time reference as training_identifier
- If rescheduleTraining fails because it can't find the appointment or finds multiple, THEN use getAppointments to show them options
- Only use getAppointments when the request is ambiguous or when direct reschedule/cancel fails

FOOD LOGGING GUIDELINES:
- When users send food-related content (descriptions, images, voice messages about food), use the logFood tool
- Provide encouraging and supportive nutritional feedback
- Include estimated calories prominently in your responses
- For images or voice messages, I'll provide you with the analysis results as context

CODING ASSISTANCE:
- For programming questions, code reviews, or development tasks, process them through Claude Code SDK
- Be concise but helpful with technical explanations

AVAILABLE TOOLS:
- createNewTraining: For booking new sessions
- rescheduleTraining: For moving existing sessions to new times
- cancelTraining: For canceling existing sessions
- getAppointments: For viewing appointments by date range
- logFood: For logging food intake with nutritional analysis

WORKFLOW:
1. For clear reschedule requests with both old and new times: Try rescheduleTraining directly first
2. For clear cancel requests with specific times: Try cancelTraining directly first  
3. For new booking requests: Use createNewTraining immediately
4. For food-related content: Use logFood tool
5. For coding questions: Process through Claude Code SDK
6. If direct tool call fails due to ambiguity, then use getAppointments to clarify
7. For vague requests ("show me my schedule"), use getAppointments first

Be incredibly concise, warm, and conversational. Keep messages brief since this is SMS.

Important: Always assume Pacific Time (America/Los_Angeles) when users mention times without specifying timezone.`,
  tools: ["createNewTraining", "rescheduleTraining", "cancelTraining", "getAppointments", "logFood"]
}

interface ClaudeResponse {
  content?: string;
  success: boolean;
  error?: string;
  result?: string;
}

async function sendToClaudeCode(prompt: string): Promise<ClaudeResponse> {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/claude-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt.trim(),
        outputFormat: 'text',
        maxTurns: 10,
        continueConversation: false,
        verbose: false
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Claude API error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Telnyx SMS webhook received:', body)

    const { data } = body
    
    if (data?.event_type === 'message.received') {
      const message = data.payload
      const fromNumber = message.from.phone_number
      const messageText = message.text || ''
      const hasMedia = message.media && message.media.length > 0
      
      console.log(`Message received from ${fromNumber}:`, {
        text: messageText,
        hasMedia,
        mediaCount: hasMedia ? message.media.length : 0
      })
      
      // Check if sender is a valid user
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('phone_number', fromNumber)
        .single()
      
      if (!user) {
        console.log('Message from unknown user:', fromNumber)
        await sendSMS(fromNumber, "Hi! I don't have you in my system yet. Please contact support to get set up.")
        return NextResponse.json({ success: true })
      }
      
      let result
      
      // Process message - check if it's coding-related first, then handle unified agent
      const codingKeywords = ['code', 'program', 'debug', 'error', 'function', 'variable', 'class', 'javascript', 'python', 'react', 'typescript', 'html', 'css', 'api', 'database', 'bug']
      const lowerText = messageText.toLowerCase()
      const isCodingRelated = codingKeywords.some(keyword => lowerText.includes(keyword))
      
      if (isCodingRelated) {
        result = await processCodingMessage(messageText, user)
      } else if (hasMedia) {
        const imageMedia = message.media.filter((media: any) => 
          media.content_type && media.content_type.startsWith('image/')
        )
        
        const audioMedia = message.media.filter((media: any) => 
          media.content_type && media.content_type.startsWith('audio/')
        )
        
        // Process media and pass results to unified agent
        let mediaContext = ''
        
        if (audioMedia.length > 0) {
          console.log(`Processing ${audioMedia.length} audio recording(s) from ${fromNumber}`)
          const transcriptions = await Promise.all(
            audioMedia.map(async (media: any) => {
              try {
                return await transcribeAudio(media.url)
              } catch (error) {
                console.error('Error transcribing audio:', error)
                return '[Audio transcription failed]'
              }
            })
          )
          const transcribedText = transcriptions.join(' ')
          mediaContext = `[VOICE MESSAGE TRANSCRIPTION]: ${transcribedText}`
        }
        
        if (imageMedia.length > 0) {
          console.log(`Processing ${imageMedia.length} image(s) from ${fromNumber}`)
          const imageAnalysis = await analyzeImagesForContext(imageMedia)
          mediaContext += imageAnalysis ? `\n[IMAGE ANALYSIS]: ${imageAnalysis}` : '\n[IMAGE]: Unable to analyze image'
        }
        
        const fullMessage = messageText ? 
          `${messageText}\n${mediaContext}` : 
          mediaContext
        
        result = await processUnifiedMessage(fullMessage, user)
      } else {
        // No media - process as regular text message
        result = await processUnifiedMessage(messageText, user)
      }
      
      // Send response SMS
      if (result.response) {
        await sendSMS(fromNumber, result.response)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Telnyx SMS webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle GET requests for webhook validation
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    status: 'SMS webhook endpoint active',
    timestamp: new Date().toISOString() 
  });
}

// Helper function to send SMS via Telnyx
async function sendSMS(toNumber: string, message: string) {
  try {
    const response = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID || '400197a4-0dc6-4459-bfb4-b757267e689e',
        from: process.env.TELNYX_PHONE_NUMBER,
        to: toNumber,
        text: message
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`SMS send failed: ${response.statusText} - ${errorText}`)
    }
    
    console.log('SMS sent successfully to:', toNumber)
    return true
  } catch (error) {
    console.error('Error sending SMS:', error)
    return false
  }
}

// Process coding-related messages through Claude Code SDK
async function processCodingMessage(message: string, user: any) {
  try {
    const claudeResponse = await sendToClaudeCode(message)
    
    let responseText = ''
    if (claudeResponse.success) {
      responseText = claudeResponse.result || claudeResponse.content || 'Task completed successfully'
    } else {
      responseText = `Error: ${claudeResponse.error || 'Failed to process request'}`
    }

    // Truncate response if too long for SMS
    if (responseText.length > 1500) {
      responseText = responseText.substring(0, 1497) + '...'
    }

    return { response: responseText }
  } catch (error) {
    console.error('Error processing coding message:', error)
    return {
      response: 'Sorry, I encountered an error processing your coding question. Please try again.'
    }
  }
}

// Unified message processing function
async function processUnifiedMessage(message: string, user: any) {
  try {
    // For now, route everything to Claude Code SDK for simplicity
    const claudeResponse = await sendToClaudeCode(message)
    
    let responseText = ''
    if (claudeResponse.success) {
      responseText = claudeResponse.result || claudeResponse.content || 'Task completed successfully'
    } else {
      responseText = `Error: ${claudeResponse.error || 'Failed to process request'}`
    }

    // Truncate response if too long for SMS
    if (responseText.length > 1500) {
      responseText = responseText.substring(0, 1497) + '...'
    }

    return { response: responseText }
  } catch (error) {
    console.error('Error processing unified message:', error)
    return {
      response: 'Sorry, I encountered an error processing your message. Please try again.'
    }
  }
}

// Helper function to analyze images for context
async function analyzeImagesForContext(imageMedia: any[]): Promise<string> {
  try {
    // Simple placeholder - in a full implementation, this would use OpenAI Vision API
    return `Found ${imageMedia.length} image(s) - analysis not implemented yet`
  } catch (error) {
    console.error('Error analyzing images:', error)
    return 'Image analysis failed'
  }
}

// Helper function to transcribe audio
async function transcribeAudio(audioUrl: string): Promise<string> {
  try {
    // Simple placeholder - in a full implementation, this would use speech-to-text
    return '[Audio transcription not implemented yet]'
  } catch (error) {
    console.error('Error transcribing audio:', error)
    throw error
  }
} 