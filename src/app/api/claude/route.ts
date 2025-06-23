import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdir, writeFile, access } from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

interface LogCallback {
  (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any): void;
}

const createLogger = (sessionId?: string): LogCallback => {
  return (level, message, data) => {
    const timestamp = new Date().toISOString();
    const prefix = sessionId ? `[${sessionId.slice(0, 8)}]` : '[No Session]';
    const logMessage = `${timestamp} ${prefix} ${message}`;
    
    switch (level) {
      case 'error':
        console.error('❌', logMessage, data || '');
        break;
      case 'warn':
        console.warn('⚠️', logMessage, data || '');
        break;
      case 'debug':
        console.debug('🔍', logMessage, data || '');
        break;
      default:
        console.log('ℹ️', logMessage, data || '');
    }
  };
};

// Create Claude Code permissions settings for the project
async function ensureClaudePermissions(workingDir: string, log: LogCallback) {
  try {
    const claudeDir = path.join(workingDir, '.claude');
    const settingsFile = path.join(claudeDir, 'settings.local.json');
    
    // Check if settings already exist
    try {
      await access(settingsFile);
      log('info', 'Claude permissions already configured');
      return;
    } catch {
      // File doesn't exist, create it
    }
    
    // Create .claude directory
    await mkdir(claudeDir, { recursive: true });
    
    // Define permissions for common development tasks
    const settings = {
      permissions: {
        allow: [
          "Edit(**)", // Allow editing any file in the project
          "Read(**)", // Allow reading any file in the project
          "Bash(npm:*)", // Allow npm commands
          "Bash(git:*)", // Allow git commands
          "Bash(mkdir:*)", // Allow creating directories
          "Bash(ls:*)", // Allow listing directories
          "Bash(cat:*)", // Allow reading files via cat
          "Bash(touch:*)", // Allow creating files via touch
          "Bash(cp:*)", // Allow copying files
          "Bash(mv:*)", // Allow moving files
          "Bash(rm:*)", // Allow removing files (be careful!)
          "Bash(find:*)", // Allow find commands
          "Bash(grep:*)", // Allow grep commands
          "Bash(chmod:*)", // Allow changing permissions
          "Bash(node:*)", // Allow running node
          "Bash(npx:*)" // Allow npx commands
        ],
        deny: [
          "Bash(curl:*)", // Deny external network requests for security
          "Bash(wget:*)", // Deny external downloads
          "Bash(sudo:*)" // Deny sudo commands for security
        ]
      }
    };
    
    await writeFile(settingsFile, JSON.stringify(settings, null, 2));
    log('info', 'Created Claude permissions settings', { settingsFile });
    
  } catch (error) {
    log('warn', 'Failed to create Claude permissions settings', error);
    // Don't fail the request, just continue
  }
}

export async function POST(request: NextRequest) {
  const log = createLogger();
  
  try {
    const { 
      prompt, 
      outputFormat = 'json', 
      session_id,
      continue_conversation = false,
      systemPrompt,
      appendSystemPrompt,
      allowedTools,
      disallowedTools,
      maxTurns = 10
    } = await request.json();

    if (!prompt) {
      log('error', 'No prompt provided');
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Validate that ANTHROPIC_API_KEY is set
    if (!process.env.ANTHROPIC_API_KEY) {
      log('error', 'ANTHROPIC_API_KEY not configured');
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY environment variable is required' },
        { status: 500 }
      );
    }

    log('info', 'Processing prompt', { 
      prompt: prompt.slice(0, 100) + '...',
      hasSessionId: !!session_id,
      continueConversation: continue_conversation
    });

    // Handle simple folder creation directly
    if (prompt.toLowerCase().includes('create a folder') && prompt.toLowerCase().includes('components')) {
      log('info', 'Handling folder creation request');
      try {
        const folderPath = path.join(process.cwd(), 'src', 'components', 'landing');
        await mkdir(folderPath, { recursive: true });
        
        const successMessage = `Successfully created folder at ${folderPath}`;
        log('info', 'Folder created successfully', { folderPath });
        
        return NextResponse.json({
          type: "result",
          subtype: "success",
          result: successMessage,
          is_error: false,
          session_id: null
        });
      } catch (folderError) {
        log('error', 'Failed to create folder', folderError);
        return NextResponse.json(
          { 
            error: 'Failed to create folder', 
            details: folderError instanceof Error ? folderError.message : 'Unknown error'
          },
          { status: 500 }
        );
      }
    }

    // Escape the prompt for shell execution
    const escapedPrompt = prompt.replace(/"/g, '\\"');
    
    // Build the claude command using SDK session management
    let claudeCommand = 'echo "y" | claude -p';
    
    // Add session management flags
    if (session_id) {
      claudeCommand += ` --resume "${session_id}"`;
      log('info', 'Resuming session', { sessionId: session_id });
    } else if (continue_conversation) {
      claudeCommand += ' --continue';
      log('info', 'Continuing most recent conversation');
    }
    
    // Add the prompt
    claudeCommand += ` "${escapedPrompt}. and include in the resp how many tokens used."`;
    
    // Add output format
    claudeCommand += ` --output-format ${outputFormat}`;

     // Pre-authorize common tools for file operations
    claudeCommand += ` --allowedTools "Edit,Write,Read,Bash(git*),Bash(npm*),Bash(node*)"`;
    
    // Add optional parameters
    if (systemPrompt) {
      const escapedSystemPrompt = systemPrompt.replace(/"/g, '\\"');
      claudeCommand += ` --system-prompt "${escapedSystemPrompt}"`;
    }
    
    if (appendSystemPrompt) {
      const escapedAppendPrompt = appendSystemPrompt.replace(/"/g, '\\"');
      claudeCommand += ` --append-system-prompt "${escapedAppendPrompt}"`;
    }
    
    if (allowedTools) {
      claudeCommand += ` --allowedTools "${allowedTools}"`;
    }
    
    if (disallowedTools) {
      claudeCommand += ` --disallowedTools "${disallowedTools}"`;
    }
    
    if (maxTurns) {
      claudeCommand += ` --max-turns ${maxTurns}`;
    }
    
    log('info', 'Executing Claude command', { 
      outputFormat,
      hasSessionId: !!session_id,
      continueConversation: continue_conversation,
      command: claudeCommand,
      workingDir: process.cwd()
    });

    // Ensure Claude has proper permissions configured for this project
    await ensureClaudePermissions(process.cwd(), log);

    // Execute the claude command
    const { stdout, stderr } = await execAsync(claudeCommand, {
      cwd: process.cwd(),
      env: { ...process.env },
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      timeout: 600000, // 10 minute timeout
    });

    console.log('stdout', stdout);
    console.log('stderr', stderr);

    log('info', 'Claude command completed', { 
      stdoutLength: stdout.length, 
      hasStderr: !!stderr 
    });

    if (stderr) {
      log('error', 'Claude command stderr', stderr);
      return NextResponse.json(
        { error: 'Claude command failed', details: stderr },
        { status: 500 }
      );
    }

    // Parse the response based on output format
    let response;
    if (outputFormat === 'json') {
      try {
        response = JSON.parse(stdout);
        log('info', 'Successfully parsed JSON response', {
          type: response.type,
          sessionId: response.session_id
        });
      } catch (parseError) {
        log('error', 'Failed to parse JSON response', parseError);
        return NextResponse.json(
          { error: 'Failed to parse Claude response as JSON', raw: stdout },
          { status: 500 }
        );
      }
    } else {
      response = { 
        type: "result",
        subtype: "success",
        result: stdout,
        is_error: false
      };
      log('info', 'Using raw text response');
    }

    log('info', 'Request completed successfully', { 
      responseType: outputFormat,
      sessionId: response.session_id
    });

    return NextResponse.json(response);

  } catch (error) {
    log('error', 'Claude API error', error);
    
    // Check if it's a timeout error
    if (error instanceof Error && error.message.includes('timeout')) {
      log('warn', 'Command timed out');
      return NextResponse.json(
        { 
          error: 'Claude command timed out', 
          details: 'The code generation task took too long to complete. Try breaking it into smaller tasks.'
        },
        { status: 408 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Return general API information and Claude Code SDK capabilities
  return NextResponse.json({
    message: 'Claude Code API endpoint with native SDK session support',
    usage: {
      post: 'POST with { prompt: string, outputFormat?: "json" | "text", session_id?: string, continue_conversation?: boolean, systemPrompt?: string, appendSystemPrompt?: string, allowedTools?: string, disallowedTools?: string, maxTurns?: number }',
      get: 'GET for API information',
      put: 'PUT to setup Claude permissions'
    },
    features: {
      session_management: 'Built-in Claude Code SDK session support',
      output_formats: ['json', 'text', 'stream-json'],
      custom_prompts: 'System prompt customization',
      tool_control: 'Allowed/disallowed tools configuration',
      turn_limits: 'Maximum turns configuration',
      permission_management: 'Automatic project-level permission setup'
    },
    environment: {
      hasApiKey: !!process.env.ANTHROPIC_API_KEY,
    },
    sdk_features: {
      native_sessions: true,
      resume_by_id: true,
      continue_recent: true,
      custom_system_prompts: true,
      tool_filtering: true,
      project_permissions: true
    }
  });
}

export async function PUT(request: NextRequest) {
  const log = createLogger();
  
  try {
    const { action } = await request.json();
    
    if (action === 'setup-permissions') {
      log('info', 'Manual permission setup requested');
      
      try {
        await ensureClaudePermissions(process.cwd(), log);
        
        return NextResponse.json({
          success: true,
          message: 'Claude permissions configured successfully',
          location: path.join(process.cwd(), '.claude', 'settings.local.json')
        });
        
      } catch (error) {
        log('error', 'Failed to setup permissions', error);
        return NextResponse.json(
          { 
            error: 'Failed to setup permissions', 
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Invalid action. Use { "action": "setup-permissions" }' },
      { status: 400 }
    );
    
  } catch (error) {
    log('error', 'PUT request error', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}