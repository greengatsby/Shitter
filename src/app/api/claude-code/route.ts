import { query, type SDKMessage } from "@anthropic-ai/claude-code";
import { NextRequest, NextResponse } from "next/server";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";

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

event: complete
data: {"success":true,"session_id":"bf54324f-3b63-409e-95e7-784937a1abe3","total_events":3,"final_result":{"type":"result","subtype":"success","is_error":false,"duration_ms":11589,"duration_api_ms":8792,"num_turns":1,"result":"[NEED_MORE_INFO]\n\nI need more details to help you change text:\n\n1. Which folder are you referring to?\n2. What specific text do you want to change?\n3. What should it be changed to?\n4. Are you looking to change text in a specific file, or across multiple files?","session_id":"bf54324f-3b63-409e-95e7-784937a1abe3","total_cost_usd":0.0169029,"usage":{"input_tokens":3,"cache_creation_input_tokens":3408,"cache_read_input_tokens":10013,"output_tokens":74,"server_tool_use":{"web_search_requests":0}}}}


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

// Utility function to get the dynamic project directory
function getProjectDirectory(): string {
  try {
    // Try multiple approaches to get the correct directory
    const homeDir = os.homedir();
    let projectDir = path.join(homeDir, 'editable-claude-projects');
    
    // Hardcoded fallback for your specific setup
    const hardcodedDir = '/home/ismae/editable-claude-projects';
    
    // console.log(`[DEBUG] Home directory: ${homeDir}`);
    // console.log(`[DEBUG] Computed project directory: ${projectDir}`);
    // console.log(`[DEBUG] Hardcoded directory: ${hardcodedDir}`);
    // console.log(`[DEBUG] Process CWD: ${process.cwd()}`);
    // console.log(`[DEBUG] Environment user: ${process.env.USER || process.env.USERNAME || 'unknown'}`);
    
    // If the hardcoded path exists and the computed one doesn't, use hardcoded
    if (fs.existsSync(hardcodedDir) && !fs.existsSync(projectDir)) {
      // console.log(`[DEBUG] Using hardcoded directory as it exists`);
      projectDir = hardcodedDir;
    }
    
    // Check if directory exists
    const dirExists = fs.existsSync(projectDir);
    // console.log(`[DEBUG] Directory exists: ${dirExists}`);
    
    // Ensure the directory exists
    if (!dirExists) {
      // console.log(`[DEBUG] Creating directory: ${projectDir}`);
      fs.mkdirSync(projectDir, { recursive: true });
      // console.log(`[DEBUG] Directory created successfully`);
    }
    
    // Verify we can access the directory
    try {
      const stats = fs.statSync(projectDir);
      console.log(`[DEBUG] Directory stats - isDirectory: ${stats.isDirectory()}, mode: ${stats.mode}`);
    } catch (statError) {
      console.error(`[DEBUG] Error getting directory stats:`, statError);
    }
    
    // console.log(`[DEBUG] Final project directory: ${projectDir}`);
    return projectDir;
  } catch (error) {
    // console.error('[DEBUG] Error in getProjectDirectory:', error);

    const desktopUsername = process.env.DESKTOP_USERNAME;
    // Last resort - use the hardcoded path
    let fallback = `/home/${desktopUsername}/editable-claude-projects`;

    if(!desktopUsername) {
      console.error('[DEBUG] DESKTOP_USERNAME environment variable is not set');
      return '/home/ismae/editable-claude-projects';
    }

    console.log(`[DEBUG] Using hardcoded fallback: ${fallback}`);
    return fallback;
  }
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
        const projectDir = getProjectDirectory();
        const options: any = {
          maxTurns: streamRequest.maxTurns || 10,
          outputFormat: 'stream-json', // Force stream-json for real-time updates
          verbose: streamRequest.verbose || true,
          // Add permission mode to bypass all prompts in streaming mode (including bash commands)
          permissionMode: 'bypassPermissions',
          // Set working directory to the dynamic project directory
          cwd: projectDir,
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
        
        // Always add context validation instruction unless custom system prompt is provided
        if (!streamRequest.systemPrompt) {
          options.systemPrompt = "You are a helpful AI assistant.";
        } else {
          options.systemPrompt = streamRequest.systemPrompt;
        }
        
        // Always append the readiness instruction (this ensures it's always included)
        const readinessInstruction = "\n\nCRITICAL STREAMING EVENT INSTRUCTION: This is a streaming API that sends real-time events to the frontend. Before doing ANYTHING (including using tools, reading files, or providing explanations), you MUST first assess if you need more information from the user. If you need clarification, start your response with '[NEED_MORE_INFO]' followed by your questions - this will trigger a 'needs_info' event for the frontend. If you have enough information to proceed with the user's request, start your very first response with '[READY_TO_PROCEED]' as the first text - this will trigger a readiness event in the streaming response that tells the frontend you're starting work. Then continue with your actual work. These markers '[NEED_MORE_INFO]' and '[READY_TO_PROCEED]' are REQUIRED for every request and serve as signals to the streaming frontend.";
        
        if (streamRequest.appendSystemPrompt) {
          options.appendSystemPrompt = streamRequest.appendSystemPrompt + readinessInstruction;
        } else {
          options.appendSystemPrompt = readinessInstruction;
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
          'Using project directory',
          sessionId,
          `directory: ${projectDir}`
        );

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
              
              // Check if Claude is indicating readiness to proceed
              const content = message.message.content;
              let contentText = '';
              
              // Debug: Log the raw content structure
              logWithSession('debug', 'Assistant message content received', message.session_id, JSON.stringify(content));
              
              // Extract text content from different message formats
              if (typeof content === 'string') {
                contentText = content;
                logWithSession('debug', 'Content is string', message.session_id, contentText.slice(0, 100));
              } else if (Array.isArray(content)) {
                contentText = content
                  .map((block: any) => {
                    if (typeof block === 'string') return block;
                    if (block?.text) return block.text;
                    if (block?.type === 'text' && block?.text) return block.text;
                    return '';
                  })
                  .join('');
                logWithSession('debug', 'Content is array, extracted text', message.session_id, contentText.slice(0, 100));
              } else if (content && typeof content === 'object' && content.text) {
                contentText = content.text;
                logWithSession('debug', 'Content is object with text', message.session_id, contentText.slice(0, 100));
              }
              
              // Debug: Always log what we're checking
              logWithSession('debug', 'Checking for [READY_TO_PROCEED] in text', message.session_id, `Text length: ${contentText.length}, Contains marker: ${contentText.includes('[READY_TO_PROCEED]')}`);
              
              if (contentText.includes('[READY_TO_PROCEED]')) {
                const readinessEvent = {
                  type: 'readiness',
                  session_id: message.session_id,
                  status: 'ready_to_proceed',
                  message: 'Claude has sufficient context and is beginning work'
                };
                controller.enqueue(new TextEncoder().encode(createSSEData('readiness_status', readinessEvent)));
                
                logWithSession('info', 'Claude readiness detected', message.session_id, '[READY_TO_PROCEED] marker found');
              }
              
              if (contentText.includes('[NEED_MORE_INFO]')) {
                const needsInfoEvent = {
                  type: 'needs_info',
                  session_id: message.session_id,
                  status: 'needs_more_info',
                  message: 'Claude needs additional information to proceed'
                };
                controller.enqueue(new TextEncoder().encode(createSSEData('needs_info_status', needsInfoEvent)));
                
                logWithSession('info', 'Claude needs more info detected', message.session_id, '[NEED_MORE_INFO] marker found');
              }
              
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
