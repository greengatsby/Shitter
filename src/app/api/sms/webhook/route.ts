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

async function sendToClaudeCode(prompt: string, userId?: string): Promise<ClaudeResponse> {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/claude-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt.trim(),
        outputFormat: 'stream-json',
        maxTurns: 50,
        continue_conversation: true, // Enable session continuation for SMS
        verbose: false
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Handle Server-Sent Events (SSE) streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    let finalResult = '';
    let assistantMessages: string[] = [];
    // final resp will be the last, any last message that is a result. the final message
    let finalResp
    let success = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              // Debug: Log all events
              console.log('SMS DEBUG: SSE Event', {
                type: data.type,
                hasContent: !!data.content,
                contentPreview: data.content ? JSON.stringify(data.content).slice(0, 100) : 'none',
                hasResult: !!data.result,
                resultPreview: data.result ? JSON.stringify(data.result).slice(0, 100) : 'none'
              });
              
              // Collect assistant messages
              if (data.type === 'assistant' && data.content) {
                let contentText = '';
                if (typeof data.content === 'string') {
                  contentText = data.content;
                } else if (Array.isArray(data.content)) {
                  contentText = data.content
                    .map((block: any) => {
                      if (typeof block === 'string') return block;
                      if (block?.text) return block.text;
                      if (block?.type === 'text' && block?.text) return block.text;
                      return '';
                    })
                    .join('');
                } else if (data.content && typeof data.content === 'object' && data.content.text) {
                  contentText = data.content.text;
                }
                if (contentText.trim()) {
                  assistantMessages.push(contentText);
                  
                  // If this message contains the approval prompt, use only this message
                  if (contentText.includes('Changes Applied Successfully! Approve these changes')) {
                    console.log('SMS: Found approval prompt, using only this message');
                    assistantMessages = [contentText]; // Replace all previous messages with just this one
                  }
                }
              }
              
              // Handle completion event
              if (data.success !== undefined) {
                success = data.success;
                console.log('SMS DEBUG: Completion event', {
                  success: data.success,
                  hasFinalResult: !!data.final_result,
                  finalResultType: typeof data.final_result,
                  finalResultPreview: data.final_result ? JSON.stringify(data.final_result).slice(0, 200) : 'none'
                });
                
                if (data.final_result) {
                  finalResult = data.final_result;
                  finalResp = data.final_result;
                  // Also check final result for approval prompt
                  if (typeof finalResult === 'string' && finalResult.includes('Changes Applied Successfully! Approve these changes')) {
                    console.log('SMS: Found approval prompt in final result, using only this');
                    assistantMessages = [finalResult]; // Use only the final result
                  }
                }
              }
            } catch (parseError) {
              // Skip malformed JSON lines
              console.log('Skipping malformed SSE data:', line);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Combine all assistant messages
    const combinedResponse = assistantMessages.join(' ').trim();
    
    console.log('SMS DEBUG: Final processing', {
      assistantMessagesCount: assistantMessages.length,
      assistantMessages: assistantMessages,
      finalResult: finalResult,
      combinedResponse: combinedResponse,
      finalToSend: combinedResponse || finalResult
    });
    
    return {
      success: success,
      content: combinedResponse || finalResult,
      result: combinedResponse
    };

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
    // console.log('Telnyx SMS webhook received:')

    const { data } = body
    
    if (data?.event_type === 'message.received') {
      const message = data.payload
      const messageId = message.id
      const fromNumber = message.from.phone_number
      const messageText = message.text || ''
      const hasMedia = message.media && message.media.length > 0
      
      // console.log(`Message received from ${fromNumber}:`, {
      //   messageId,
      //   text: messageText,
      //   hasMedia,
      //   mediaCount: hasMedia ? message.media.length : 0
      // })
      
      // Check if we've already processed this message ID to prevent duplicates
      const { data: existingMessage } = await supabaseAdmin
        .from('processed_messages')
        .select('id')
        .eq('message_id', messageId)
        .single()
      
      if (existingMessage) {
        console.log(`Message ${messageId} already processed, skipping`)
        return NextResponse.json({ success: true, message: 'Already processed msg' })
      }

        
      
      // Mark message as being processed
      await supabaseAdmin
        .from('processed_messages')
        .insert({
          message_id: messageId,
          phone_number: fromNumber,
          processed_at: new Date().toISOString()
        })
      
      // Check if sender is a valid user
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('phone_number', fromNumber)
        .single()
      
      if (!user) {
        // console.log('Message from unknown user:', fromNumber)
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

// Helper function to send SMS via Telnyx with smart truncation
async function sendSMS(toNumber: string, message: string) {
  // Smart truncation for SMS - be more aggressive

  // message with max 200 characters
  let smsMessage = truncateForSMS(message).slice(0, 400)
  
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
        text: smsMessage
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      
      // Handle the "Message too large" error specifically
      if (errorData.errors && errorData.errors[0]?.code === '40302') {
        console.log('Message too large, sending shortened version...')
        // Send a much shorter message
        const shortMessage = 'Response too long for SMS. Check the app for full details.'
        
        const retryResponse = await fetch('https://api.telnyx.com/v2/messages', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: process.env.TELNYX_PHONE_NUMBER,
            to: toNumber,
            text: shortMessage
          })
        })
        
        if (retryResponse.ok) {
          console.log('Shortened SMS sent successfully to:', toNumber)
          return true
        } else {
          throw new Error(`Even shortened SMS failed: ${retryResponse.statusText}`)
        }
      }
      
      const errorText = JSON.stringify(errorData)
      throw new Error(`SMS send failed: ${response.statusText} - ${errorText}`)
    }
    
    console.log('SMS sent successfully to:', toNumber)
    return true
  } catch (error) {
    console.error('Error sending SMS:', error)
    return false
  }
}

// Smart SMS truncation function
function truncateForSMS(message: string): string {
  // SMS safe limit - be very conservative
  const MAX_SMS_CHARS = 800 // Well under 10-part limit
  
  if (message.length <= MAX_SMS_CHARS) {
    return message
  }
  
  // Try to find a good breaking point (sentence, paragraph, etc.)
  const truncated = message.substring(0, MAX_SMS_CHARS - 20) // Leave room for ellipsis
  
  // Find last sentence ending
  const lastSentence = truncated.lastIndexOf('.')
  const lastQuestion = truncated.lastIndexOf('?')
  const lastExclamation = truncated.lastIndexOf('!')
  const lastNewline = truncated.lastIndexOf('\n')
  
  const breakPoint = Math.max(lastSentence, lastQuestion, lastExclamation, lastNewline)
  
  if (breakPoint > MAX_SMS_CHARS * 0.5) {
    // Good break point found
    return message.substring(0, breakPoint + 1) + '\n\n[Message truncated - check app for full response]'
  } else {
    // No good break point, just cut it
    return truncated + '...\n\n[Message truncated - check app for full response]'
  }
}

// Process coding-related messages through Claude Code SDK
async function processCodingMessage(message: string, user: any) {
  try {
    const claudeResponse = await sendToClaudeCode(message, user.id)
    
    let responseText = ''
    if (claudeResponse.success) {
      responseText = claudeResponse.result || claudeResponse.content || 'Task completed successfully'
    } else {
      responseText = `Error: ${claudeResponse.error || 'Failed to process request'}`
    }

    // Smart truncation is now handled in sendSMS function
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
    const claudeResponse = await sendToClaudeCode(message, user.id)
    
    let responseText = ''
    if (claudeResponse.success) {
      responseText = claudeResponse.result || claudeResponse.content || 'Task completed successfully'
    } else {
      responseText = `Error: ${claudeResponse.error || 'Failed to process request'}`
    }

    // Smart truncation is now handled in sendSMS function
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