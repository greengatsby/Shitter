'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search, ExternalLink, Building2, Globe, User, Send, CheckCircle } from 'lucide-react';

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

interface SearchResponse {
  success: boolean;
  search_id: string;
  query: string;
  results_count: number;
  leads: Lead[];
}

interface SearchHistory {
  query: string;
  first_search: string;
  last_search: string;
  total_pages: number;
  total_leads: number;
  search_ids: string[];
}

export default function LeadsPage() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'company' | 'person'>('company');
  const [country, setCountry] = useState('us');

  const [numResults, setNumResults] = useState(10);
  const [location, setLocation] = useState('');
  const [negativeKeywords, setNegativeKeywords] = useState('');
  const [clayUrl, setClayUrl] = useState('');

  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string>('');
  const [isSendingToClay, setIsSendingToClay] = useState(false);
  const [claySuccess, setClaySuccess] = useState<string>('');

  // New state for search mode
  const [searchMode, setSearchMode] = useState<'select' | 'new'>('select');

  // Load existing leads and search history on component mount
  useEffect(() => {
    loadLeads();
    loadSearchHistory();
  }, []);

  const loadLeads = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/leads/search');
      if (response.ok) {
        const data = await response.json();
        setLeads(data.leads || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load leads');
      }
    } catch (error) {
      setError('Failed to load leads');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSearchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch('/api/leads/searches');
      if (response.ok) {
        const data = await response.json();
        setSearchHistory(data.searches || []);
      } else {
        console.error('Failed to load search history');
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (!clayUrl.trim()) {
      setError('Clay webhook URL is required');
      return;
    }

    setIsSearching(true);
    setError('');

    // Construct the search query with LinkedIn site filter.
    // Use a space between the site filter and the keyword(s) so the keyword is treated as search content
    // rather than part of the URL path (e.g., `site:linkedin.com/company "nutritionist"`).
    const sitePrefix = searchType === 'company' ? 'site:linkedin.com/company' : 'site:linkedin.com/in';
    const searchQuery = `${sitePrefix} "${query.trim()}"`;

    try {
      const response = await fetch('/api/leads/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          source: 'serper.dev',
          type: searchType,
          country,
          language: 'en',
          num: numResults,
          clay_url: clayUrl.trim(),
          ...(location && { location }),
          ...(negativeKeywords.trim() && { negative_keywords: negativeKeywords.trim() })
        }),
      });

      if (response.ok) {
        const data: SearchResponse = await response.json();
        setSearchResponse(data);
        setLeads(data.leads); // Replace leads with only the new search results
        // Refresh search history
        loadSearchHistory();
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
        // Refresh leads to show updated Clay status
        loadLeads();
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

  const handleBackToSelection = () => {
    setSearchMode('select');
    setError('');
    setClaySuccess('');
    setSearchResponse(null);
    setLeads([]);
    setNegativeKeywords('');
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
          <h1 className="text-3xl font-bold mb-2">Lead Search</h1>
          <p className="text-gray-600">Search for companies or people on LinkedIn using the serper.dev API</p>
        </div>

        {/* Search Mode Selection */}
        {searchMode === 'select' && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                How would you like to search?
              </CardTitle>
              <CardDescription>
                Choose to start a new search or continue an existing one
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className="p-6 border-2 border-dashed border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSearchMode('new');
                    setSearchResponse(null);
                    setLeads([]);
                    setError('');
                    setClaySuccess('');
                    setNegativeKeywords('');
                  }}
                >
                  <div className="text-center">
                    <Search className="h-12 w-12 mx-auto text-blue-600 mb-3" />
                    <h3 className="font-semibold text-lg mb-2">New Search</h3>
                    <p className="text-gray-600 text-sm">Search for companies or people on LinkedIn with custom parameters</p>
                  </div>
                </div>

                {searchHistory.length > 0 && (
                  <div
                    className="p-6 border-2 border-dashed border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors cursor-pointer"
                    onClick={() => window.location.href = '/leads/searches'}
                  >
                    <div className="text-center">
                      <Building2 className="h-12 w-12 mx-auto text-green-600 mb-3" />
                      <h3 className="font-semibold text-lg mb-2">Continue Search</h3>
                      <p className="text-gray-600 text-sm">Continue from your previous searches ({searchHistory.length} available)</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* New Search Form */}
        {searchMode === 'new' && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                New Search Parameters
              </CardTitle>
              <CardDescription>
                Enter your search query and configure search parameters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="col-span-full">
                    <label className="block text-sm font-medium mb-1">Search Type</label>
                    <Select value={searchType} onValueChange={(value: 'company' | 'person') => setSearchType(value)}>
                      <SelectTrigger className="w-full md:w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="company">Company Search</SelectItem>
                        <SelectItem value="person">Person Search</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      {searchType === 'company'
                        ? 'Will search LinkedIn company pages'
                        : 'Will search LinkedIn profiles'}
                    </p>
                  </div>

                  <div className="col-span-full">
                    <label className="block text-sm font-medium mb-1">
                      Search Query
                      <span className="text-xs text-gray-500 ml-1">
                        (will be prefixed with {searchType === 'company' ? 'site:linkedin.com/company/' : 'site:linkedin.com/in/'})
                      </span>
                    </label>
                    <Input
                      placeholder={searchType === 'company'
                        ? "e.g., apple inc, tech startups, marketing agencies"
                        : "e.g., software engineer, marketing director, CEO"}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      required
                    />
                  </div>

                  <div className="col-span-full">
                    <label className="block text-sm font-medium mb-1">Negative Keywords (Optional)</label>
                    <Input
                      placeholder="e.g., -recruiting, -hiring, -internship"
                      value={negativeKeywords}
                      onChange={(e) => setNegativeKeywords(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Exclude results containing these terms. Separate multiple terms with commas.
                    </p>
                  </div>

                  <div className="col-span-full">
                    <label className="block text-sm font-medium mb-1">Clay Webhook URL</label>
                    <Input
                      type="url"
                      placeholder="https://api.clay.com/v3/sources/webhook/..."
                      value={clayUrl}
                      onChange={(e) => setClayUrl(e.target.value)}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter your Clay webhook URL where leads will be sent
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Country</label>
                    <Select value={country} onValueChange={setCountry}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="us">United States</SelectItem>
                        <SelectItem value="ca">Canada</SelectItem>
                        <SelectItem value="gb">United Kingdom</SelectItem>
                        <SelectItem value="au">Australia</SelectItem>
                        <SelectItem value="de">Germany</SelectItem>
                        <SelectItem value="fr">France</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>



                  <div>
                    <label className="block text-sm font-medium mb-1">Results</label>
                    <Select value={numResults.toString()} onValueChange={(v) => setNumResults(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 results</SelectItem>
                        <SelectItem value="20">20 results</SelectItem>
                        <SelectItem value="30">30 results</SelectItem>
                        <SelectItem value="40">40 results</SelectItem>
                        <SelectItem value="50">50 results</SelectItem>
                        <SelectItem value="75">75 results</SelectItem>
                        <SelectItem value="100">100 results</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Location (Optional)</label>
                    <Input
                      placeholder="e.g., New York, California"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={isSearching || !query.trim() || !clayUrl.trim()}>
                    {isSearching ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Search Leads
                      </>
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleBackToSelection}>
                    Back
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}



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

        {/* Search Results Summary */}
        {searchResponse && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Latest Search Results</h3>
                  <p className="text-sm text-gray-600">
                    Found {searchResponse.results_count} results for "{searchResponse.query}"
                  </p>
                </div>
                <Badge variant="outline">{searchResponse.results_count} leads</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leads List - Only show when in new search mode and after a search has been performed */}
        {searchMode === 'new' && searchResponse && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Leads ({leads.length})</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  onClick={handleSendToClay}
                  disabled={isSendingToClay || leads.filter(l => !l.sent_to_clay).length === 0}
                >
                  {isSendingToClay ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sending to Clay...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send to Clay ({leads.filter(l => !l.sent_to_clay).length})
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={loadLeads} disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Refresh'
                  )}
                </Button>
              </div>
            </div>

            {isLoading && leads.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : leads.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No leads found</h3>
                  <p className="text-gray-600">Start by searching for leads using the form above.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                {(() => {
                  // Group leads by search query
                  const leadsBySearch = leads.reduce((groups, lead) => {
                    const searchQuery = lead.searches?.query || 'Unknown Search';
                    if (!groups[searchQuery]) {
                      groups[searchQuery] = [];
                    }
                    groups[searchQuery].push(lead);
                    return groups;
                  }, {} as Record<string, Lead[]>);

                  // Sort search groups by most recent lead in each group
                  const sortedSearchGroups = Object.entries(leadsBySearch).sort(([, leadsA], [, leadsB]) => {
                    const latestA = Math.max(...leadsA.map(l => new Date(l.created_at).getTime()));
                    const latestB = Math.max(...leadsB.map(l => new Date(l.created_at).getTime()));
                    return latestB - latestA;
                  });

                  return sortedSearchGroups.map(([searchQuery, searchLeads]) => (
                    <div key={searchQuery} className="space-y-4">
                      {/* Search Header */}
                      <div className="flex items-center justify-between pb-2 border-b">
                        <div className="flex items-center gap-2">
                          <Search className="h-5 w-5 text-gray-500" />
                          <h3 className="text-lg font-semibold">"{searchQuery}"</h3>
                          <Badge variant="secondary" className="text-xs">
                            {searchLeads.length} lead{searchLeads.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-500">
                          Last updated: {formatDate(searchLeads[0].created_at)}
                        </div>
                      </div>

                      {/* Leads for this search */}
                      <div className="grid gap-4 pl-4">
                        {searchLeads.map((lead) => (
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
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 