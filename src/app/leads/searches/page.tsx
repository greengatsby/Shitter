'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search, Building2, User, ArrowLeft, ExternalLink } from 'lucide-react';

interface SearchHistory {
  query: string;
  first_search: string;
  last_search: string;
  total_pages: number;
  total_leads: number;
  search_ids: string[];
}

export default function SearchesPage() {
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadSearchHistory();
  }, []);

  const loadSearchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch('/api/leads/searches');
      if (response.ok) {
        const data = await response.json();
        setSearchHistory(data.searches || []);
      } else {
        setError('Failed to load search history');
      }
    } catch (error) {
      setError('Failed to load search history');
    } finally {
      setIsLoadingHistory(false);
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

  const handleViewSearch = (searchIds: string[]) => {
    // Use the first search ID to view the search results
    const searchId = searchIds[0];
    window.location.href = `/leads/searches/${searchId}`;
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

      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="sm" onClick={() => window.location.href = '/leads'}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Search
            </Button>
          </div>
          <h1 className="text-3xl font-bold mb-2">Your Searches</h1>
          <p className="text-gray-600">Continue from your previous searches or view their results</p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Search History */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Search History</span>
              <Button variant="outline" size="sm" onClick={loadSearchHistory} disabled={isLoadingHistory}>
                {isLoadingHistory ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Refresh'
                )}
              </Button>
            </CardTitle>
            <CardDescription>
              Click on any search to view its results or continue searching
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : searchHistory.length === 0 ? (
              <div className="text-center py-12">
                <Search className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No searches yet</h3>
                <p className="text-gray-600 mb-4">Start by creating a new search to see your history here.</p>
                <Button onClick={() => window.location.href = '/leads'}>
                  Create New Search
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {searchHistory.map((search, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => handleViewSearch(search.search_ids)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Search className="h-5 w-5 text-gray-400" />
                        <div className="font-medium text-lg">"{search.query}"</div>
                      </div>
                      <div className="text-sm text-gray-500 space-x-6 ml-8">
                        <span>Pages: {search.total_pages}</span>
                        <span>Leads: {search.total_leads}</span>
                        <span>First run: {formatDate(search.first_search)}</span>
                        <span>Last run: {formatDate(search.last_search)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {search.total_leads} leads
                      </Badge>
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 