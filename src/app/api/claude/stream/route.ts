import { NextRequest } from 'next/server';
import { spawn } from 'child_process';

interface StreamChunk {
  type: 'stdout' | 'stderr' | 'complete' | 'error' | 'start';
  data?: string;
  code?: number;
  error?: string;
  timestamp: string;
  sessionId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { 
      prompt, 
      session_id,
      continue_conversation = false,
      verbose = true,
      outputFormat = 'json',
      allowedTools,
      disallowedTools,
      maxTurns = 10
    } = await request.json();

    if (!prompt) {
      return new Response('Prompt is required', { status: 400 });
    }

    const stream = new ReadableStream({
      start(controller) {
        const sendChunk = (chunk: StreamChunk) => {
          const data = `data: ${JSON.stringify(chunk)}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));
        };

        sendChunk({
          type: 'start',
          data: 'Starting Claude Code session...',
          timestamp: new Date().toISOString()
        });

        const claudeArgs: string[] = ['-p'];
        
        if (verbose) {
        //   claudeArgs.push('--verbose', '--debug');
        }
        
        if (session_id) {
          claudeArgs.push('--resume', session_id);
        } else if (continue_conversation) {
          claudeArgs.push('--continue');
        }
        
        claudeArgs.push('--output-format', outputFormat);
        
        const defaultTools = 'Edit,Write,Read,Bash(git*),Bash(npm*),Bash(node*),Bash(npx*),Bash(mkdir*),Bash(ls*),Bash(cat*),Bash(touch*),Bash(cp*),Bash(mv*)';
        claudeArgs.push('--allowedTools', allowedTools || defaultTools);
        
        if (disallowedTools) {
          claudeArgs.push('--disallowedTools', disallowedTools);
        }
        
        if (maxTurns) {
          claudeArgs.push('--max-turns', maxTurns.toString());
        }
        
        claudeArgs.push(`${prompt}. Please include token usage information in your response.`);

        console.log('Spawning Claude with args:', claudeArgs);

        const claudeProcess = spawn('claude', claudeArgs, {
          cwd: process.cwd(),
          env: { 
            ...process.env,
            FORCE_COLOR: '0'
          },
          stdio: ['pipe', 'pipe', 'pipe']
        });

        claudeProcess.stdin?.write('y\n');
        claudeProcess.stdin?.end();

        let accumulatedOutput = '';
        let sessionId: string | undefined;

        claudeProcess.stdout?.on('data', (data) => {
          const output = data.toString();
          accumulatedOutput += output;
          
          const sessionMatch = output.match(/Session ID: ([a-f0-9-]+)/i);
          if (sessionMatch) {
            sessionId = sessionMatch[1];
          }

          sendChunk({
            type: 'stdout',
            data: output,
            timestamp: new Date().toISOString(),
            sessionId
          });
        });

        claudeProcess.stderr?.on('data', (data) => {
          const output = data.toString();
          
          sendChunk({
            type: 'stderr',
            data: output,
            timestamp: new Date().toISOString(),
            sessionId
          });
        });

        claudeProcess.on('close', (code) => {
          console.log(`Claude process exited with code: ${code}`);
          
          sendChunk({
            type: 'complete',
            code: code || 0,
            data: accumulatedOutput,
            timestamp: new Date().toISOString(),
            sessionId
          });
          
          controller.close();
        });

        claudeProcess.on('error', (error) => {
          console.error('Claude process error:', error);
          
          sendChunk({
            type: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
          });
          
          controller.close();
        });

        request.signal?.addEventListener('abort', () => {
          console.log('Request aborted, killing Claude process');
          claudeProcess.kill('SIGTERM');
          controller.close();
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('Streaming endpoint error:', error);
    return new Response(
      `data: ${JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })}\n\n`,
      {
        status: 500,
        headers: {
          'Content-Type': 'text/event-stream',
        },
      }
    );
  }
}