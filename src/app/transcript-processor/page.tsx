'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, FileText, CheckCircle, AlertCircle, Copy, X } from 'lucide-react';

interface BestPractice {
  title: string;
  description: string;
  example?: string;
  priority: number;
  practice_type?: 'rule' | 'detailed' | 'guideline';
}

interface ProcessResponse {
  success: boolean;
  practices?: BestPractice[];
  error?: string;
}

export default function TranscriptProcessorPage() {
  const [transcript, setTranscript] = useState('');
  const [source, setSource] = useState('');
  const [processing, setProcessing] = useState(false);
  const [practices, setPractices] = useState<BestPractice[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicateResults, setDuplicateResults] = useState<any[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  const handleProcessTranscript = async () => {
    if (!transcript.trim()) {
      setError('Please enter a transcript');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/process-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: transcript.trim(),
          source: source.trim() || 'Unknown Source'
        })
      });

      const data: ProcessResponse = await response.json();

      if (data.success && data.practices) {
        setPractices(data.practices);
        setSaved(false);
      } else {
        setError(data.error || 'Failed to process transcript');
      }
    } catch (err) {
      setError('Failed to connect to API');
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckDuplicates = async () => {
    if (practices.length === 0) {
      setError('No practices to check');
      return;
    }

    setCheckingDuplicates(true);
    setError(null);

    try {
      const response = await fetch('/api/check-duplicates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          practices
        })
      });

      const data = await response.json();

      if (data.success) {
        setDuplicateResults(data.results);
        const hasDuplicates = data.results.some((result: any) => result.hasDuplicates);

        if (hasDuplicates) {
          setShowDuplicateDialog(true);
        } else {
          // No duplicates found, proceed to save directly
          handleSavePractices(true);
        }
      } else {
        setError(data.error || 'Failed to check duplicates');
      }
    } catch (err) {
      setError('Failed to connect to API');
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const handleSavePractices = async (skipDuplicateCheck = false) => {
    if (practices.length === 0) {
      setError('No practices to save');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/save-best-practices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          practices,
          source: source.trim() || 'Unknown Source',
          skipDuplicateCheck
        })
      });

      const data = await response.json();

      if (data.success) {
        setSaved(true);
        setShowDuplicateDialog(false);
        // Clear the form after successful save
        setTimeout(() => {
          setTranscript('');
          setSource('');
          setPractices([]);
          setSaved(false);
          setDuplicateResults([]);
        }, 2000);
      } else {
        setError(data.error || 'Failed to save practices');
      }
    } catch (err) {
      setError('Failed to connect to API');
    } finally {
      setSaving(false);
    }
  };

  const updatePractice = (index: number, field: keyof BestPractice, value: string | number) => {
    const updated = [...practices];
    updated[index] = { ...updated[index], [field]: value };
    setPractices(updated);
  };

  const getPracticeTypeColor = (type?: string) => {
    switch (type) {
      case 'rule': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'detailed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'guideline': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const removePractice = (index: number) => {
    setPractices(practices.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Transcript Processor
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Paste transcripts from email marketing videos to extract best practices.
            The AI will identify both simple rules (like word limits) and detailed strategies.
          </p>
        </div>

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50 dark:bg-red-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {saved && (
          <Card className="mb-6 border-green-200 bg-green-50 dark:bg-green-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span>Best practices saved successfully!</span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Input Transcript
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="source">Source (Video title, URL, etc.)</Label>
                <Input
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="e.g., Cold Email Masterclass - YouTube"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="transcript">Transcript</Label>
                <Textarea
                  id="transcript"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Paste your transcript here..."
                  className="mt-1 min-h-[300px]"
                />
              </div>

              <Button
                onClick={handleProcessTranscript}
                disabled={processing}
                className="w-full"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing Transcript...
                  </>
                ) : (
                  'Extract Best Practices'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Extracted Best Practices</span>
                {practices.length > 0 && (
                  <Button
                    onClick={handleCheckDuplicates}
                    disabled={saving || checkingDuplicates}
                    variant="outline"
                    size="sm"
                  >
                    {checkingDuplicates ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Checking Duplicates...
                      </>
                    ) : saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Check & Save'
                    )}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {practices.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Process a transcript to see extracted best practices here
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {practices.map((practice, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                      <div className="space-y-3">
                        {/* Practice Type Badge */}
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPracticeTypeColor(practice.practice_type)}`}>
                            {practice.practice_type === 'rule' ? '📏 Simple Rule' :
                              practice.practice_type === 'detailed' ? '📋 Detailed Practice' :
                                practice.practice_type === 'guideline' ? '📖 Guideline' : 'Unknown Type'}
                          </span>
                          <Button
                            onClick={() => removePractice(index)}
                            variant="destructive"
                            size="sm"
                          >
                            Remove
                          </Button>
                        </div>

                        <div>
                          <Label htmlFor={`title-${index}`}>Title</Label>
                          <Input
                            id={`title-${index}`}
                            value={practice.title}
                            onChange={(e) => updatePractice(index, 'title', e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`description-${index}`}>Description</Label>
                          <Textarea
                            id={`description-${index}`}
                            value={practice.description}
                            onChange={(e) => updatePractice(index, 'description', e.target.value)}
                            className="mt-1 min-h-[80px]"
                          />
                        </div>

                        {/* Example field - only show for detailed practices */}
                        {practice.practice_type === 'detailed' && (
                          <div>
                            <Label htmlFor={`example-${index}`}>Example</Label>
                            <Textarea
                              id={`example-${index}`}
                              value={practice.example || ''}
                              onChange={(e) => updatePractice(index, 'example', e.target.value)}
                              className="mt-1 min-h-[60px]"
                              placeholder="Concrete example of implementation..."
                            />
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor={`practice-type-${index}`}>Type</Label>
                            <select
                              id={`practice-type-${index}`}
                              value={practice.practice_type || 'rule'}
                              onChange={(e) => updatePractice(index, 'practice_type', e.target.value)}
                              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            >
                              <option value="rule">Simple Rule</option>
                              <option value="detailed">Detailed Practice</option>
                              <option value="guideline">Guideline</option>
                            </select>
                          </div>

                          <div>
                            <Label htmlFor={`priority-${index}`}>Priority</Label>
                            <select
                              id={`priority-${index}`}
                              value={practice.priority}
                              onChange={(e) => updatePractice(index, 'priority', parseInt(e.target.value))}
                              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            >
                              <option value={1}>High</option>
                              <option value={2}>Medium</option>
                              <option value={3}>Low</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Duplicate Detection Dialog */}
        <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Potential Duplicates Found</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <p className="text-gray-600 dark:text-gray-400">
                We found some existing practices that might be similar to yours. Review them and decide how to proceed.
              </p>

              {duplicateResults.map((result, index) => (
                result.hasDuplicates && (
                  <Card key={index} className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-orange-600" />
                        New Practice: {result.practice.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-white dark:bg-gray-800 p-3 rounded border">
                        <p className="font-medium text-sm text-gray-600 dark:text-gray-400 mb-1">Your Practice:</p>
                        <p className="text-sm">{result.practice.description}</p>
                      </div>

                      <div>
                        <p className="font-medium text-sm text-gray-600 dark:text-gray-400 mb-2">
                          Similar Existing Practices:
                        </p>
                        <div className="space-y-2">
                          {result.duplicates.map((duplicate: any, dupIndex: number) => (
                            <div key={dupIndex} className="bg-gray-100 dark:bg-gray-700 p-3 rounded border-l-4 border-blue-500">
                              <div className="flex justify-between items-start mb-1">
                                <p className="font-medium text-sm">{duplicate.title}</p>
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  {Math.round(duplicate.similarity_score * 100)}% similar
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{duplicate.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              ))}

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => handleSavePractices(true)}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Anyway'
                  )}
                </Button>
                <Button
                  onClick={() => setShowDuplicateDialog(false)}
                  variant="outline"
                >
                  Review & Edit
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
} 