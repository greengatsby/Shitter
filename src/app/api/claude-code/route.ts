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
  projectPath?: string;
  omitDevToMainPushFlow?: boolean;
  requestSource?: 'sms' | 'web-chat';
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

const MAX_TURNS = 50;

// Utility function to sanitize phone numbers in project paths
function sanitizeProjectPath(projectPath: string): string {
  // Split the path and sanitize each segment that looks like a phone number
  return projectPath.split('/').map(segment => {
    // If segment starts with + and contains mostly digits, it's likely a phone number
    if (segment.startsWith('+') && /^\+[\d\s\-\(\)]+$/.test(segment)) {
      // Sanitize phone number: remove non-alphanumeric chars and replace with underscores
      return segment
        .replace(/[^\w\d]/g, '_')  // Replace non-word chars with underscore
        .replace(/_+/g, '_')       // Replace multiple underscores with single
        .replace(/^_|_$/g, '');    // Remove leading/trailing underscores
    }
    return segment;
  }).join('/');
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

// Utility function to get the dynamic project directory
function getProjectDirectory(): string {
  try {

    const STEER_PROJECTS_DIR_BASE = process.env.STEER_PROJECTS_DIR_BASE;

    if(!STEER_PROJECTS_DIR_BASE) {
      const desktopUsername = process.env.DESKTOP_USERNAME;
      if(!desktopUsername) {
        console.error('[DEBUG] DESKTOP_USERNAME environment variable is not set');
        return '/root/apps/editable-claude-projects';
      }
      console.log(`[DEBUG] STEER_PROJECTS_DIR_BASE is not set`);
      return `/home/${desktopUsername}/apps/editable-claude-projects`;
    }

    // Try multiple approaches to get the correct directory
    const homeDir = os.homedir();
    // Check if STEER_PROJECTS_DIR_BASE is already an absolute path
    let projectDir = path.isAbsolute(STEER_PROJECTS_DIR_BASE) 
      ? STEER_PROJECTS_DIR_BASE 
      : path.join(homeDir, STEER_PROJECTS_DIR_BASE);
    
    // Hardcoded fallback for your specific setup
    const hardcodedDir = '/root/apps/editable-claude-projects';
    
    // console.log(`[DEBUG] Home directory: ${homeDir}`);
    console.log(`[DEBUG] Computed project directory: ${projectDir}`);
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
    let fallback = `/root/apps/editable-claude-projects`;

    if(!desktopUsername) {
      console.error('[DEBUG] DESKTOP_USERNAME environment variable is not set');
      return '/root/apps/editable-claude-projects';
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

  if(streamRequest.requestSource === 'sms') {
    console.log('DEBUG: SMS request source detected');
  } else if(streamRequest.requestSource === 'web-chat') {
    console.log('DEBUG: Web chat request source detected');
  }

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
        const projectDir = streamRequest.projectPath 
          ? path.join(getProjectDirectory(), sanitizeProjectPath(streamRequest.projectPath))
          : getProjectDirectory();

        console.log('DEBUG: Project directory', projectDir);
        const options: any = {
          maxTurns: MAX_TURNS,
          outputFormat: 'stream-json', // Force stream-json for real-time updates
          verbose: streamRequest.verbose || true,
          // Add permission mode to bypass all prompts in streaming mode (including bash commands)
          permissionMode: 'bypassPermissions',
          // Set working directory to the custom or default project directory
          cwd: projectDir,
        };

        console.log('DEBUG: Max turns', options.maxTurns);

        // Add session management
        if (sessionId) {
          options.resume = sessionId;
          logWithSession('info', 'Resuming session', sessionId, `Attempting to resume session: ${sessionId}`);
        } else if (streamRequest.continue_conversation && streamRequest.requestSource !== 'sms') {
          // Only continue conversations for web-chat, not SMS (to avoid path confusion)
          options.continue = true;
          logWithSession('info', 'Continuing most recent conversation', sessionId, 'Using continue option instead of specific session ID');
        } else {
          logWithSession('info', 'Creating new session', sessionId, 'No session ID provided, will create new session');
        }

        // Log the exact options being sent to SDK for debugging
        logWithSession('debug', 'Claude Code SDK Options', sessionId, JSON.stringify({
          resume: options.resume,
          continue: options.continue,
          cwd: options.cwd,
          permissionMode: options.permissionMode
        }));

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
        const readinessInstruction = `\n\nCRITICAL STREAMING EVENT INSTRUCTION: This is a streaming API that sends real-time events to the frontend. Before doing ANYTHING, you MUST assess if you need information from the user:\n\n**[NEED_MORE_INFO] USAGE**: ONLY use '[NEED_MORE_INFO]' if you need clarification FROM THE USER and will STOP/TERMINATE the request waiting for user input. DO NOT use this flag if you can figure things out yourself (like searching for files, reading code, etc.). If you can proceed by using tools to gather information, just do it.\n\n**[READY_TO_PROCEED] USAGE**: If you have enough information OR can gather the needed information using available tools, start with '[READY_TO_PROCEED]' and continue with your work.\n\nThese markers are REQUIRED for every request and serve as signals to the streaming frontend.\n\n🚨 **ABSOLUTE CRITICAL CONSTRAINT - WORKING DIRECTORY BASE**: Your entire working environment is STRICTLY CONFINED to this EXACT directory as your ABSOLUTE BASE: \`${projectDir}\`\n\nThis directory is your UNIVERSE. You cannot and must not access, reference, or operate on anything outside of this directory tree.\n\n⛔ **FORBIDDEN ACTIONS - NEVER DO THESE**:\n- DO NOT use ANY tool with paths outside \`${projectDir}\`\n- DO NOT use absolute paths like \`/home/not-root-ismael/apps/editable-claude-projects\` or parent directories\n- DO NOT navigate to parent directories with \`../\` or similar\n- DO NOT access sibling directories\n- DO NOT use tools like LS, CAT, EDIT, WRITE, BASH with paths outside your working directory\n- DO NOT reference files or directories that exist outside \`${projectDir}\`\n\n✅ **ALLOWED ACTIONS - YOUR OPERATING SCOPE**:\n- Use ALL tools (LS, CAT, EDIT, WRITE, BASH, etc.) with relative paths within your working directory\n- Navigate within subdirectories of \`${projectDir}\` using relative paths\n- Create, read, edit, delete files within \`${projectDir}\` and its subdirectories\n- Run commands that operate within your working directory scope\n- Use \`.\` or no path arguments for current directory operations\n- Use relative paths like \`./subfolder\`, \`subfolder/file.txt\`, etc.\n\n🎯 **YOUR ABSOLUTE BASE DIRECTORY**: \`${projectDir}\`\n\n🔒 **ENFORCEMENT**: Every file operation, command execution, and directory navigation MUST be relative to and contained within \`${projectDir}\`. This is your sandbox - there is nothing outside of it that exists for you.`;

        // Flexible prompt analysis instruction
        const flexibleAnalysisInstruction = `\n\n🧠 **INTELLIGENT PROMPT ANALYSIS**: Be smart about interpreting user requests and avoid unnecessary clarification requests. Follow these guidelines:\n\n**PROCEED WITHOUT ASKING when:**\n- User asks about the current project/app in your working directory\n- User references files, code, or functionality within the current project directory\n- The request is clear enough that you can determine what to do within the current project scope\n- You can reasonably infer what the user wants based on the current project structure\n\n**ASK FOR CLARIFICATION only when:**\n- The user's request is genuinely ambiguous within the context of the current project\n- There are multiple valid interpretations that would lead to significantly different responses\n- You need specific details about implementation that cannot be inferred from existing code\n\n**EXPLORATION STRATEGY**: Start by exploring your current working directory (\`${projectDir}\`) to understand the project structure. Use tools like \`ls\` to see what's available in the current project before deciding if you need clarification. You are working within a specific project context, so focus on that project only.`;
        
        // Git workflow instructions (conditional based on omitDevToMainPushFlow)
        let gitWorkflowInstruction = "";
        
        if (!streamRequest.omitDevToMainPushFlow) {
          gitWorkflowInstruction = "\n\n🚨 MANDATORY GIT WORKFLOW: For ANY code changes, you MUST complete this ENTIRE workflow. Do NOT end the conversation until all steps are complete!\n\n**WORKFLOW ENFORCEMENT**: After making ANY code edit, you MUST immediately proceed to git workflow steps. Failure to complete git workflow is considered task failure.\n\n**STEP-BY-STEP REQUIREMENTS**:\n\n1. **IDENTIFY PROJECT**: Extract project path from file paths you're editing\n\n2. **GIT STATUS CHECK**: Run 'cd /path/to/project && git status' to verify git repo and current branch\n\n3. **SWITCH TO DEV BRANCH**: \n   - Run 'cd /path/to/project && git checkout dev' \n   - If dev doesn't exist: 'cd /path/to/project && git checkout -b dev'\n   - **MANDATORY PULL**: 'cd /path/to/project && git fetch && git pull origin dev'\n\n4. **MAKE CODE CHANGES**: Edit/create files as requested\n\n5. **GIT STATUS VERIFICATION**: Run 'cd /path/to/project && git status' to confirm files were changed\n\n6. **STAGE AND COMMIT**: \n   - Stage: 'cd /path/to/project && git add .'\n   - Commit: 'cd /path/to/project && git commit -m \"[Specific change description]\"'\n\n7. **PUSH TO DEV**: \n   - Push: 'cd /path/to/project && git push origin dev'\n   - Verify: 'cd /path/to/project && git log --oneline -1' to confirm push\n\n8. **MANDATORY FLAG**: You MUST end with '[CONFIRM_TO_PROD] Changes committed and pushed to dev branch. Review changes and confirm deployment to production.'\n\n9. **PRODUCTION DEPLOYMENT APPROVAL HANDLING**: \n   - After you've sent [CONFIRM_TO_PROD], monitor subsequent user messages for approval\n   - **APPROVAL DETECTION**: Look for ANY positive confirmation including but not limited to:\n     * Direct approval: \"approved\", \"approve\", \"yes\", \"deploy\", \"go ahead\", \"proceed\"\n     * Casual approval: \"yeah go ahead\", \"looks good\", \"ship it\", \"deploy it\", \"make it live\"\n     * Affirmative responses: \"ok\", \"okay\", \"sure\", \"do it\", \"yes please\", \"confirmed\"\n   - **REJECTION DETECTION**: Look for negative responses like \"no\", \"stop\", \"cancel\", \"wait\", \"not yet\", \"needs changes\"\n   - **IF APPROVED**: Immediately proceed with production deployment:\n     * 'cd /path/to/project && git checkout main'\n     * 'cd /path/to/project && git merge dev'\n     * 'cd /path/to/project && git push origin main'\n     * Confirm completion: 'cd /path/to/project && git log --oneline -1'\n   - **IF REJECTED**: Acknowledge and ask what changes are needed\n   - **IF UNCLEAR**: Ask for clear confirmation before proceeding\n\n🚨 **CRITICAL RULES**:\n- NEVER skip git workflow steps\n- NEVER end conversation without [CONFIRM_TO_PROD] flag (unless user approves and you complete production deployment)\n- EVERY code change = FULL git workflow\n- Use 'cd /path/to/project &&' prefix for ALL git commands\n- NEVER run 'npm run build' or any build commands - deployment handles building automatically\n- Be intelligent about detecting approval intent - don't require exact words";
        } else {
          gitWorkflowInstruction = "\n\n📝 **SIMPLIFIED WORKFLOW**: Git workflow automation is disabled for this session. Make your changes directly without automated git operations. You can manually commit and push changes as needed.";
        }
        
        if (streamRequest.appendSystemPrompt) {
          options.appendSystemPrompt = streamRequest.appendSystemPrompt + readinessInstruction + flexibleAnalysisInstruction + gitWorkflowInstruction;
        } else {
          options.appendSystemPrompt = readinessInstruction + flexibleAnalysisInstruction + gitWorkflowInstruction;
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
          // `options: ${JSON.stringify(options)}`
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
            const previousSessionId = currentSessionId;
            currentSessionId = message.session_id;
            
            if (previousSessionId === sessionId) {
              // This is the expected case for first message when we provided a session ID
              logWithSession('info', 'Session confirmed', currentSessionId, 
                `Successfully resumed session: ${sessionId}`);
            } else if (!previousSessionId && sessionId) {
              // We requested a specific session but got a different one - SDK failed to resume
              logWithSession('error', 'SESSION RESUME FAILED', currentSessionId, 
                `Requested session: ${sessionId}, but SDK created new session: ${message.session_id}. Session may have expired or SDK resume is broken.`);
            } else if (!previousSessionId) {
              // First session ID received for new session (expected for fresh starts)
              logWithSession('info', 'New session created', currentSessionId, 
                `New session started with ID: ${message.session_id}`);
            } else {
              // Unexpected session change mid-conversation
              logWithSession('error', 'UNEXPECTED SESSION ID CHANGE', currentSessionId, 
                `Expected: ${previousSessionId}, Got: ${message.session_id}. This indicates SDK is not resuming sessions properly.`);
            }
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
              // logWithSession('debug', 'Checking for [READY_TO_PROCEED] in text', message.session_id, `Text length: ${contentText.length}, Contains marker: ${contentText.includes('[READY_TO_PROCEED]')}`);
              
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
              
              if (contentText.includes('[CONFIRM_TO_PROD]')) {
                // Replace the entire message content with fixed approval text and dev URL
                const approvalMessage = 'Changes Applied Successfully! Approve these changes to be applied to main by including the word "approved" in your answer.\n\nDev view: https://calculator-steer-by-wire-test-git-dev-dane-myers-projects.vercel.app/';
                
                logWithSession('debug', 'CONFIRM_TO_PROD detected - replacing content', message.session_id, 
                  `Original content type: ${typeof assistantEvent.content}, Original: ${JSON.stringify(assistantEvent.content).slice(0, 100)}`);
                
                // Replace the assistant event content completely
                if (typeof assistantEvent.content === 'string') {
                  assistantEvent.content = approvalMessage;
                  logWithSession('debug', 'Replaced string content', message.session_id, 'Content replaced with approval message');
                } else if (Array.isArray(assistantEvent.content)) {
                  // Replace with single text block
                  assistantEvent.content = [{ type: 'text', text: approvalMessage }];
                  logWithSession('debug', 'Replaced array content', message.session_id, 'Content replaced with approval message array');
                } else if (assistantEvent.content && typeof assistantEvent.content === 'object') {
                  // Replace object content
                  assistantEvent.content = { type: 'text', text: approvalMessage };
                  logWithSession('debug', 'Replaced object content', message.session_id, 'Content replaced with approval message object');
                }
                
                logWithSession('debug', 'Content after replacement', message.session_id, 
                  `New content: ${JSON.stringify(assistantEvent.content).slice(0, 100)}`);
                
                const confirmToProdEvent = {
                  type: 'confirm_to_prod',
                  session_id: message.session_id,
                  status: 'awaiting_prod_confirmation',
                  message: 'Changes committed to dev branch, awaiting confirmation to deploy to production'
                };
                controller.enqueue(new TextEncoder().encode(createSSEData('confirm_to_prod_status', confirmToProdEvent)));
                
                logWithSession('info', 'Claude awaiting prod confirmation detected', message.session_id, '[CONFIRM_TO_PROD] marker found');
              }
              
              controller.enqueue(new TextEncoder().encode(createSSEData('claude_event', assistantEvent)));
              break;

            case 'result':
              finalResult = message;
              
              // Check if the result contains CONFIRM_TO_PROD and modify it
              let resultToSend = (message as any).result;
              if (resultToSend && typeof resultToSend === 'string' && resultToSend.includes('[CONFIRM_TO_PROD]')) {
                const approvalMessage = 'Changes Applied Successfully! Approve these changes to be applied to main by including the word "approved" in your answer.\n\nDev view: https://calculator-steer-by-wire-test-git-dev-dane-myers-projects.vercel.app/';
                resultToSend = approvalMessage;
                logWithSession('debug', 'CONFIRM_TO_PROD found in result - replaced', message.session_id, 'Result content replaced with approval message');
              }
              
              const resultEvent = {
                type: 'result',
                subtype: message.subtype,
                session_id: message.session_id,
                result: resultToSend,
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
