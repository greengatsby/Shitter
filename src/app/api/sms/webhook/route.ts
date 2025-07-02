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

interface ClaudeResponse {
  content?: string;
  success: boolean;
  error?: string;
  result?: string;
}

interface UserContext {
  user: any;
  phoneNumber: string;
  organizationId: string | null;
  organizationName: string | null;
  organizationRole: string | null;
}

async function sendToClaudeCode(prompt: string, userContext?: UserContext): Promise<ClaudeResponse> {
  try {
    console.log('📤 Sending to Claude Code with context:', {
      userId: userContext?.user?.id,
      phoneNumber: userContext?.phoneNumber,
      organizationId: userContext?.organizationId,
      organizationName: userContext?.organizationName,
      role: userContext?.organizationRole
    })

    if(!userContext || !userContext.organizationName || !userContext.phoneNumber) {
      throw new Error('User context is required')
    }

    const sendTo = `${process.env.NEXTJS_APP_BASE_URL || 'http://localhost:3000'}/api/claude-code`

    console.log('DEBUG: Sending to', sendTo)

    const response = await fetch(sendTo, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt.trim(),
        outputFormat: 'stream-json',
        maxTurns: 50,
        continue_conversation: true, // Enable session continuation for SMS
        verbose: false,
        projectPath: `${userContext?.organizationId}/${userContext?.phoneNumber}`,
        requestSource: 'sms',
        // User context for SMS requests
        userContext: userContext ? {
          userId: userContext.user.id,
          phoneNumber: userContext.phoneNumber,
          organizationId: userContext.organizationId,
          organizationName: userContext.organizationName,
          role: userContext.organizationRole,
          requestSource: 'sms'
        } : null
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
              // console.log('SMS DEBUG: SSE Event', {
              //   type: data.type,
              //   hasContent: !!data.content,
              //   contentPreview: data.content ? JSON.stringify(data.content).slice(0, 100) : 'none',
              //   hasResult: !!data.result,
              //   resultPreview: data.result ? JSON.stringify(data.result).slice(0, 100) : 'none'
              // });
              
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
      
      // Find user by phone number
      console.log('🔍 Looking up user by phone number:', fromNumber)
      
      // Try to find user by phone in organization_clients first
      let { data: clientData, error: clientError } = await supabaseAdmin
        .from('organization_clients')
        .select(`
          id,
          phone,
          organization_id,
          role,
          client_profile:organization_clients_profile(
            auth_user_id,
            email,
            full_name,
            phone_number
          )
        `)
        .eq('phone', fromNumber)
        .not('org_client_id', 'is', null)
        .single()

      let user = null
      
      if (clientData?.client_profile) {
        // Handle both array and single object responses
        const profile = Array.isArray(clientData.client_profile) 
          ? clientData.client_profile[0] 
          : clientData.client_profile as any

        if (profile?.auth_user_id) {
          // Get full user data
          const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', profile.auth_user_id)
            .single()
          
          if (userData && !userError) {
            user = userData
          }
        }
      }

      // If not found by organization_clients phone, try by client_profile phone_number
      if (!user) {
        const { data: profileData, error: profileError } = await supabaseAdmin
          .from('organization_clients_profile')
          .select(`
            auth_user_id,
            email,
            full_name,
            phone_number
          `)
          .eq('phone_number', fromNumber)
          .single()

        if (profileData?.auth_user_id) {
          // Get full user data
          const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', profileData.auth_user_id)
            .single()
          
          if (userData && !userError) {
            user = userData
          }
        }
      }

      if (!user) {

        if(fromNumber.trim() != process.env.TELNYX_PHONE_NUMBER?.trim()) {
          console.log('trying send message error:', fromNumber)
          // MAIN PROBLEM CREATING A ENDLESS LOOP. be careful with this.
          await sendSMS(fromNumber, "Hi! I don't have you in my system yet. Please contact support to get set up.")
        }

        console.log('just return')
        
        return NextResponse.json({ success: true })
      }

      // Get user's organization membership - we may have already found this in clientData
      let orgMembership = clientData && clientData.organization_id ? {
        id: clientData.id,
        organization_id: clientData.organization_id,
        role: clientData.role
      } : null

      // If we didn't get org info from clientData, try to find it another way
      if (!orgMembership) {
        const { data: membershipData, error: orgError } = await supabaseAdmin
          .from('organization_clients')
          .select('id, organization_id, role')
          .eq('phone', fromNumber)
          .not('joined_at', 'is', null) // Only get active memberships
          .single()

        if (membershipData && !orgError) {
          orgMembership = membershipData
        } else if (orgError && orgError.code !== 'PGRST116') { // PGRST116 is "no rows found"
          console.error('Error fetching organization membership:', orgError)
        }
      }

      // Get organization details if membership exists
      let organizationName = null
      if (orgMembership?.organization_id) {
        const { data: org } = await supabaseAdmin
          .from('organizations')
          .select('name')
          .eq('id', orgMembership.organization_id)
          .single()
        organizationName = org?.name || null
      }

      const userContext = {
        user,
        phoneNumber: fromNumber,
        organizationId: orgMembership?.organization_id || null,
        organizationName,
        organizationRole: orgMembership?.role || null
      }

      console.log('📱 User context:', {
        userId: user.id,
        userName: user.full_name || user.email,
        phoneNumber: fromNumber,
        organizationId: userContext.organizationId,
        organizationName: userContext.organizationName,
        role: userContext.organizationRole
      })
      
      let result
      
      // Process message - check if it's coding-related first, then handle unified agent
      const codingKeywords = ['code', 'program', 'debug', 'error', 'function', 'variable', 'class', 'javascript', 'python', 'react', 'typescript', 'html', 'css', 'api', 'database', 'bug']
      const lowerText = messageText.toLowerCase()
      const isCodingRelated = codingKeywords.some(keyword => lowerText.includes(keyword))
      
      if (isCodingRelated) {
        result = await processCodingMessage(messageText, userContext)
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
        
        result = await processUnifiedMessage(fullMessage, userContext)
      } else {
        // No media - process as regular text message
        result = await processUnifiedMessage(messageText, userContext)
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
async function processCodingMessage(message: string, userContext: UserContext) {
  try {
    const claudeResponse = await sendToClaudeCode(message, userContext)
    
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
async function processUnifiedMessage(message: string, userContext: UserContext) {
  try {
    // For now, route everything to Claude Code SDK for simplicity
    const claudeResponse = await sendToClaudeCode(message, userContext)
    
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