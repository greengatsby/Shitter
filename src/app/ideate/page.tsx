'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Sparkles, AlertTriangle, CheckCircle, XCircle, History } from 'lucide-react';

interface BusinessIdea {
  businessIdea: string;
  problemIdentification: {
    description: string;
    isObservablePublicly: string;
    digitalDetectionMethod: string;
  };
  valueProposition: {
    description: string;
    whatTheyCurrentlyPay: string;
    ourCostToProvide: string;
    leadMagnetStrategy: string;
  };
  dreamOutcome: {
    conciseStatement: string;
  };
  customerDetectionStrategy: {
    digitalSignals: string[];
    scrapingTargets: string[];
    automationApproach: string;
    identificationCriteria: string[];
  };
  targetMarket: string;
  solutionOverview: string;
  revenueModel: string;
  implementationPlan: string;
  successMetrics: string[];
}

interface IdeaResponse {
  success: boolean;
  idea?: BusinessIdea;
  error?: string;
  timestamp: string;
  rawResponse?: string;
  savedId?: string;
  saveError?: string;
}

export default function IdeatePage() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<IdeaResponse | null>(null);

  const generateIdea = async () => {
    setLoading(true);
    setResponse(null);

    try {
      // Redirect to ideas page immediately
      window.location.href = '/ideas?generating=true';
      
      const res = await fetch('/api/ideate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data: IdeaResponse = await res.json();
      console.log('API Response:', data);
      setResponse(data);
    } catch (error) {
      setResponse({
        success: false,
        error: 'Failed to connect to API',
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <Sparkles className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            </div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">
              AI Ideator
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed max-w-lg mx-auto">
            Generate innovative business ideas powered by AI
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mb-12 space-y-4">
          <Button
            onClick={generateIdea}
            disabled={loading}
            className="w-full h-12 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-white font-medium rounded-xl transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span>Generate Idea</span>
              </div>
            )}
          </Button>
          
          <Button
            onClick={() => window.location.href = '/ideas'}
            variant="outline"
            className="w-full h-12 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium rounded-xl transition-all duration-200"
          >
            <div className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span>View Saved Ideas</span>
            </div>
          </Button>
        </div>

        {/* Response */}
        {response && (
          <div className="space-y-6">
            {response.success && response.idea && typeof response.idea === 'object' ? (
              <>
                {/* Business Idea Header */}
                <Card className="border-0 shadow-sm bg-blue-50 dark:bg-blue-900/20">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <span className="font-semibold text-blue-900 dark:text-blue-100">
                          Business Idea
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-500">
                        {new Date(response.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-blue-800 dark:text-blue-200 text-lg font-medium leading-relaxed">
                      {response.idea?.businessIdea || 'No business idea provided'}
                    </p>
                  </CardContent>
                </Card>

                {/* Save Status */}
                {(response.savedId || response.saveError) && (
                  <Card className={`border-0 shadow-sm ${response.savedId ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        {response.savedId ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span className="text-sm font-medium text-green-700 dark:text-green-300">
                              Saved to database
                            </span>
                            <span className="text-xs text-green-600 dark:text-green-400 ml-auto">
                              ID: {response.savedId}
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span className="text-sm font-medium text-red-600 dark:text-red-400">
                              Failed to save: {response.saveError}
                            </span>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Problem Identification */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                      🎯 Problem Identification
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Description:</label>
                        <p className="text-gray-800 dark:text-gray-200 mt-1">{response.idea?.problemIdentification?.description || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Observable Publicly:</label>
                        <p className="text-gray-800 dark:text-gray-200 mt-1">{response.idea?.problemIdentification?.isObservablePublicly || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Digital Detection Method:</label>
                        <p className="text-gray-800 dark:text-gray-200 mt-1">{response.idea?.problemIdentification?.digitalDetectionMethod || 'Not provided'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Customer Detection Strategy */}
                <Card className="border-0 shadow-sm bg-green-50 dark:bg-green-900/20">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-green-900 dark:text-green-100 mb-4">
                      🔍 Customer Detection Strategy
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-green-700 dark:text-green-300">Digital Signals:</label>
                        <ul className="list-disc list-inside text-green-800 dark:text-green-200 mt-1 space-y-1">
                          {Array.isArray(response.idea?.customerDetectionStrategy?.digitalSignals) ? 
                            response.idea?.customerDetectionStrategy?.digitalSignals.map((signal, index) => (
                              <li key={index}>{String(signal)}</li>
                            )) : 
                            <li>{String(response.idea?.customerDetectionStrategy?.digitalSignals || 'Not provided')}</li>
                          }
                        </ul>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-green-700 dark:text-green-300">Scraping Targets:</label>
                        <ul className="list-disc list-inside text-green-800 dark:text-green-200 mt-1 space-y-1">
                          {Array.isArray(response.idea?.customerDetectionStrategy?.scrapingTargets) ? 
                            response.idea?.customerDetectionStrategy?.scrapingTargets.map((target, index) => (
                              <li key={index}>{String(target)}</li>
                            )) : 
                            <li>{String(response.idea?.customerDetectionStrategy?.scrapingTargets || 'Not provided')}</li>
                          }
                        </ul>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-green-700 dark:text-green-300">Automation Approach:</label>
                        <p className="text-green-800 dark:text-green-200 mt-1">{response.idea?.customerDetectionStrategy?.automationApproach || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-green-700 dark:text-green-300">Identification Criteria:</label>
                        <ul className="list-disc list-inside text-green-800 dark:text-green-200 mt-1 space-y-1">
                          {Array.isArray(response.idea?.customerDetectionStrategy?.identificationCriteria) ? 
                            response.idea?.customerDetectionStrategy?.identificationCriteria.map((criteria, index) => (
                              <li key={index}>{String(criteria)}</li>
                            )) : 
                            <li>{String(response.idea?.customerDetectionStrategy?.identificationCriteria || 'Not provided')}</li>
                          }
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Value Proposition */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                      💎 Value Proposition
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Description:</label>
                        <p className="text-gray-800 dark:text-gray-200 mt-1">{response.idea?.valueProposition?.description || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">What They Currently Pay:</label>
                        <p className="text-gray-800 dark:text-gray-200 mt-1">{response.idea?.valueProposition?.whatTheyCurrentlyPay || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Our Cost to Provide:</label>
                        <p className="text-gray-800 dark:text-gray-200 mt-1">{response.idea?.valueProposition?.ourCostToProvide || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Lead Magnet Strategy:</label>
                        <p className="text-gray-800 dark:text-gray-200 mt-1">{response.idea?.valueProposition?.leadMagnetStrategy || 'Not provided'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Dream Outcome */}
                <Card className="border-0 shadow-sm bg-purple-50 dark:bg-purple-900/20">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-4">
                      ✨ Dream Outcome
                    </h3>
                    <p className="text-purple-800 dark:text-purple-200 text-lg font-medium leading-relaxed">
                      {response.idea?.dreamOutcome?.conciseStatement || 'Not provided'}
                    </p>
                  </CardContent>
                </Card>

                {/* Additional Details */}
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">👥 Target Market</h3>
                      <p className="text-gray-800 dark:text-gray-200">{response.idea?.targetMarket || 'Not provided'}</p>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">🛠️ Solution Overview</h3>
                      <p className="text-gray-800 dark:text-gray-200">{response.idea?.solutionOverview || 'Not provided'}</p>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">💰 Revenue Model</h3>
                      <p className="text-gray-800 dark:text-gray-200">{response.idea?.revenueModel || 'Not provided'}</p>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">⚙️ Implementation Plan</h3>
                      <p className="text-gray-800 dark:text-gray-200">{response.idea?.implementationPlan || 'Not provided'}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Success Metrics */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">📊 Success Metrics</h3>
                    <ul className="list-disc list-inside text-gray-800 dark:text-gray-200 space-y-1">
                      {Array.isArray(response.idea?.successMetrics) ? 
                        response.idea?.successMetrics.map((metric, index) => (
                          <li key={index}>{String(metric)}</li>
                        )) : 
                        <li>{String(response.idea?.successMetrics || 'Not provided')}</li>
                      }
                    </ul>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="border-0 shadow-sm bg-red-50 dark:bg-red-900/20">
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">
                        Error
                      </span>
                    </div>
                    <p className="text-red-600 dark:text-red-400 text-sm leading-relaxed">
                      {response.error}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Powered by OpenAI's o3-mini model
          </p>
        </div>
      </div>
    </div>
  );
}