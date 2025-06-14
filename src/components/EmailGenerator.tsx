'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Copy, RefreshCw, X, Mail, CheckCircle } from 'lucide-react';

interface Idea {
  id: string;
  title?: string;
  status: string;
  created_at: string;
  updated_at: string;
  idea: Record<string, any>;
  problem: Record<string, any>;
  solution: Record<string, any>;
  outreach: Record<string, any>;
  market: Record<string, any>;
  raw_data?: Record<string, any>;
}

interface EmailGeneratorProps {
  idea: Idea;
  isOpen: boolean;
  onClose: () => void;
}

interface GeneratedEmail {
  subject: string;
  body: string;
  target_audience: string;
  key_points: string[];
}

export function EmailGenerator({ idea, isOpen, onClose }: EmailGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [email, setEmail] = useState<GeneratedEmail | null>(null);
  const [copied, setCopied] = useState<'subject' | 'body' | null>(null);
  const [customInstructions, setCustomInstructions] = useState('');

  const handleGenerateEmail = async () => {
    setGenerating(true);

    try {
      const response = await fetch('/api/generate-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idea: idea,
          customInstructions: customInstructions.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        setEmail(data.email);
      } else {
        console.error('Failed to generate email:', data.error);
      }
    } catch (error) {
      console.error('Error generating email:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (text: string, type: 'subject' | 'body') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleRegenerateEmail = () => {
    setEmail(null);
    handleGenerateEmail();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Generate Email Campaign
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Idea Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Business Idea Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="font-medium">Problem:</span>{' '}
                <span className="text-gray-600 dark:text-gray-400">
                  {idea.problem?.description || 'No problem description available'}
                </span>
              </div>
              <div>
                <span className="font-medium">Solution:</span>{' '}
                <span className="text-gray-600 dark:text-gray-400">
                  {idea.solution?.description || 'No solution description available'}
                </span>
              </div>
              <div>
                <span className="font-medium">Target Market:</span>{' '}
                <span className="text-gray-600 dark:text-gray-400">
                  {idea.market?.target_market || 'No target market specified'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Custom Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Custom Instructions (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="custom-instructions">
                  Additional requirements or preferences for the email
                </Label>
                <Textarea
                  id="custom-instructions"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="e.g., Keep it under 150 words, focus on cost savings, mention specific industry pain points..."
                  className="mt-1 min-h-[80px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Generation Section */}
          <div className="flex gap-3">
            <Button
              onClick={handleGenerateEmail}
              disabled={generating}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Email...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Generate Email
                </>
              )}
            </Button>

            {email && (
              <Button
                onClick={handleRegenerateEmail}
                variant="outline"
                disabled={generating}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
            )}
          </div>

          {/* Generated Email */}
          {email && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Generated Email Campaign</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Target Audience */}
                <div>
                  <Label className="text-sm font-medium">Target Audience</Label>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {email.target_audience}
                  </p>
                </div>

                {/* Key Points */}
                <div>
                  <Label className="text-sm font-medium">Key Points Covered</Label>
                  <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                    {email.key_points.map((point, index) => (
                      <li key={index}>{point}</li>
                    ))}
                  </ul>
                </div>

                {/* Subject Line */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Subject Line</Label>
                    <Button
                      onClick={() => handleCopy(email.subject, 'subject')}
                      variant="outline"
                      size="sm"
                    >
                      {copied === 'subject' ? (
                        <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      {copied === 'subject' ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <p className="font-medium">{email.subject}</p>
                  </div>
                </div>

                {/* Email Body */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Email Body</Label>
                    <Button
                      onClick={() => handleCopy(email.body, 'body')}
                      variant="outline"
                      size="sm"
                    >
                      {copied === 'body' ? (
                        <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      {copied === 'body' ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <div className="whitespace-pre-wrap font-mono text-sm">
                      {email.body}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 