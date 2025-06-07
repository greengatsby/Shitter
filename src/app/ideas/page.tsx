'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, ArrowLeft, Trash2, RefreshCw } from 'lucide-react';

interface SavedIdea {
  id: string;
  created_at: string;
  updated_at: string;
  title?: string;
  status: string;
  idea: Record<string, any>;
  problem: Record<string, any>;
  solution: Record<string, any>;
  outreach: Record<string, any>;
  market: Record<string, any>;
  detailed_scores?: Record<string, any>;
  raw_data?: Record<string, any>;
}

interface IdeasResponse {
  success: boolean;
  ideas?: SavedIdea[];
  error?: string;
  count: number;
  timestamp: string;
}

interface RubricLevel {
  level: number;
  title: string;
  description: string;
}

interface RubricField {
  id: string;
  name: string;
  levels: RubricLevel[];
}

interface RubricCategory {
  id: string;
  name: string;
  fields: RubricField[];
}

export default function IdeasPage() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<SavedIdea[]>([]);
  const [rubrics, setRubrics] = useState<RubricCategory[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchIdeas = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ideas');
      const data: IdeasResponse = await res.json();

      if (data.success) {
        setIdeas(data.ideas || []);
      } else {
        setError(data.error || 'Failed to fetch ideas');
      }
    } catch (err) {
      setError('Failed to connect to API');
    } finally {
      setLoading(false);
    }
  };

  const fetchRubrics = async () => {
    try {
      const res = await fetch('/api/rubrics?include_fields=true&include_levels=true');
      const data = await res.json();

      if (data.success) {
        setRubrics(data.categories || []);
      }
    } catch (err) {
      console.error('Failed to fetch rubrics:', err);
    }
  };

  const deleteIdea = async (id: string) => {
    setDeleting(id);

    try {
      const res = await fetch(`/api/ideas?id=${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        setIdeas(ideas.filter(idea => idea.id !== id));
      } else {
        setError(data.error || 'Failed to delete idea');
      }
    } catch (err) {
      setError('Failed to delete idea');
    } finally {
      setDeleting(null);
    }
  };

  useEffect(() => {
    // Fetch rubrics first
    fetchRubrics();

    // Check if we're generating a new idea
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('generating') === 'true') {
      setGenerating(true);
      // Remove the parameter from URL
      window.history.replaceState({}, '', '/ideas');

      // Start polling for new ideas (generation already started from /ideate page)
      pollForNewIdea();
    } else {
      fetchIdeas();
    }
  }, []);

  const pollForNewIdea = async () => {
    // Just poll for new ideas - generation already started from /ideate page
    const pollInterval = setInterval(async () => {
      try {
        await fetchIdeas();
        // Stop polling after getting a new idea or after timeout
        setGenerating(false);
        clearInterval(pollInterval);
      } catch (error) {
        console.error('Failed to poll for ideas:', error);
      }
    }, 2000); // Poll every 2 seconds

    // Stop polling after 30 seconds max
    setTimeout(() => {
      clearInterval(pollInterval);
      setGenerating(false);
    }, 30000);
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'archived': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      case 'draft': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getProblemGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400';
      case 'B': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'C': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getSolutionGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'B': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'C': return 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getEmailGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'B': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400';
      case 'C': return 'bg-slate-100 text-slate-800 dark:bg-slate-900/20 dark:text-slate-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getViabilityGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-teal-100 text-teal-800 dark:bg-teal-900/20 dark:text-teal-400';
      case 'B': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400';
      case 'C': return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900/20 dark:text-zinc-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getLevelTitle = (fieldData: any): string => {
    // Use baked-in metadata if available, fallback to dynamic lookup
    if (fieldData.levelTitle) {
      return fieldData.levelTitle;
    }

    // Legacy fallback for older data
    return `Level ${fieldData.score}`;
  };

  const getLevelColor = (score: number): string => {
    // Color intensity increases from red to green (1=worst, 5=best)
    switch (score) {
      case 1: return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800';
      case 2: return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800';
      case 3: return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800';
      case 4: return 'bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-900/20 dark:text-lime-300 dark:border-lime-800';
      case 5: return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-700';
    }
  };

  const renderDetailedScore = (categoryData: any, categoryName: string) => {
    if (!categoryData) return null;

    const scoreFields = Object.keys(categoryData).filter(key =>
      categoryData[key] &&
      typeof categoryData[key] === 'object' &&
      'score' in categoryData[key] &&
      'justification' in categoryData[key]
    );

    if (scoreFields.length === 0) return null;

    return (
      <div className="overflow-visible">
        <div className="flex flex-wrap gap-2 overflow-visible">
          {scoreFields.map((fieldName) => {
            const fieldData = categoryData[fieldName];
            const levelTitle = getLevelTitle(fieldData);

            return (
              <div key={fieldName} className="relative group">
                <Badge
                  variant="outline"
                  className={`cursor-help text-xs px-2 py-1 ${getLevelColor(fieldData.score)}`}
                >
                  {levelTitle}
                </Badge>

                {/* Tooltip */}
                <div className="absolute bottom-full left-0 mb-2 px-4 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[9999] w-80 max-w-sm">
                  <div className="font-medium mb-2">
                    {fieldData.fieldName || fieldName}
                  </div>
                  {fieldData.fieldDescription && (
                    <div className="text-sm opacity-90 mb-3 leading-relaxed">
                      {fieldData.fieldDescription}
                    </div>
                  )}
                  {fieldData.levelDefinition && (
                    <div className="text-sm mb-3 border-t border-gray-600 dark:border-gray-400 pt-2 leading-relaxed">
                      <strong>Definition:</strong> {fieldData.levelDefinition}
                    </div>
                  )}
                  <div className="text-sm border-t border-gray-600 dark:border-gray-400 pt-2 leading-relaxed">
                    <strong>Score Justification:</strong> {fieldData.justification}
                  </div>
                  <div className="absolute top-full left-6 w-2 h-2 bg-gray-900 dark:bg-gray-100 rotate-45"></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const calculateOverallGrade = (idea: SavedIdea) => {
    const gradeToNumber = (grade: string | undefined): number | null => {
      switch (grade) {
        case 'A+': return 3.3;
        case 'A': return 3.0;
        case 'A-': return 2.7;
        case 'B+': return 2.3;
        case 'B': return 2.0;
        case 'B-': return 1.7;
        case 'C+': return 1.3;
        case 'C': return 1.0;
        case 'C-': return 0.7;
        default: return null;
      }
    };

    const scores = [
      gradeToNumber(idea.problem?.problemGrade),
      gradeToNumber(idea.solution?.solutionGrade),
      gradeToNumber(idea.outreach?.emailGrade),
      gradeToNumber(idea.market?.viabilityGrade)
    ].filter(score => score !== null) as number[];

    if (scores.length === 0) return null;

    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    // Convert average back to letter grade with +/-
    if (average >= 3.15) return 'A+';
    if (average >= 2.85) return 'A';
    if (average >= 2.5) return 'A-';
    if (average >= 2.15) return 'B+';
    if (average >= 1.85) return 'B';
    if (average >= 1.5) return 'B-';
    if (average >= 1.15) return 'C+';
    if (average >= 0.85) return 'C';
    return 'C-';
  };

  const getOverallGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      case 'A': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      case 'A-': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      case 'B+': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
      case 'B': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
      case 'B-': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
      case 'C+': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'C': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'C-': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400 border-gray-200 dark:border-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Button
                onClick={() => window.location.href = '/ideate'}
                variant="outline"
                size="sm"
                className="rounded-lg"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Generator
              </Button>
            </div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">
              Saved Business Ideas
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {ideas.length} ideas saved
            </p>
          </div>
          <Button
            onClick={fetchIdeas}
            disabled={loading}
            variant="outline"
            className="rounded-lg"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Error State */}
        {error && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/20 mb-6">
            <CardContent className="p-6">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading ideas...</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && ideas.length === 0 && !error && (
          <Card className="border-dashed border-2 border-gray-200 dark:border-gray-700">
            <CardContent className="text-center py-12">
              <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No ideas saved yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Generate your first business idea to see it here
              </p>
              <Button
                onClick={() => window.location.href = '/ideate'}
                className="bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Idea
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Generating State */}
        {generating && (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                <span className="text-blue-800 dark:text-blue-200 font-medium">
                  Generating new business idea...
                </span>
              </div>
            </div>

            {/* Skeleton Loader */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                    </div>
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Grade</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Justification</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-700">
                      {[1, 2, 3, 4].map((i) => (
                        <tr key={i}>
                          <td className="px-4 py-3">
                            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="h-6 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Ideas Table */}
        {!loading && !generating && ideas.length > 0 && (
          <div className="space-y-4">
            {ideas.map((idea) => (
              <Card key={idea.id} className="border-0 shadow-sm hover:shadow-md transition-shadow overflow-visible">
                <CardContent className="p-6 overflow-visible">
                  {/* Header with Overall Score */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        {(() => {
                          const overallGrade = calculateOverallGrade(idea);
                          return overallGrade !== null ? (
                            <div className="relative group">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 font-bold text-2xl cursor-help ${getOverallGradeColor(overallGrade)}`}>
                                {overallGrade}
                              </div>

                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[9999] whitespace-nowrap">
                                Avg of all category grades
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-100 rotate-45"></div>
                              </div>
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-full flex items-center justify-center border-2 bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 border-gray-200 dark:border-gray-700 font-bold text-xl">
                              ?
                            </div>
                          );
                        })()}
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2 leading-relaxed">
                        {idea.idea?.businessIdea || idea.title || 'Untitled Idea'}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <span>{new Date(idea.created_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="text-xs">ID: {idea.id.slice(0, 8)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => window.location.href = `/ideas/${idea.id}`}
                        variant="outline"
                        size="sm"
                      >
                        View Details
                      </Button>
                      <Button
                        onClick={() => deleteIdea(idea.id)}
                        disabled={deleting === idea.id}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        {deleting === idea.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Grades Table */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-visible">
                    <table className="w-full overflow-visible">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Grade
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Justification
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-700">
                        {/* Problem Grade */}
                        <tr>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            🎯 Problem
                          </td>
                          <td className="px-4 py-3">
                            {idea.problem?.problemGrade ? (
                              <div className="relative group">
                                <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 cursor-help">
                                  {idea.problem.problemGrade}
                                </Badge>
                                {idea.problem?.gradeJustification && (
                                  <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[9999] whitespace-nowrap">
                                    {idea.problem.gradeJustification}
                                    <div className="absolute top-full left-6 w-2 h-2 bg-gray-900 dark:bg-gray-100 rotate-45"></div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">Not graded</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 align-middle">
                            {renderDetailedScore(idea.problem, 'Problem')}
                          </td>
                        </tr>

                        {/* Solution Grade */}
                        <tr>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            🛠️ Solution
                          </td>
                          <td className="px-4 py-3">
                            {idea.solution?.solutionGrade ? (
                              <div className="relative group">
                                <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 cursor-help">
                                  {idea.solution.solutionGrade}
                                </Badge>
                                {idea.solution?.gradeJustification && (
                                  <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[9999] whitespace-nowrap">
                                    {idea.solution.gradeJustification}
                                    <div className="absolute top-full left-6 w-2 h-2 bg-gray-900 dark:bg-gray-100 rotate-45"></div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">Not graded</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 align-middle">
                            {renderDetailedScore(idea.solution, 'Solution')}
                          </td>
                        </tr>

                        {/* Email Grade */}
                        <tr>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            📧 Email Strategy
                          </td>
                          <td className="px-4 py-3">
                            {idea.outreach?.emailGrade ? (
                              <div className="relative group">
                                <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 cursor-help">
                                  {idea.outreach.emailGrade}
                                </Badge>
                                {idea.outreach?.emailGradeJustification && (
                                  <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[9999] whitespace-nowrap">
                                    {idea.outreach.emailGradeJustification}
                                    <div className="absolute top-full left-6 w-2 h-2 bg-gray-900 dark:bg-gray-100 rotate-45"></div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">Not graded</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 align-middle">
                            {renderDetailedScore(idea.outreach, 'Email Strategy')}
                          </td>
                        </tr>

                        {/* Viability Grade */}
                        <tr>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            🏢 Viability
                          </td>
                          <td className="px-4 py-3">
                            {idea.market?.viabilityGrade ? (
                              <div className="relative group">
                                <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 cursor-help">
                                  {idea.market.viabilityGrade}
                                </Badge>
                                {idea.market?.viabilityGradeJustification && (
                                  <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[9999] whitespace-nowrap">
                                    {idea.market.viabilityGradeJustification}
                                    <div className="absolute top-full left-6 w-2 h-2 bg-gray-900 dark:bg-gray-100 rotate-45"></div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">Not graded</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 align-middle">
                            {renderDetailedScore(idea.market, 'Business Viability')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}