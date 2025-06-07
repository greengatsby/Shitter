'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { IdeaEditor } from '@/components/IdeaEditor';
import { Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';

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

interface IdeaResponse {
  success: boolean;
  idea?: Idea;
  error?: string;
  timestamp: string;
}

export default function IdeaDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [idea, setIdea] = useState<Idea | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchIdea = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/ideas/${params.id}`);
      const data: IdeaResponse = await res.json();
      
      if (data.success && data.idea) {
        setIdea(data.idea);
      } else {
        setError(data.error || 'Failed to fetch idea');
      }
    } catch (err) {
      setError('Failed to connect to API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) {
      fetchIdea();
    }
  }, [params.id]);

  const handleIdeaSave = (updatedIdea: Idea) => {
    setIdea(updatedIdea);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading idea...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !idea) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto px-6 py-16">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Button
              onClick={() => router.push('/ideas')}
              variant="outline"
              size="sm"
              className="rounded-lg"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Ideas
            </Button>
          </div>

          {/* Error State */}
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
            <CardContent className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-red-900 dark:text-red-100 mb-2">
                Failed to load idea
              </h3>
              <p className="text-red-600 dark:text-red-400 mb-4">
                {error}
              </p>
              <Button
                onClick={fetchIdea}
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button
            onClick={() => router.push('/ideas')}
            variant="outline"
            size="sm"
            className="rounded-lg"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Ideas
          </Button>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            ID: {idea.id}
          </div>
        </div>

        {/* Idea Editor */}
        <IdeaEditor
          idea={idea}
          onSave={handleIdeaSave}
        />
      </div>
    </div>
  );
}