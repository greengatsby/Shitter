'use client';

import { useState } from 'react';
import { DynamicSection } from './DynamicSection';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

interface IdeaEditorProps {
  idea: Idea;
  onSave?: (updatedIdea: Idea) => void;
  className?: string;
}

export function IdeaEditor({ idea, onSave, className = '' }: IdeaEditorProps) {
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [localIdea, setLocalIdea] = useState(idea);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sections = [
    {
      key: 'idea',
      title: 'Business Idea',
      icon: '💡',
      colorScheme: 'blue' as const,
      data: localIdea.idea || {}
    },
    {
      key: 'problem',
      title: 'Problem',
      icon: '🎯',
      colorScheme: 'orange' as const,
      data: localIdea.problem || {}
    },
    {
      key: 'solution',
      title: 'Solution',
      icon: '🛠️',
      colorScheme: 'green' as const,
      data: localIdea.solution || {}
    },
    {
      key: 'market',
      title: 'Market',
      icon: '👥',
      colorScheme: 'purple' as const,
      data: localIdea.market || {}
    },
    {
      key: 'outreach',
      title: 'Outreach',
      icon: '📧',
      colorScheme: 'slate' as const,
      data: localIdea.outreach || {}
    }
  ];

  const handleSectionSave = async (sectionKey: string, sectionData: Record<string, any>) => {
    setSaving(true);
    setError(null);

    try {
      // Update local state
      const updatedIdea = {
        ...localIdea,
        [sectionKey]: sectionData,
        updated_at: new Date().toISOString()
      };

      // Save to API
      const response = await fetch(`/api/ideas/${localIdea.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          [sectionKey]: sectionData
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      setLocalIdea(updatedIdea);
      setEditingSection(null);
      onSave?.(updatedIdea);

    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/ideas/${localIdea.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update status');
      }

      const updatedIdea = {
        ...localIdea,
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      setLocalIdea(updatedIdea);
      onSave?.(updatedIdea);

    } catch (err: any) {
      console.error('Status update error:', err);
      setError(err.message || 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return {
          color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
          dot: 'bg-emerald-500'
        };
      case 'archived':
        return {
          color: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-950/50 dark:text-gray-400 dark:border-gray-800',
          dot: 'bg-gray-400'
        };
      case 'draft':
        return {
          color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800',
          dot: 'bg-blue-500'
        };
      default:
        return {
          color: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-950/50 dark:text-gray-400 dark:border-gray-800',
          dot: 'bg-gray-400'
        };
    }
  };

  const statusConfig = getStatusConfig(localIdea.status);

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-3">
              {localIdea.title || 'Untitled Idea'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400">Status</span>
            <div className="relative">
              <select
                value={localIdea.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={saving}
                className="appearance-none bg-transparent border-0 text-sm font-medium pr-6 focus:outline-none cursor-pointer"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pointer-events-none">
                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.color}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
              {localIdea.status}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            <span>Updated {new Date(localIdea.updated_at).toLocaleDateString()}</span>
          </div>

          {saving && (
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs font-medium">Saving...</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-800 dark:text-red-200">{error}</AlertDescription>
        </Alert>
      )}

      {/* Dynamic Sections */}
      <div className="space-y-4">
        {sections.map((section) => (
          <DynamicSection
            key={section.key}
            title={section.title}
            icon={section.icon}
            data={section.data}
            colorScheme={section.colorScheme}
            isEditing={editingSection === section.key}
            onEdit={() => setEditingSection(section.key)}
            onCancel={() => setEditingSection(null)}
            onSave={(data) => handleSectionSave(section.key, data)}
          />
        ))}
      </div>

      {/* Raw Data (Debug) */}
      {localIdea.raw_data && process.env.NODE_ENV === 'development' && (
        <details className="mt-8 text-xs">
          <summary className="cursor-pointer text-gray-400 dark:text-gray-500 mb-3 font-medium hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
            Debug: Raw Data
          </summary>
          <pre className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 p-4 rounded-lg overflow-auto text-xs font-mono text-gray-700 dark:text-gray-300">
            {JSON.stringify(localIdea.raw_data, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}