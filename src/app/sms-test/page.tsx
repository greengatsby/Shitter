'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, Phone, Send, Check, X, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

interface TestResult {
  id: string;
  timestamp: Date;
  message: string;
  phoneNumber: string;
  success: boolean;
  response?: any;
  error?: string;
}

interface EndpointStatus {
  testNumber: string;
  mainNumber: string;
  status: string;
}

interface ReceivedMessage {
  id: number;
  message_id: string;
  from_number: string;
  to_number: string;
  message_text: string;
  has_media: boolean;
  media_data: any;
  received_at: string;
  created_at: string;
}

export default function SMSTestPage() {
  const [message, setMessage] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [endpointStatus, setEndpointStatus] = useState<EndpointStatus | null>(null);
  const [receivedMessages, setReceivedMessages] = useState<ReceivedMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Load endpoint status and received messages on mount
  useEffect(() => {
    loadEndpointStatus();
    loadReceivedMessages();
  }, []);

  // Auto-refresh received messages every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadReceivedMessages();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadEndpointStatus = async () => {
    try {
      const response = await fetch('/api/sms/test');
      const data = await response.json();
      setEndpointStatus(data);

      // Set default phone number if not set
      if (!phoneNumber && data.mainNumber) {
        setPhoneNumber(data.mainNumber);
      }
    } catch (error) {
      console.error('Failed to load endpoint status:', error);
    }
  };

  const loadReceivedMessages = async () => {
    setLoadingMessages(true);
    try {
      const response = await fetch('/api/sms/test/conversation');
      const data = await response.json();
      
      if (data.messages) {
        setReceivedMessages(data.messages);
      }
    } catch (error) {
      console.error('Failed to load received messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      toast.error('Please enter a message to send');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/sms/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          phoneNumber: phoneNumber.trim() || undefined,
        }),
      });

      const data = await response.json();

      const testResult: TestResult = {
        id: Date.now().toString(),
        timestamp: new Date(),
        message: message.trim(),
        phoneNumber: phoneNumber.trim() || endpointStatus?.mainNumber || 'Unknown',
        success: response.ok && data.success,
        response: data,
        error: response.ok ? undefined : data.error,
      };

      setTestResults(prev => [testResult, ...prev]);

      if (response.ok && data.success) {
        toast.success('Test message sent successfully!');
        setMessage(''); // Clear message after successful send
      } else {
        toast.error(`Failed to send message: ${data.error || 'Unknown error'}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      const testResult: TestResult = {
        id: Date.now().toString(),
        timestamp: new Date(),
        message: message.trim(),
        phoneNumber: phoneNumber.trim() || endpointStatus?.mainNumber || 'Unknown',
        success: false,
        error: errorMessage,
      };

      setTestResults(prev => [testResult, ...prev]);
      toast.error(`Request failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
    toast.success('Test results cleared');
  };

  const quickTestMessages = [
    "Hello! Test message",
    "Schedule training tomorrow at 3pm",
    "Cancel my appointment today",
    "Show me my schedule",
    "I ate a chicken salad for lunch",
    "Help me debug this JavaScript error",
    "How do I fix this React component?",
  ];

  const setQuickMessage = (msg: string) => {
    setMessage(msg);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">SMS Testing Interface</h1>
          <p className="text-muted-foreground">
            Send test SMS messages to trigger your webhook for development testing
          </p>
        </div>

        {/* Status Card */}
        {endpointStatus && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Endpoint Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Test Number (From)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="font-mono">
                      {endpointStatus.testNumber}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Sending messages</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Main Number (To)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="default" className="font-mono">
                      {endpointStatus.mainNumber || 'Not configured'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Receiving messages</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Test Message Form */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Send Test Message
                </CardTitle>
                <CardDescription>
                  Compose and send a test SMS message to trigger your webhook
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={sendTestMessage} className="space-y-4">
                  <div>
                    <Label htmlFor="phoneNumber">Target Phone Number (optional)</Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder={endpointStatus?.mainNumber || '+1234567890'}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave blank to use the main number from your configuration
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Enter your test message here..."
                      className="min-h-24 resize-y"
                      disabled={loading}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || !message.trim()}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Test Message
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Quick Test Messages */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Test Messages</CardTitle>
                <CardDescription>
                  Click to use these pre-written test messages
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {quickTestMessages.map((msg, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickMessage(msg)}
                      className="w-full justify-start text-left h-auto whitespace-normal p-3"
                      disabled={loading}
                    >
                      {msg}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Test Results */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Test Results
                  </CardTitle>
                  {testResults.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearResults}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <CardDescription>
                  Results from your test messages
                </CardDescription>
              </CardHeader>
              <CardContent>
                {testResults.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No test messages sent yet
                  </div>
                ) : (
                  <ScrollArea className="h-96">
                    <div className="space-y-4">
                      {testResults.map((result) => (
                        <div
                          key={result.id}
                          className={`p-4 border rounded-lg ${result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {result.success ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <X className="h-4 w-4 text-red-600" />
                              )}
                              <Badge variant={result.success ? "default" : "destructive"}>
                                {result.success ? "Sent" : "Failed"}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {result.timestamp.toLocaleTimeString()}
                            </span>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <span className="text-xs font-medium text-muted-foreground">To:</span>
                              <span className="ml-2 text-sm font-mono">{result.phoneNumber}</span>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-muted-foreground">Message:</span>
                              <p className="text-sm mt-1">{result.message}</p>
                            </div>

                            {result.error && (
                              <Alert className="mt-2">
                                <AlertDescription className="text-sm">
                                  <strong>Error:</strong> {result.error}
                                </AlertDescription>
                              </Alert>
                            )}

                            {result.response && result.success && (
                              <div className="text-xs text-muted-foreground">
                                Message ID: {result.response.messageId}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How to Test</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground space-y-2">
                  <div>
                    <strong>1.</strong> Enter a test message above and click "Send Test Message"
                  </div>
                  <div>
                    <strong>2.</strong> The message will be sent from your test number
                    <Badge variant="outline" className="mx-1 font-mono text-xs">
                      +16288959010
                    </Badge>
                    to your main webhook number
                  </div>
                  <div>
                    <strong>3.</strong> This will trigger your SMS webhook as if a real user sent the message
                  </div>
                  <div>
                    <strong>4.</strong> Check your webhook logs to see how your system processes the message
                  </div>
                </div>

                <Separator />

                <div className="text-sm">
                  <div className="font-medium mb-2">Test different scenarios:</div>
                  <ul className="text-muted-foreground space-y-1 text-xs">
                    <li>• Scheduling messages</li>
                    <li>• Food logging messages</li>
                    <li>• Coding questions</li>
                    <li>• General conversation</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Received Messages */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Received Messages
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadReceivedMessages}
                    disabled={loadingMessages}
                  >
                    {loadingMessages ? (
                      <>
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                        Loading...
                      </>
                    ) : (
                      'Refresh'
                    )}
                  </Button>
                </div>
                <CardDescription>
                  Messages received by your webhook endpoint
                </CardDescription>
              </CardHeader>
              <CardContent>
                {receivedMessages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {loadingMessages ? 'Loading messages...' : 'No messages received yet'}
                  </div>
                ) : (
                  <ScrollArea className="h-96">
                    <div className="space-y-4">
                      {receivedMessages.map((message) => (
                        <div
                          key={message.id}
                          className="p-4 border rounded-lg bg-blue-50 border-blue-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="default">Received</Badge>
                              {message.has_media && (
                                <Badge variant="secondary">+Media</Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(message.created_at).toLocaleString()}
                            </span>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <span className="text-xs font-medium text-muted-foreground">From:</span>
                              <span className="ml-2 text-sm font-mono">{message.from_number}</span>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-muted-foreground">To:</span>
                              <span className="ml-2 text-sm font-mono">{message.to_number}</span>
                            </div>
                            {message.message_text && (
                              <div>
                                <span className="text-xs font-medium text-muted-foreground">Message:</span>
                                <p className="text-sm mt-1 p-2 bg-white rounded border">
                                  {message.message_text}
                                </p>
                              </div>
                            )}
                            {message.has_media && message.media_data && (
                              <div>
                                <span className="text-xs font-medium text-muted-foreground">Media:</span>
                                <p className="text-xs mt-1 p-2 bg-gray-100 rounded font-mono">
                                  {JSON.stringify(message.media_data, null, 2)}
                                </p>
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              Message ID: {message.message_id}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Real-time Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Live Monitoring</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Total Messages:</span>
                    <Badge variant="outline">{receivedMessages.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Auto-refresh:</span>
                    <Badge variant="default">Every 5s</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Endpoint:</span>
                    <Badge variant="outline" className="font-mono text-xs">
                      /api/sms/test/conversation
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="text-sm">
                  <div className="font-medium mb-2">To test webhook:</div>
                  <ol className="text-muted-foreground space-y-1 text-xs">
                    <li>1. Send SMS to +16288959010</li>
                    <li>2. Watch for messages to appear above</li>
                    <li>3. You'll get an auto-reply confirmation</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
} 