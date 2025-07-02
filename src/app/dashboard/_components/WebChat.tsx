'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Send, Copy, Trash2, Settings, MessageSquare, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Member, Repository } from '../web-chat/_types';

// Claude Code API response interface
interface ClaudeResponse {
  content?: string;
  raw_json?: any;
  success: boolean;
  error?: string;
  details?: string;
  type?: string;
  subtype?: string;
  result?: string;
  is_error?: boolean;
  session_id?: string;
  metadata?: any;
}

interface ConversationEntry {
  id: string;
  timestamp: Date;
  prompt: string;
  response: ClaudeResponse;
  settings: RequestSettings;
}

interface RequestSettings {
  outputFormat: 'json' | 'text';
  sessionId: string;
  continueConversation: boolean;
  systemPrompt: string;
  appendSystemPrompt: string;
  allowedTools: string;
  disallowedTools: string;
  maxTurns: number;
  verbose: boolean;
}

interface ComponentProps {
    member: Member
    repository?: Repository,
    projectPath?: string,
    omitDevToMainPushFlow?: boolean,
}

export default function ClaudeTestPage({ member, repository, projectPath, omitDevToMainPushFlow }: ComponentProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ClaudeResponse | null>(null);
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamOutput, setStreamOutput] = useState<string[]>([]);
  const [streamSessionId, setStreamSessionId] = useState<string>('');
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [debugEditOutput, setDebugEditOutput] = useState<string[]>([]);
  const [claudeReadinessStatus, setClaudeReadinessStatus] = useState<'gathering_info' | 'needs_more_info' | 'ready_to_proceed' | 'working' | 'awaiting_prod_confirmation' | null>(null);
  const [deployLoading, setDeployLoading] = useState(false);
  const deployTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Settings state
  const [settings, setSettings] = useState<RequestSettings>({
    outputFormat: 'json',
    sessionId: '',
    continueConversation: true, // Always enabled for automatic session continuation
    systemPrompt: '',
    appendSystemPrompt: '',
    allowedTools: '',
    disallowedTools: '',
    maxTurns: 50,
    verbose: false
  });

  const responseRef = useRef<HTMLDivElement>(null);
  const deploymentCardRef = useRef<HTMLDivElement>(null);
  const CLAUDE_API = '/api/claude-code';

  // Helper function to extract text content from Claude messages
  const extractMessageContent = (content: any): string => {
    if (!content) return '';
    
    // If it's already a string, return it
    if (typeof content === 'string') return content;
    
    // If it's an array (Claude's content blocks format)
    if (Array.isArray(content)) {
      return content
        .map((block: any) => {
          if (typeof block === 'string') return block;
          if (block?.text) return block.text;
          if (block?.type === 'text' && block?.text) return block.text;
          if (block?.type === 'tool_use') return `[Tool: ${block.name}]`;
          return JSON.stringify(block);
        })
        .join('');
    }
    
    // If it's an object, try to extract text
    if (typeof content === 'object') {
      if (content.text) return content.text;
      if (content.content) return extractMessageContent(content.content);
      // For objects without clear text, show a summary instead of [object Object]
      return `[${content.type || 'Content'}: ${Object.keys(content).join(', ')}]`;
    }
    
    return String(content);
  };

  // Auto-scroll to latest response
  useEffect(() => {
    if (response && responseRef.current) {
      responseRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [response]);

  // Auto-scroll to deployment card when it appears
  useEffect(() => {
    if (claudeReadinessStatus === 'awaiting_prod_confirmation' && deploymentCardRef.current) {
      deploymentCardRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [claudeReadinessStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setLoading(true);
    setResponse(null);

    try {
      // Build request body for Claude Code API
      const requestBody = {
        prompt: prompt.trim(),
        outputFormat: settings.outputFormat,
        maxTurns: settings.maxTurns,
        // Include session management
        ...(settings.sessionId && { session_id: settings.sessionId }),
        ...(settings.continueConversation && { continue_conversation: true }),
        // Include optional parameters only if they have values
        ...(settings.systemPrompt && { systemPrompt: settings.systemPrompt }),
        ...(settings.appendSystemPrompt && { appendSystemPrompt: settings.appendSystemPrompt }),
        ...(settings.allowedTools && { allowedTools: settings.allowedTools }),
        ...(settings.disallowedTools && { disallowedTools: settings.disallowedTools }),
      };

      console.log('Sending request to Claude Code API:', requestBody);

      const res = await fetch(CLAUDE_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      console.log('Claude Code API response:', data);
      
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setResponse(data);
      
      // Add to conversation history
      const conversationEntry: ConversationEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        prompt: prompt.trim(),
        response: data,
        settings: { ...settings }
      };
      
      setConversations(prev => [conversationEntry, ...prev]);
      
      // Auto-update session ID if returned from API
      if (data.session_id && data.session_id !== settings.sessionId) {
        setSettings(prev => ({ ...prev, sessionId: data.session_id }));
        toast.success(`Session ID updated: ${data.session_id.slice(0, 8)}...`);
      }

      // Clear prompt after successful submission
      setPrompt('');
      
      if (data.success) {
        toast.success('Request completed successfully');
      } else {
        toast.error(`Request failed: ${data.error || 'Unknown error'}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResponse: ClaudeResponse = {
        success: false,
        error: errorMessage,
        details: 'Request failed',
        is_error: true
      };
      setResponse(errorResponse);
      toast.error(`Request failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const clearHistory = () => {
    setConversations([]);
    toast.success('History cleared');
  };

  const loadPromptFromHistory = (entry: ConversationEntry) => {
    setPrompt(entry.prompt);
    setSettings(entry.settings);
    toast.success('Loaded from history');
  };

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
      }
    };
  }, [eventSource]);

  // Claude Code SDK streaming
  // Helper function to stream with a specific prompt (for programmatic usage)
  const handleClaudeCodeStreamingWithPrompt = async (specificPrompt: string) => {
    if (!specificPrompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    
    return await executeClaudeCodeStreaming(specificPrompt);
  };

  const handleClaudeCodeStreaming = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    
    return await executeClaudeCodeStreaming(prompt);
  };

  // Core streaming logic extracted to avoid duplication
  const executeClaudeCodeStreaming = async (promptToUse: string) => {

    // Close existing EventSource if any
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }

    setStreaming(true);
    setStreamOutput([]);
    setResponse(null);
    setDebugEditOutput([]);
    setClaudeReadinessStatus('gathering_info');

    try {
      // Build request body for Claude Code API
      // Use streamSessionId (most recent) or settings.sessionId (user-specified) for continuation
      const activeSessionId = streamSessionId || settings.sessionId;
      
      const requestBody = {
        prompt: promptToUse.trim(),
        maxTurns: settings.maxTurns,
        outputFormat: 'stream-json',
        verbose: true,
        // Session management logic: 
        // 1. If we have a session ID, try to resume (but SDK might ignore it)
        // 2. If we have no session ID but have had previous conversations, continue recent
        // 3. If this is the very first conversation, start fresh (no flags)
        // Note: Claude Code SDK sometimes ignores resume and creates new sessions
        ...(activeSessionId 
          ? { session_id: activeSessionId } 
          : streamSessionId // Only use continue if we've had a session before
            ? { continue_conversation: true }
            : {} // Fresh start - no session flags
        ),
        // Include optional parameters only if they have values
        ...(settings.systemPrompt && { systemPrompt: settings.systemPrompt }),
        ...(settings.appendSystemPrompt && { appendSystemPrompt: settings.appendSystemPrompt }),
        ...(settings.allowedTools && { allowedTools: settings.allowedTools }),
        ...(settings.disallowedTools && { disallowedTools: settings.disallowedTools }),
        // Include new parameters passed from parent
        ...(projectPath && { projectPath }),
        ...(omitDevToMainPushFlow !== undefined && { omitDevToMainPushFlow }),
      };

      // Log session information for debugging
      console.log('Session Management:', {
        streamSessionId,
        settingsSessionId: settings.sessionId,
        activeSessionId,
        requestMode: activeSessionId ? 'resume_specific_session' : 
                     streamSessionId ? 'continue_recent_session' : 'fresh_start',
        hasSessionId: !!(requestBody as any).session_id,
        hasContinueConversation: !!(requestBody as any).continue_conversation,
        isFirstConversation: !streamSessionId && !settings.sessionId
      });

      setStreamOutput(prev => [...prev, `🚀 [${new Date().toLocaleTimeString()}] Starting Claude Code stream...`]);
      console.log('Starting Claude Code stream with request:', requestBody);

      const fetchResponse = await fetch(CLAUDE_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!fetchResponse.ok) {
        throw new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`);
      }

      if (!fetchResponse.body) {
        throw new Error('No response body');
      }

      const reader = fetchResponse.body.getReader();
      const decoder = new TextDecoder();
      let eventCount = 0;
      let currentSessionId = '';
      let finalClaudeResponse: ClaudeResponse | null = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          
          // Split by double newlines to separate SSE messages
          const messages = chunk.split('\n\n');
          
          for (const message of messages) {
            if (!message.trim()) continue;
            
            let eventType = 'claude_event';
            let eventData = '';
            
            // Parse SSE format
            const lines = message.split('\n');
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                eventData = line.slice(6);
              }
            }
            
            if (!eventData) continue;
            
            try {
              const data = JSON.parse(eventData);
              eventCount++;
              const timestamp = new Date().toLocaleTimeString();
              
              console.log(`Claude Event (${eventType}):`, data);

              // Extract session ID if present
              if (data.session_id && data.session_id !== currentSessionId) {
                currentSessionId = data.session_id;
                setStreamSessionId(currentSessionId);
                if (currentSessionId !== settings.sessionId) {
                  setSettings(prev => ({ ...prev, sessionId: currentSessionId }));
                }
              }

              // Handle different event types
              switch (eventType) {
                case 'claude_event':
                  switch (data.type) {
                    case 'system':
                      if (data.subtype === 'init') {
                        setStreamOutput(prev => [...prev, `🚀 [${timestamp}] Claude is ready with ${data.tools?.length || 0} tools available`]);
                      }
                      break;
                    case 'user':
                      // Only show user input if it's not a tool result
                      if (!data.content?.some((c: any) => c.type === 'tool_result')) {
                        const userContent = extractMessageContent(data.content || data.message?.content);
                        if (userContent && !userContent.includes('tool_use_id')) {
                          setStreamOutput(prev => [...prev, `👤 [${timestamp}] You: ${userContent}`]);
                        }
                      }
                      break;
                    case 'assistant':
                      const content = data.content || [];
                      
                      // Handle tool usage
                      const toolUses = content.filter((c: any) => c.type === 'tool_use');
                      const textContent = content.filter((c: any) => c.type === 'text');
                      
                      if (toolUses.length > 0) {
                        const toolNames = toolUses.map((tool: any) => tool.name).join(', ');
                        setStreamOutput(prev => [...prev, `🔧 [${timestamp}] Claude is using: ${toolNames}`]);
                        
                        // Show edit details for Edit and MultiEdit tools
                        toolUses.forEach((tool: any) => {
                          if (tool.name === 'Edit' && tool.input) {
                            const filePath = tool.input.file_path || 'file';
                            setStreamOutput(prev => [...prev, `   📝 Editing: ${filePath.split('/').pop() || filePath}`]);
                            
                            if (tool.input.old_string && tool.input.new_string) {
                              // Add to debug output
                              setDebugEditOutput(prev => [
                                ...prev,
                                `old_string:\n${tool.input.old_string}`,
                                `new_string:\n${tool.input.new_string}`
                              ]);
                              
                              // Always show a brief preview of what's being changed
                              const oldPreview = tool.input.old_string.split('\n')[0].slice(0, 60);
                              const newPreview = tool.input.new_string.split('\n')[0].slice(0, 60);
                              setStreamOutput(prev => [...prev, `   🔄 ${oldPreview}${tool.input.old_string.length > 60 ? '...' : ''} → ${newPreview}${tool.input.new_string.length > 60 ? '...' : ''}`]);
                              
                              if (settings.verbose) {
                                setStreamOutput(prev => [...prev, `   🔍 Old Code:`]);
                                const oldLines = tool.input.old_string.split('\n').slice(0, 5);
                                oldLines.forEach((line: string) => {
                                  setStreamOutput(prev => [...prev, `     - ${line}`]);
                                });
                                if (tool.input.old_string.split('\n').length > 5) {
                                  setStreamOutput(prev => [...prev, `     ... (${tool.input.old_string.split('\n').length - 5} more lines)`]);
                                }
                                
                                setStreamOutput(prev => [...prev, `   ✨ New Code:`]);
                                const newLines = tool.input.new_string.split('\n').slice(0, 5);
                                newLines.forEach((line: string) => {
                                  setStreamOutput(prev => [...prev, `     + ${line}`]);
                                });
                                if (tool.input.new_string.split('\n').length > 5) {
                                  setStreamOutput(prev => [...prev, `     ... (${tool.input.new_string.split('\n').length - 5} more lines)`]);
                                }
                              }
                            }
                          } else if (tool.name === 'MultiEdit' && tool.input && tool.input.edits) {
                            const filePath = tool.input.file_path || 'file';
                            setStreamOutput(prev => [...prev, `   📝 Multi-editing: ${filePath.split('/').pop() || filePath} (${tool.input.edits.length} changes)`]);
                            
                                                          // Add MultiEdit to debug output
                              tool.input.edits.forEach((edit: any, index: number) => {
                                if (edit.old_string && edit.new_string) {
                                  setDebugEditOutput(prev => [
                                    ...prev,
                                    `old_string (Edit ${index + 1}):\n${edit.old_string}`,
                                    `new_string (Edit ${index + 1}):\n${edit.new_string}`
                                  ]);
                                }
                              });
                              
                              if (settings.verbose) {
                                tool.input.edits.forEach((edit: any, index: number) => {
                                  setStreamOutput(prev => [...prev, `   📌 Edit ${index + 1}:`]);
                                  if (edit.old_string && edit.new_string) {
                                    setStreamOutput(prev => [...prev, `     🔍 Old: ${edit.old_string.split('\n')[0].slice(0, 50)}${edit.old_string.length > 50 ? '...' : ''}`]);
                                    setStreamOutput(prev => [...prev, `     ✨ New: ${edit.new_string.split('\n')[0].slice(0, 50)}${edit.new_string.length > 50 ? '...' : ''}`]);
                                  }
                                });
                              }
                          } else if (['Read', 'Write', 'LS', 'Bash'].includes(tool.name) && tool.input) {
                            // Show useful info for other common tools
                            if (tool.input.file_path) {
                              setStreamOutput(prev => [...prev, `   📁 File: ${tool.input.file_path.split('/').pop() || tool.input.file_path}`]);
                            } else if (tool.input.path) {
                              setStreamOutput(prev => [...prev, `   📁 Path: ${tool.input.path.split('/').pop() || tool.input.path}`]);
                            } else if (tool.input.command) {
                              setStreamOutput(prev => [...prev, `   💻 Command: ${tool.input.command.slice(0, 50)}${tool.input.command.length > 50 ? '...' : ''}`]);
                            } else if (settings.verbose && Object.keys(tool.input).length > 0) {
                              setStreamOutput(prev => [...prev, `   🔍 Input: ${JSON.stringify(tool.input).slice(0, 80)}...`]);
                            }
                          }
                        });
                      }
                      
                      if (textContent.length > 0) {
                        const text = textContent.map((c: any) => c.text).join('');
                        if (text.trim()) {
                          // Check if this is an API error message
                          if (text.includes('API Error:') || text.includes('"type":"error"')) {
                            setStreamOutput(prev => [...prev, `❌ [${timestamp}] ${text}`]);
                            toast.error('Claude encountered an API error');
                            
                            // Stop streaming on API error
                            setStreaming(false);
                            setDeployLoading(false);
                            setClaudeReadinessStatus(null);
                          } else {
                            setStreamOutput(prev => [...prev, `🤖 [${timestamp}] Claude: ${text}`]);
                          }
                        }
                      }
                      break;
                    case 'result':
                      // Check if this is an error result
                      if (data.is_error) {
                        setStreamOutput(prev => [...prev, `❌ [${timestamp}] Error: ${data.result || 'Task failed'}`]);
                        toast.error(`Task failed: ${data.result || 'Unknown error'}`);
                        
                        // Stop streaming on error result
                        setStreaming(false);
                        setDeployLoading(false);
                        setClaudeReadinessStatus(null);
                      } else {
                        setStreamOutput(prev => [...prev, `✨ [${timestamp}] ${data.result || 'Task completed'}`]);
                        if (settings.verbose && data.duration_ms && data.total_cost_usd) {
                          setStreamOutput(prev => [...prev, `   💰 ${data.duration_ms}ms • $${data.total_cost_usd.toFixed(4)}`]);
                        }
                      }
                      
                      // Set the final response
                      finalClaudeResponse = {
                        success: !data.is_error,
                        type: data.type,
                        subtype: data.subtype,
                        result: data.result,
                        session_id: data.session_id,
                        content: data.result,
                        raw_json: data,
                        is_error: data.is_error
                      };
                      setResponse(finalClaudeResponse);
                      break;
                    default:
                      if (settings.verbose) {
                        setStreamOutput(prev => [...prev, `📋 [${timestamp}] ${data.type || 'Event'}: ${JSON.stringify(data)}`]);
                      }
                  }
                  break;

                case 'complete':
                  const summary = data.final_result;
                  if (summary) {
                    setStreamOutput(prev => [...prev, `🎯 [${timestamp}] Conversation complete!`]);
                    if (settings.verbose && summary.num_turns) {
                      setStreamOutput(prev => [...prev, `   📊 ${summary.num_turns} turns • ${summary.duration_ms}ms • $${summary.total_cost_usd?.toFixed(4) || '0'}`]);
                    }
                  } else {
                    setStreamOutput(prev => [...prev, `🎯 [${timestamp}] Stream completed`]);
                  }
                  
                  if (data.session_id && data.session_id !== settings.sessionId) {
                    setSettings(prev => ({ ...prev, sessionId: data.session_id }));
                    toast.success(`Session updated`);
                  }

                  // Add to conversation history
                  if (finalClaudeResponse) {
                    const conversationEntry: ConversationEntry = {
                      id: Date.now().toString(),
                      timestamp: new Date(),
                      prompt: prompt.trim(),
                      response: finalClaudeResponse,
                      settings: { ...settings }
                    };
                    setConversations(prev => [conversationEntry, ...prev]);
                  }

                  // Reset all streaming states
                  setStreaming(false);
                  setDeployLoading(false);
                  
                  // Clear deploy timeout if it exists
                  if (deployTimeoutRef.current) {
                    clearTimeout(deployTimeoutRef.current);
                    deployTimeoutRef.current = null;
                  }
                  
                  setPrompt('');
                  
                  // Show appropriate completion message
                  if (data.success === false || (finalClaudeResponse && finalClaudeResponse.is_error)) {
                    toast.error('Conversation completed with errors');
                  } else {
                    toast.success('Conversation completed!');
                  }
                  return; // Exit the while loop

                case 'readiness_status':
                  if (data.status === 'ready_to_proceed') {
                    setClaudeReadinessStatus('ready_to_proceed');
                    setStreamOutput(prev => [...prev, `🚀 [${timestamp}] Claude is ready to proceed with the task!`]);
                    toast.success('Claude has enough context and is starting work!');
                    
                    // After a brief moment, update to working status
                    setTimeout(() => {
                      setClaudeReadinessStatus('working');
                    }, 1000);
                  }
                  break;

                case 'needs_info_status':
                  if (data.status === 'needs_more_info') {
                    setClaudeReadinessStatus('needs_more_info');
                    setStreamOutput(prev => [...prev, `❓ [${timestamp}] Claude needs more information to proceed`]);
                    toast.info('Claude is asking for more details');
                  }
                  break;

                case 'confirm_to_prod_status':
                  if (data.status === 'awaiting_prod_confirmation') {
                    setClaudeReadinessStatus('awaiting_prod_confirmation');
                    setDeployLoading(false); // Reset deploy loading state
                    setStreamOutput(prev => [...prev, `🚀 [${timestamp}] Changes committed and pushed to dev branch - awaiting confirmation to deploy to production`]);
                    toast.success('Changes pushed to dev branch!', {
                      description: 'Review the changes on GitHub and confirm deployment when ready'
                    });
                  }
                  break;

                case 'error':
                  setStreamOutput(prev => [...prev, `❌ [${timestamp}] ${data.error || 'Something went wrong'}`]);
                  if (settings.verbose && data.details) {
                    setStreamOutput(prev => [...prev, `   🔍 ${data.details}`]);
                  }
                  toast.error(`Error: ${data.error || 'Unknown error'}`);
                  
                  // Stop streaming on error
                  setStreaming(false);
                  setDeployLoading(false);
                  setClaudeReadinessStatus(null);
                  break;

                default:
                  setStreamOutput(prev => [...prev, `📋 [${timestamp}] ${eventType}: ${JSON.stringify(data)}`]);
              }
            } catch (parseError) {
              console.error('Failed to parse SSE data:', parseError);
              setStreamOutput(prev => [...prev, `❌ [${new Date().toLocaleTimeString()}] Parse error: ${eventData}`]);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Claude Code streaming error:', error);
      setStreamOutput(prev => [...prev, `❌ Setup failed: ${errorMessage}`]);
      setStreaming(false);
      setDeployLoading(false); // Reset deploy loading state on error
      toast.error(`Streaming failed: ${errorMessage}`);
    }
  };

  // Function to stop streaming manually
  const stopStreaming = () => {
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }
    setStreaming(false);
    toast.info('Streaming stopped');
  };

  // Render response function
  const renderResponse = (res: ClaudeResponse) => {
    if (!res.success || res.is_error) {
      return (
        <Alert className="border-red-200 bg-red-50">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Error:</strong> {res.error}
            {res.details && (
              <div className="mt-2 text-sm">{res.details}</div>
            )}
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          {res.type && <Badge variant="secondary">{res.type}</Badge>}
          {res.subtype && <Badge variant="outline">{res.subtype}</Badge>}
          {res.session_id && (
            <Badge variant="default" className="font-mono text-xs">
              Session: {res.session_id.slice(0, 8)}...
            </Badge>
          )}
          <Badge variant="default" className="text-xs bg-blue-100 text-blue-800">
            Claude Code API
          </Badge>
        </div>
        
        {/* Main result content */}
        {(res.result || res.content) && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Response</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(res.result || res.content || '')}
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <pre className="whitespace-pre-wrap text-sm font-mono text-gray-800">
              {res.result || res.content}
            </pre>
          </div>
        )}

        {/* Raw JSON from API */}
        {res.raw_json && (
          <div className="bg-blue-50 rounded-lg p-4">
            <details>
              <summary className="cursor-pointer text-sm font-medium text-blue-800 mb-2">
                📋 Raw JSON Response
              </summary>
              <pre className="whitespace-pre-wrap text-xs text-blue-700 bg-blue-100 p-2 rounded max-h-60 overflow-y-auto">
                {JSON.stringify(res.raw_json, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* Session Information */}
        {res.session_id && (
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-green-800">
              <strong>Session ID:</strong> 
              <code className="ml-2 bg-green-100 px-2 py-1 rounded text-xs font-mono">
                {res.session_id}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="ml-2"
                onClick={() => copyToClipboard(res.session_id || '')}
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Claude Code Interface</h1>
          <p className="text-muted-foreground">
            Interact with Claude using the official Anthropic Claude Code SDK
          </p>
          <Badge variant="default" className="bg-blue-100 text-blue-800">
            Powered by @anthropic-ai/claude-code
          </Badge>
        </div>

        <div className="flex items-center gap-4">
            {/* Member Info */}
            <p className="text-sm text-muted-foreground">Member: {member.user.full_name || member.user.email}</p>
            {/* Repository Info */}
            <p className="text-sm text-muted-foreground">Repository: {repository?.name || 'Multiple repositories'}</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Input Panel */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Send Prompt
                </CardTitle>
                <CardDescription>
                  Enter your prompt to send to Claude
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="prompt">Prompt</Label>
                    <Textarea
                      id="prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Ask Claude to help with coding, create files, explain code, etc..."
                      className="min-h-32 resize-y"
                      disabled={loading || streaming}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Button 
                        type="button"
                        variant="outline"
                        disabled={loading || !prompt.trim()}
                        onClick={streaming ? stopStreaming : handleClaudeCodeStreaming}
                      >
                        {streaming ? (
                          <>
                            <XCircle className="w-4 h-4 mr-2" />
                            Stop Stream
                          </>
                        ) : (
                          <>
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Stream Response
                          </>
                        )}
                      </Button>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      Send Request: Single response | Stream Response: Real-time streaming
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Production Deployment Confirmation */}
            {claudeReadinessStatus === 'awaiting_prod_confirmation' && (
              <Card className="border-purple-200 bg-purple-50" ref={deploymentCardRef}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-800">
                    🚀 Ready for Production Deployment
                    <Badge variant="default" className="bg-purple-100 text-purple-800">
                      Dev → Main
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-purple-700">
                    Changes have been committed and pushed to the dev branch. Review the changes on GitHub and confirm to deploy to main/production.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      <Button 
                        onClick={() => {
                          setDeployLoading(true);
                          
                          // Use a small delay to ensure state updates have been processed
                          setTimeout(() => {
                            // Directly call the streaming function with the deploy prompt
                            handleClaudeCodeStreamingWithPrompt("Yes, deploy to production. Push the changes to main branch.");
                          }, 50); // Small delay to ensure UI updates
                        }}
                        className="bg-purple-600 hover:bg-purple-700"
                        disabled={streaming || deployLoading}
                      >
                        {deployLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            Deploying...
                          </>
                        ) : (
                          <>
                            ✅ Deploy to Production
                          </>
                        )}
                      </Button>
                      
                      {deployLoading && (
                        <Button 
                          variant="destructive"
                          onClick={() => {
                            setDeployLoading(false);
                            setStreaming(false);
                            if (deployTimeoutRef.current) {
                              clearTimeout(deployTimeoutRef.current);
                              deployTimeoutRef.current = null;
                            }
                            toast.info("Deployment cancelled. You can try again.");
                          }}
                        >
                          ❌ Cancel Deployment
                        </Button>
                      )}
                      
                      <Button 
                        variant="outline"
                        onClick={() => {
                          // This will be implemented later for reverting commits
                          toast.info("Revert functionality coming soon");
                        }}
                        disabled={true}
                        className="opacity-50 cursor-not-allowed"
                      >
                        🔄 Revert Commit & Start Again
                      </Button>
                      <Button 
                        variant="secondary"
                        asChild
                        className="bg-blue-100 hover:bg-blue-200 text-blue-800"
                      >
                        <a 
                          href="https://calculator-steer-by-wire-test-git-dev-dane-myers-projects.vercel.app/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2"
                        >
                          🌐 View changes in live app
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            
                          {/* Streaming Output Display */}
              {(streaming || streamOutput.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${streaming ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'}`} />
                      Live Stream Output
                      <Badge variant="outline" className="text-xs">
                        Claude Code SDK
                      </Badge>
                      {streamSessionId && (
                        <Badge variant="default" className="font-mono text-xs">
                          Session: {streamSessionId.slice(0, 8)}...
                        </Badge>
                      )}
                      {claudeReadinessStatus && (
                        <Badge 
                          variant={claudeReadinessStatus === 'ready_to_proceed' ? 'default' : claudeReadinessStatus === 'working' ? 'secondary' : claudeReadinessStatus === 'awaiting_prod_confirmation' ? 'default' : 'outline'} 
                          className={`text-xs font-medium ${
                            claudeReadinessStatus === 'gathering_info' ? 'bg-yellow-100 text-yellow-800' :
                            claudeReadinessStatus === 'needs_more_info' ? 'bg-orange-100 text-orange-800' :
                            claudeReadinessStatus === 'ready_to_proceed' ? 'bg-green-100 text-green-800' :
                            claudeReadinessStatus === 'working' ? 'bg-blue-100 text-blue-800' :
                            claudeReadinessStatus === 'awaiting_prod_confirmation' ? 'bg-purple-100 text-purple-800' : ''
                          }`}
                        >
                          {claudeReadinessStatus === 'gathering_info' ? '🤔 Gathering Info' :
                           claudeReadinessStatus === 'needs_more_info' ? '❓ Needs More Info' :
                           claudeReadinessStatus === 'ready_to_proceed' ? '🚀 Ready to Proceed' :
                           claudeReadinessStatus === 'working' ? '⚡ Working' :
                           claudeReadinessStatus === 'awaiting_prod_confirmation' ? '🚀 Ready for Production' : ''}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-96 w-full border rounded-lg p-4 bg-black text-green-400 font-mono text-xs">
                      {streamOutput.length === 0 && streaming && (
                        <div className="text-yellow-400">🔄 Connecting to Claude...</div>
                      )}
                      {streamOutput.map((line, index) => (
                        <div key={index} className="mb-1">
                          {line}
                        </div>
                      ))}
                      {streaming && streamOutput.length > 0 && (
                        <div className="flex items-center gap-1 text-green-300">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                          <span>Connected & Listening...</span>
                        </div>
                      )}
                      {!streaming && streamOutput.length > 0 && (
                        <div className="text-gray-400 mt-2">
                          📋 Stream completed. Use "Stream Response" to start a new stream.
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Debug Edit Output */}
              {debugEditOutput.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-orange-500" />
                      Debug: Edit Strings
                      <Badge variant="destructive" className="text-xs">
                        Debug Mode
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDebugEditOutput([])}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Parse debugEditOutput into grouped edits */}
                    <ScrollArea className="h-96 w-full border rounded-lg p-4 bg-gray-900 text-white font-mono text-xs">
                      {(() => {
                        // Group old_string/new_string pairs
                        const edits: { old: string; new: string; editIndex?: number; fileName?: string }[] = [];
                        let i = 0;
                        while (i < debugEditOutput.length) {
                          const oldEntry = debugEditOutput[i];
                          const newEntry = debugEditOutput[i + 1];
                          let editIndex: number | undefined = undefined;
                          let fileName: string | undefined = undefined;
                          // Try to extract edit index and file name from label
                          const oldMatch = oldEntry.match(/old_string(?: \(Edit (\d+)\))?:\\n([\s\S]*)/);
                          const newMatch = newEntry && newEntry.match(/new_string(?: \(Edit (\d+)\))?:\\n([\s\S]*)/);
                          if (oldMatch && newMatch) {
                            editIndex = oldMatch[1] ? parseInt(oldMatch[1], 10) : undefined;
                            // Try to extract file name from the first line if present
                            // (Not available in current debugEditOutput, but could be added in the future)
                            edits.push({
                              old: oldMatch[2],
                              new: newMatch[2],
                              editIndex,
                              fileName,
                            });
                          } else {
                            // fallback: just use the string after the label
                            edits.push({
                              old: oldEntry.replace(/^old_string.*?:\\n/, ''),
                              new: newEntry ? newEntry.replace(/^new_string.*?:\\n/, '') : '',
                            });
                          }
                          i += 2;
                        }
                        return edits.map((edit, idx) => (
                          <details key={idx} open className="mb-6 border-b border-gray-700 pb-2">
                            <summary className="cursor-pointer text-sm font-semibold mb-2 flex items-center gap-2">
                              <span className="text-orange-300">{edit.fileName || 'Edit'}{typeof edit.editIndex === 'number' ? ` #${edit.editIndex}` : ''}</span>
                            </summary>
                            <div className="flex flex-col md:flex-row gap-4">
                              {/* Old String */}
                              <div className="w-full md:w-1/2">
                                <div className="text-xs text-red-300 mb-1">old_string</div>
                                <pre className="bg-gray-800 text-red-200 rounded p-2 overflow-x-auto whitespace-pre-wrap border border-red-900">
                                  <code>
                                    {edit.old.split('\n').map((line, i) => (
                                      <div key={i} className="flex"><span className="text-gray-500 select-none w-8 text-right pr-2">{i + 1}</span>{line}</div>
                                    ))}
                                  </code>
                                </pre>
                              </div>
                              {/* New String */}
                              <div className="w-full md:w-1/2">
                                <div className="text-xs text-green-300 mb-1">new_string</div>
                                <pre className="bg-gray-800 text-green-200 rounded p-2 overflow-x-auto whitespace-pre-wrap border border-green-900">
                                  <code>
                                    {edit.new.split('\n').map((line, i) => (
                                      <div key={i} className="flex"><span className="text-gray-500 select-none w-8 text-right pr-2">{i + 1}</span>{line}</div>
                                    ))}
                                  </code>
                                </pre>
                              </div>
                            </div>
                          </details>
                        ));
                      })()}
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

            {/* Response Display */}
            {response && (
              <Card ref={responseRef}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Response
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(JSON.stringify(response, null, 2))}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {renderResponse(response)}
                </CardContent>
              </Card>
            )}

          </div>

          {/* Settings & History Panel */}
          <div className="space-y-6">
            <Tabs defaultValue="settings" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </TabsTrigger>
                <TabsTrigger value="history">
                  <Clock className="w-4 h-4 mr-2" />
                  History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="history">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Conversation History</CardTitle>
                      {conversations.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearHistory}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {conversations.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        No conversations yet
                      </p>
                    ) : (
                      <ScrollArea className="h-96">
                        <div className="space-y-3">
                          {conversations.map((entry) => (
                            <div
                              key={entry.id}
                              className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={() => loadPromptFromHistory(entry)}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant={(!entry.response.success || entry.response.is_error) ? "destructive" : "default"}>
                                  {(!entry.response.success || entry.response.is_error) ? "Error" : "Success"}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {entry.timestamp.toLocaleTimeString()}
                                </span>
                              </div>
                              <p className="text-sm font-medium truncate">
                                {entry.prompt}
                              </p>
                              {entry.response.session_id && (
                                <p className="text-xs text-muted-foreground font-mono mt-1">
                                  Session: {entry.response.session_id.slice(0, 8)}...
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

// const old_setings = (
//     <TabsContent value="settings" className="space-y-4">
//     <Card>
//       <CardHeader>
//         <CardTitle className="text-lg">Request Settings</CardTitle>
//       </CardHeader>
//       <CardContent className="space-y-4">
//         <div>
//           <Label htmlFor="outputFormat">Output Format</Label>
//           <Select
//             value={settings.outputFormat}
//             onValueChange={(value: 'json' | 'text') => 
//               setSettings(prev => ({ ...prev, outputFormat: value }))
//             }
//           >
//             <SelectTrigger>
//               <SelectValue />
//             </SelectTrigger>
//             <SelectContent>
//               <SelectItem value="json">JSON</SelectItem>
//               <SelectItem value="text">Text</SelectItem>
//             </SelectContent>
//           </Select>
//         </div>

//         <Separator />

//         {/* Permissions Section */}
//         <div className="space-y-4">
//           <div>
//             <Label className="text-base font-semibold">Permissions</Label>
//             <p className="text-xs text-muted-foreground mt-1">
//               Automatically pre-authorized tools for Claude operations
//             </p>
//           </div>
          
//           <div className="bg-green-50 border border-green-200 rounded-lg p-3">
//             <p className="text-xs text-green-800">
//               <strong>Auto-enabled tools:</strong> Edit, Write, Read, Git, NPM, Node commands
//             </p>
//             <p className="text-xs text-green-700 mt-2">
//               No manual setup required! Claude can create, edit, and manage files automatically.
//             </p>
//           </div>
          
//           <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
//             <p className="text-xs text-blue-800">
//               <strong>Security:</strong> If Claude asks for additional permissions, you can:
//             </p>
//             <ul className="text-xs text-blue-700 mt-1 ml-4 space-y-1">
//               <li>• Choose "Yes" to allow once</li>
//               <li>• Choose "Yes, and don't ask again" for permanent access</li>
//               <li>• Add custom tools in the settings below</li>
//             </ul>
//           </div>
//         </div>

//         <Separator />

//         <div>
//           <Label htmlFor="sessionId">Session ID</Label>
//           <div className="flex gap-2">
//             <Input
//               id="sessionId"
//               value={settings.sessionId}
//               onChange={(e) => setSettings(prev => ({ ...prev, sessionId: e.target.value }))}
//               placeholder="Enter session ID to resume..."
//               className="flex-1"
//             />
//             <Button
//               variant="outline"
//               size="sm"
//               onClick={() => {
//                 setSettings(prev => ({ ...prev, sessionId: '' }));
//                 setStreamSessionId('');
//                 toast.success('Session cleared');
//               }}
//               disabled={!settings.sessionId && !streamSessionId}
//             >
//               Clear
//             </Button>
//           </div>
//           {streamSessionId && (
//             <p className="text-xs text-muted-foreground mt-1">
//               Current session: <code>{streamSessionId.slice(0, 8)}...</code>
//             </p>
//           )}
//         </div>

//         <div className="flex items-center space-x-2">
//           <Switch
//             id="continueConversation"
//             checked={true}
//             onCheckedChange={() => {}} // No-op function
//             disabled={true}
//             className="opacity-75"
//           />
//           <Label htmlFor="continueConversation" className="text-muted-foreground">
//             Continue Recent Conversation
//             <span className="text-xs block">Always enabled - sessions continue automatically</span>
//           </Label>
//         </div>

//         <div>
//           <Label htmlFor="maxTurns">Max Turns</Label>
//           <Input
//             id="maxTurns"
//             type="number"
//             min="1"
//             max="50"
//             value={settings.maxTurns}
//             onChange={(e) => setSettings(prev => ({ ...prev, maxTurns: parseInt(e.target.value) || 10 }))}
//           />
//         </div>

//         <div className="flex items-center space-x-2">
//           <Switch
//             id="verbose"
//             checked={settings.verbose}
//             onCheckedChange={(checked) => 
//               setSettings(prev => ({ ...prev, verbose: checked }))
//             }
//           />
//           <Label htmlFor="verbose">
//             Verbose Output
//             <span className="text-xs text-muted-foreground block">
//               Show thinking process and debug information
//             </span>
//           </Label>
//         </div>

//         <Separator />

//         <div>
//           <Label htmlFor="systemPrompt">System Prompt</Label>
//           <Textarea
//             id="systemPrompt"
//             value={settings.systemPrompt}
//             onChange={(e) => setSettings(prev => ({ ...prev, systemPrompt: e.target.value }))}
//             placeholder="Custom system prompt..."
//             className="min-h-20"
//           />
//         </div>

//         <div>
//           <Label htmlFor="appendSystemPrompt">Append System Prompt</Label>
//           <Textarea
//             id="appendSystemPrompt"
//             value={settings.appendSystemPrompt}
//             onChange={(e) => setSettings(prev => ({ ...prev, appendSystemPrompt: e.target.value }))}
//             placeholder="Additional system instructions..."
//             className="min-h-20"
//           />
//         </div>

//         <div>
//           <Label htmlFor="allowedTools">Allowed Tools</Label>
//           <Input
//             id="allowedTools"
//             value={settings.allowedTools}
//             onChange={(e) => setSettings(prev => ({ ...prev, allowedTools: e.target.value }))}
//             placeholder="Comma-separated tool names..."
//           />
//         </div>

//         <div>
//           <Label htmlFor="disallowedTools">Disallowed Tools</Label>
//           <Input
//             id="disallowedTools"
//             value={settings.disallowedTools}
//             onChange={(e) => setSettings(prev => ({ ...prev, disallowedTools: e.target.value }))}
//             placeholder="Comma-separated tool names..."
//           />
//         </div>
//       </CardContent>
//     </Card>
//   </TabsContent>
// )


