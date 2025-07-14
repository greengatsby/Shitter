'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search, ExternalLink, Building2, Globe, User, Send, CheckCircle, ArrowLeft } from 'lucide-react';

interface Lead {
  id: string;
  title: string;
  url: string;
  description: string;
  company_name: string;
  domain: string;
  status: string;
  score: number;
  created_at: string;
  sent_to_clay: boolean;
  clay_sent_at: string | null;
  searches?: {
    query: string;
    created_at: string;
  };
}

interface SearchDetails {
  search_id: string;
  query: string;
  created_at: string;
  leads: Lead[];
  clay_url: string | null;
  search_type: string;
}

export default function SearchDetailsPage({ params }: { params: { id: string } }) {
  const [searchDetails, setSearchDetails] = useState<SearchDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string>('');
  const [isSendingToClay, setIsSendingToClay] = useState(false);
  const [claySuccess, setClaySuccess] = useState<string>('');

  useEffect(() => {
    loadSearchDetails();
  }, [params.id]);

  const loadSearchDetails = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/leads/searches/${params.id}`);
      if (response.ok) {
        const data = await response.json();

        // Transform API response to match SearchDetails shape
        const transformed: SearchDetails = {
          search_id: data.search.id,
          query: data.search.query,
          created_at: data.search.created_at,
          clay_url: data.search.clay_url,
          search_type: data.search.search_type,
          leads: data.leads || []
        };

        setSearchDetails(transformed);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load search details');
      }
    } catch (error) {
      setError('Failed to load search details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueSearch = async () => {
    if (!searchDetails) return;

    setIsSearching(true);
    setError('');

    try {
      const response = await fetch('/api/leads/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchDetails.query,
          country: 'us',
          language: 'en',
          num: 10,
          source: 'serper.dev',
          type: searchDetails.search_type,
          clay_url: searchDetails.clay_url,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Refresh the search details to show new leads
        loadSearchDetails();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Search failed');
      }
    } catch (error) {
      setError('Network error occurred');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendToClay = async () => {
    if (!searchDetails) return;

    setIsSendingToClay(true);
    setError('');
    setClaySuccess('');

    try {
      const response = await fetch('/api/leads/send-to-clay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setClaySuccess(data.message);
        // Refresh to show updated Clay status
        loadSearchDetails();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to send leads to Clay');
      }
    } catch (error) {
      setError('Network error occurred while sending to Clay');
    } finally {
      setIsSendingToClay(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'contacted': return 'bg-yellow-100 text-yellow-800';
      case 'qualified': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!searchDetails) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto p-6 max-w-4xl">
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Search not found</h3>
              <p className="text-gray-600 mb-4">The search you're looking for doesn't exist.</p>
              <Button onClick={() => window.location.href = '/leads/searches'}>
                Back to Searches
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <Building2 className="h-8 w-8 text-blue-600" />
                <span className="text-xl font-bold">OrgFlow</span>
              </div>
              <div className="flex items-center space-x-6">
                <a href="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</a>
                <a href="/leads" className="text-blue-600 font-medium">Leads</a>
                <a href="/ideas" className="text-gray-600 hover:text-gray-900">Ideas</a>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm">
                <User className="h-4 w-4 mr-2" />
                Profile
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="sm" onClick={() => window.location.href = '/leads/searches'}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Searches
            </Button>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <Search className="h-8 w-8 text-gray-500" />
            <h1 className="text-3xl font-bold">"{searchDetails.query}"</h1>
          </div>
          <p className="text-gray-600">Search created {formatDate(searchDetails.created_at)}</p>
        </div>

        {/* Search Actions */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg mb-1">Search Actions</h3>
                <p className="text-sm text-gray-600">
                  Continue this search to find more leads or send existing leads to Clay
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleContinueSearch}
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Continue Search
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleSendToClay}
                  disabled={isSendingToClay || searchDetails.leads.filter(l => !l.sent_to_clay).length === 0}
                >
                  {isSendingToClay ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sending to Clay...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send to Clay ({searchDetails.leads.filter(l => !l.sent_to_clay).length})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Alert */}
        {claySuccess && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <AlertDescription className="text-green-800">{claySuccess}</AlertDescription>
          </Alert>
        )}

        {/* Leads List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Leads ({searchDetails.leads.length})</h2>
            <Badge variant="secondary" className="text-sm">
              {searchDetails.leads.length} total leads
            </Badge>
          </div>

          {searchDetails.leads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No leads found</h3>
                <p className="text-gray-600 mb-4">This search hasn't found any leads yet.</p>
                <Button onClick={handleContinueSearch} disabled={isSearching}>
                  {isSearching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Start Search
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {searchDetails.leads.map((lead) => (
                <Card key={lead.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-start gap-3 mb-2">
                          <Globe className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-lg leading-tight mb-1">
                              <a
                                href={lead.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-blue-600 flex items-center gap-1"
                              >
                                {lead.title}
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </h4>
                            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                              <Building2 className="h-4 w-4" />
                              <span className="font-medium">{lead.company_name}</span>
                              <span>•</span>
                              <span>{lead.domain}</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-gray-700 mb-3 leading-relaxed">{lead.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 ml-4">
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={getStatusColor(lead.status)}>
                            {lead.status}
                          </Badge>
                          {lead.sent_to_clay && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Sent to Clay
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 text-right">
                          Score: {lead.score}/100
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-gray-500 pt-3 border-t">
                      <div>
                        Added {formatDate(lead.created_at)}
                      </div>
                      <div className="text-right">
                        {lead.sent_to_clay && lead.clay_sent_at && (
                          <div className="text-green-600">
                            Sent to Clay {formatDate(lead.clay_sent_at)}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 