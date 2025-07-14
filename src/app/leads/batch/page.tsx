'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Building2 } from 'lucide-react';

interface BatchResult {
  query: string;
  pagesFetched: number;
  leadsAdded: number;
}

export default function BatchLeadsPage() {
  const [queriesText, setQueriesText] = useState('');
  const [pages, setPages] = useState(3);
  const [numResults, setNumResults] = useState(10);
  const [country, setCountry] = useState('us');
  const [language, setLanguage] = useState('en');
  const [location, setLocation] = useState('');
  const [clayUrl, setClayUrl] = useState('');

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);

  const handleRunBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const queries = queriesText
      .split(/\n|,/) // newline or comma separated
      .map((q) => q.trim())
      .filter(Boolean);

    if (queries.length === 0) {
      setError('Please provide at least one query');
      return;
    }

    if (!clayUrl.trim()) {
      setError('Clay webhook URL is required');
      return;
    }

    setIsRunning(true);
    setError('');
    setBatchResults([]);

    try {
      const response = await fetch('/api/leads/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          queries,
          pages,
          num: numResults,
          country,
          language,
          clay_url: clayUrl.trim(),
          ...(location && { location }),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setBatchResults(data.batchResults || []);
      } else {
        const err = await response.json();
        setError(err.error || 'Batch run failed');
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple top nav */}
      <nav className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-6 py-4 flex items-center space-x-8">
          <div className="flex items-center space-x-2">
            <Building2 className="h-6 w-6 text-blue-600" />
            <span className="font-bold text-lg">OrgFlow</span>
          </div>
          <a href="/leads" className="text-gray-600 hover:text-gray-900">Leads</a>
          <a href="/leads/batch" className="text-blue-600 font-medium">Batch</a>
        </div>
      </nav>

      <div className="container mx-auto p-6 max-w-5xl">
        <h1 className="text-3xl font-bold mb-6">Batch Lead Search</h1>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Batch Parameters</CardTitle>
            <CardDescription>Run multiple queries at once and fetch several pages of leads</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRunBatch} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-1">Queries (one per line or comma-separated)</label>
                <Textarea
                  rows={6}
                  value={queriesText}
                  onChange={(e) => setQueriesText(e.target.value)}
                  placeholder="apple inc\nopenai\ngoogle"
                />
              </div>

              <div>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Pages per query</label>
                  <Input
                    type="number"
                    min={1}
                    value={pages}
                    onChange={(e) => setPages(parseInt(e.target.value))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Results per page</label>
                  <Select value={numResults.toString()} onValueChange={(v) => setNumResults(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Country</label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us">US</SelectItem>
                      <SelectItem value="gb">UK</SelectItem>
                      <SelectItem value="ca">Canada</SelectItem>
                      <SelectItem value="au">Australia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Language</label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium mb-1">Location (optional)</label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="New York" />
                </div>
              </div>

              <Button type="submit" disabled={isRunning || !clayUrl.trim()} className="w-full sm:w-auto">
                {isRunning ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running…</> : 'Run Batch'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50"><AlertDescription className="text-red-800">{error}</AlertDescription></Alert>
        )}

        {batchResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Batch Summary</CardTitle>
              <CardDescription>Results of your batch run</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Query</th>
                      <th className="px-3 py-2 text-left font-medium">Pages Fetched</th>
                      <th className="px-3 py-2 text-left font-medium">Leads Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchResults.map((r) => (
                      <tr key={r.query} className="border-b">
                        <td className="px-3 py-2 whitespace-nowrap">{r.query}</td>
                        <td className="px-3 py-2">{r.pagesFetched}</td>
                        <td className="px-3 py-2">{r.leadsAdded}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
} 