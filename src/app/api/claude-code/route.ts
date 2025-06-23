import { query, type SDKMessage } from "@anthropic-ai/claude-code";
import { NextRequest, NextResponse } from "next/server";

// Type definitions matching the request structure
interface StreamRequest {
  prompt: string;
  session_id?: string;
  continue_conversation?: boolean;
  systemPrompt?: string;
  appendSystemPrompt?: string;
  allowedTools?: string;
  disallowedTools?: string;
  maxTurns?: number;
  outputFormat?: 'json' | 'text' | 'stream-json';
  verbose?: boolean;
}

interface StreamResponse {
  success: boolean;
  error?: string;
  details?: string;
  session_id?: string;
  message: string;
}

interface FinalResponse {
  success: boolean;
  session_id?: string;
  total_events: number;
  final_result?: any;
  error?: string;
}

// Utility function to create SSE formatted data
function createSSEData(event: string, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// Utility function to log with session context
function logWithSession(level: 'info' | 'error' | 'warn' | 'debug', message: string, sessionId?: string, data?: string) {
  const timestamp = new Date().toISOString();
  const prefix = sessionId ? `[${sessionId.slice(0, 8)}]` : '[No Session]';
  const logMessage = `${timestamp} ${prefix} ${message}`;
  
  console.log(`${level.toUpperCase()}: ${logMessage}${data ? ` ${data}` : ''}`);
}

// GET endpoint for simple streaming queries
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const prompt = searchParams.get('q') || 'Hello, Claude!';
  const sessionId = searchParams.get('session_id') || undefined;
  const maxTurns = parseInt(searchParams.get('max_turns') || '10');

  const streamRequest: StreamRequest = {
    prompt,
    session_id: sessionId,
    maxTurns,
    continue_conversation: false,
    outputFormat: 'stream-json',
    verbose: true
  };

  return handleStreamRequest(streamRequest);
}

// POST endpoint for full streaming Claude Code execution
export async function POST(request: NextRequest) {
  try {
    const body: StreamRequest = await request.json();
    return handleStreamRequest(body);
  } catch (error) {
    console.error('Failed to parse request body:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

// Main streaming handler
async function handleStreamRequest(streamRequest: StreamRequest): Promise<Response> {
  const sessionId = streamRequest.session_id;

  // Validate that ANTHROPIC_API_KEY is set
  if (!process.env.ANTHROPIC_API_KEY) {
    logWithSession('error', 'ANTHROPIC_API_KEY not configured', sessionId);
    
    const errorResponse: StreamResponse = {
      success: false,
      error: 'ANTHROPIC_API_KEY environment variable is required',
      session_id: sessionId,
      message: 'API key missing'
    };

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(createSSEData('error', errorResponse)));
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  logWithSession(
    'info',
    'Starting streaming request',
    sessionId,
    `prompt: ${streamRequest.prompt.slice(0, 50)}..., hasSessionId: ${!!sessionId}`
  );

  // Create the streaming response
  const stream = new ReadableStream({
    async start(controller) {
      let eventCount = 0;
      let finalResult: any = null;
      let currentSessionId = sessionId;

      try {
        // Prepare Claude Code SDK options
        const options: any = {
          maxTurns: streamRequest.maxTurns || 10,
          outputFormat: 'stream-json', // Force stream-json for real-time updates
          verbose: streamRequest.verbose || true,
          // Add permission mode to bypass prompts in streaming mode
          permissionMode: 'acceptEdits',
        };

        // Add session management
        if (sessionId) {
          options.resume = sessionId;
          logWithSession('info', 'Resuming session', sessionId, sessionId);
        } else if (streamRequest.continue_conversation) {
          options.continue = true;
          logWithSession('info', 'Continuing most recent conversation', sessionId);
        }

        // Add system prompts
        if (streamRequest.systemPrompt) {
          options.systemPrompt = streamRequest.systemPrompt;
        }
        if (streamRequest.appendSystemPrompt) {
          options.appendSystemPrompt = streamRequest.appendSystemPrompt;
        }

        // Add tool configuration
        if (streamRequest.allowedTools) {
          options.allowedTools = streamRequest.allowedTools.split(',').map(t => t.trim());
        } else {
          // Default allowed tools for development
          options.allowedTools = ['Edit', 'Write', 'Read', 'Bash(git*)', 'Bash(npm*)', 'Bash(node*)'];
        }

        if (streamRequest.disallowedTools) {
          options.disallowedTools = streamRequest.disallowedTools.split(',').map(t => t.trim());
        }

        logWithSession(
          'info',
          'Executing Claude Code SDK query',
          sessionId,
          `options: ${JSON.stringify(options)}`
        );

        // Create abort controller for cleanup
        const abortController = new AbortController();

        // Use Claude Code SDK to stream messages
        const messageIterator = query({
          prompt: streamRequest.prompt,
          abortController,
          options
        });

        for await (const message of messageIterator) {
          eventCount++;
          
          // Extract session ID from messages
          if (message.session_id && message.session_id !== currentSessionId) {
            currentSessionId = message.session_id;
            logWithSession('info', 'Session ID updated', currentSessionId, currentSessionId);
          }

          // Handle different message types
          switch (message.type) {
            case 'system':
              if (message.subtype === 'init') {
                const initEvent = {
                  type: 'system',
                  subtype: 'init',
                  session_id: message.session_id,
                  cwd: message.cwd,
                  tools: message.tools,
                  model: message.model,
                  permissionMode: message.permissionMode,
                  apiKeySource: message.apiKeySource,
                  mcp_servers: message.mcp_servers || []
                };
                controller.enqueue(new TextEncoder().encode(createSSEData('claude_event', initEvent)));
              }
              break;

            case 'user':
              const userEvent = {
                type: 'user',
                session_id: message.session_id,
                content: message.message.content
              };
              controller.enqueue(new TextEncoder().encode(createSSEData('claude_event', userEvent)));
              break;

            case 'assistant':
              const assistantEvent = {
                type: 'assistant',
                session_id: message.session_id,
                content: message.message.content,
                role: message.message.role
              };
              controller.enqueue(new TextEncoder().encode(createSSEData('claude_event', assistantEvent)));
              break;

            case 'result':
              finalResult = message;
              const resultEvent = {
                type: 'result',
                subtype: message.subtype,
                session_id: message.session_id,
                result: (message as any).result,
                is_error: message.is_error,
                duration_ms: message.duration_ms,
                duration_api_ms: message.duration_api_ms,
                num_turns: message.num_turns,
                total_cost_usd: message.total_cost_usd
              };
              controller.enqueue(new TextEncoder().encode(createSSEData('claude_event', resultEvent)));
              break;

            default:
              // Handle any other message types
              controller.enqueue(new TextEncoder().encode(createSSEData('claude_event', message)));
          }
        }

        // Send final completion event
        const finalResponse: FinalResponse = {
          success: true,
          session_id: currentSessionId,
          total_events: eventCount,
          final_result: finalResult,
          error: undefined
        };

        controller.enqueue(new TextEncoder().encode(createSSEData('complete', finalResponse)));
        
        logWithSession(
          'info',
          currentSessionId || '',
          'Streaming completed',
          `total_events: ${eventCount}`
        );

      } catch (error) {
        console.error('Claude Code SDK error:', error);
        
        const errorResponse: StreamResponse = {
          success: false,
          error: 'Claude Code SDK execution failed',
          details: error instanceof Error ? error.message : String(error),
          session_id: currentSessionId,
          message: 'SDK execution error'
        };

        controller.enqueue(new TextEncoder().encode(createSSEData('error', errorResponse)));
        
        logWithSession('error', currentSessionId || '', 'SDK execution failed', error instanceof Error ? error.message : String(error));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
