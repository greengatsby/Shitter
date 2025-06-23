'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Code } from "lucide-react"

export default function V0TestPage() {
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generateCode = async () => {
    if (!prompt.trim()) return

    setLoading(true)
    setError('')
    setResponse('')

    try {
      const res = await fetch('/api/v0', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate code')
      }

      // v0 API returns the generated code in the response
      setResponse(JSON.stringify(data, null, 2))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">v0 API Test</h1>
          <p className="text-xl text-gray-600">
            Generate React components using the v0 API
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Prompt
              </CardTitle>
              <CardDescription>
                Describe the React component you want to generate
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="e.g., Create a modern pricing section with 3 tiers, each with features and a call-to-action button. Use Tailwind CSS for styling."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
              />
              <Button 
                onClick={generateCode} 
                disabled={loading || !prompt.trim()}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Code'
                )}
              </Button>
            </CardContent>
          </Card>

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="text-red-600">
                  <strong>Error:</strong> {error}
                </div>
                {error.includes('V0_API_KEY') && (
                  <div className="mt-2 text-sm text-red-500">
                    To use this feature, you need to:
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li>Get an API key from <a href="https://v0.dev" className="underline">v0.dev</a></li>
                      <li>Add it to your .env.local file as V0_API_KEY=your_key_here</li>
                      <li>Restart your development server</li>
                    </ol>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {response && (
            <Card>
              <CardHeader>
                <CardTitle>Generated Response</CardTitle>
                <CardDescription>
                  Raw response from the v0 API
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto text-sm">
                  {response}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>How to Use</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. Get API Access</h3>
              <p className="text-gray-600">
                Visit <a href="https://v0.dev" className="text-blue-600 underline">v0.dev</a> to get your API key.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">2. Set Environment Variable</h3>
              <p className="text-gray-600">
                Add <code className="bg-gray-100 px-2 py-1 rounded">V0_API_KEY=your_key_here</code> to your .env.local file.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">3. Write Prompts</h3>
              <p className="text-gray-600">
                Describe React components you want to generate. Be specific about styling, functionality, and layout.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}