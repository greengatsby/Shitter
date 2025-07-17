'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  MapPin,
  Download,
  Play,
  Grid,
  Settings,
  Loader2,
  AlertCircle,
  CheckCircle,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

// Dynamic import for the interactive map component
const InteractiveMap = dynamic(() => import('@/components/InteractiveMap'), {
  ssr: false,
  loading: () => <div className="h-[500px] bg-gray-100 rounded-lg flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin" />
  </div>
});

interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface ScrapingConfig {
  searchQuery: string;
  coordinateDensity: number;
  bounds: MapBounds;
  scrapingMode: 'phantombuster' | 'direct';
}

interface GridPoint {
  lat: number;
  lng: number;
  url: string;
}



// Preset location buttons
const PRESET_LOCATIONS = [
  {
    name: 'United States',
    bounds: { north: 49.384, south: 24.396, east: -66.934, west: -124.848 }
  },
  {
    name: 'San Francisco',
    bounds: { north: 37.8, south: 37.7, east: -122.3, west: -122.5 }
  },
  {
    name: 'Los Angeles',
    bounds: { north: 34.15, south: 34.0, east: -118.2, west: -118.4 }
  },
  {
    name: 'New York',
    bounds: { north: 40.8, south: 40.7, east: -73.9, west: -74.1 }
  },
  {
    name: 'Chicago',
    bounds: { north: 41.95, south: 41.85, east: -87.6, west: -87.7 }
  }
];

export default function MapsScraper() {
  const [config, setConfig] = useState<ScrapingConfig>({
    searchQuery: 'hair salon',
    coordinateDensity: 12, // zoom level
    bounds: {
      north: 49.384,
      south: 24.396,
      east: -66.934,
      west: -124.848
    },
    scrapingMode: 'phantombuster'
  });

  const [gridPoints, setGridPoints] = useState<GridPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // US boundary filtering function
  const isInUnitedStates = (lat: number, lng: number): boolean => {
    const US_BOUNDARIES = {
      north: 49.384,
      south: 24.396,
      east: -66.934,
      west: -124.848
    };

    // Basic bounding box check
    if (lat < US_BOUNDARIES.south || lat > US_BOUNDARIES.north ||
      lng < US_BOUNDARIES.west || lng > US_BOUNDARIES.east) {
      return false;
    }

    // Additional checks to exclude major non-US areas
    // Exclude most of Canada
    if (lat > 48.99 && lng > -95 && lng < -66.934) {
      return false;
    }

    // Exclude most of Mexico
    if (lat < 32.5 && lng > -117 && lng < -96) {
      return false;
    }

    return true;
  };

  // Calculate grid points based on density
  const calculateGridPoints = () => {
    const { bounds, coordinateDensity, searchQuery } = config;

    // Convert zoom level to approximate grid size
    const gridSize = Math.pow(2, (20 - coordinateDensity)) * 0.001;

    const points: GridPoint[] = [];

    for (let lat = bounds.south; lat <= bounds.north; lat += gridSize) {
      for (let lng = bounds.west; lng <= bounds.east; lng += gridSize) {
        // Only include points within US boundaries
        if (isInUnitedStates(lat, lng)) {
          const url = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}/@${lat},${lng},${coordinateDensity}z?entry=ttu&g_ep=EgoyMDI1MDcwOS4wIKXMDSoASAFQAw%3D%3D`;
          points.push({ lat, lng, url });
        }
      }
    }

    setGridPoints(points);
  };

  // Update grid when config changes
  useEffect(() => {
    calculateGridPoints();
  }, [config]);

  const handleGenerateCSV = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('🚀 Starting CSV generation...');
      console.log(`📊 Total grid points: ${gridPoints.length}`);
      console.log(`🎯 Config:`, config);
      console.log(`📍 Sample points (first 3):`, gridPoints.slice(0, 3));

      const requestBody = {
        action: 'generate_csv',
        config,
        gridPoints
      };

      console.log(`📤 Sending request to API (payload size: ${JSON.stringify(requestBody).length} bytes)`);

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

      const response = await fetch('/api/maps-scraper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log(`📥 Response status: ${response.status}`);
      console.log(`📥 Response headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ HTTP error! status: ${response.status}, body: ${errorText}`);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      console.log('🔍 Parsing response...');
      const data = await response.json();
      console.log('✅ Response parsed successfully');
      console.log('📊 Response data:', {
        success: data.success,
        csvLength: data.csv?.length,
        sessionId: data.sessionId,
        error: data.error
      });

      if (data.success) {
        console.log('📝 Creating CSV file...');

        // Create and download CSV
        const csv = data.csv;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `google-maps-${config.searchQuery}-${new Date().toISOString().split('T')[0]}.csv`;

        console.log(`💾 Downloading CSV: ${a.download} (${blob.size} bytes)`);
        a.click();
        window.URL.revokeObjectURL(url);

        console.log('✅ CSV generation completed successfully!');
        setResults(data);
      } else {
        console.error('❌ CSV generation failed:', data.error);
        throw new Error(data.error || 'Failed to generate CSV');
      }
    } catch (err) {
      console.error('💥 CSV generation error:', err);

      let errorMessage = 'An error occurred';
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          errorMessage = 'Request timed out - dataset too large. Try reducing the area or density.';
        } else {
          errorMessage = err.message;
        }
      }

      console.error('💥 Error details:', {
        message: errorMessage,
        stack: err instanceof Error ? err.stack : undefined,
        gridPointsLength: gridPoints.length,
        config: config,
        errorType: err instanceof Error ? err.name : 'Unknown'
      });
      setError(errorMessage);
    } finally {
      setLoading(false);
      console.log('🏁 CSV generation process finished');
    }
  };

  const handleDirectScrape = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/maps-scraper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'direct_scrape',
          config,
          gridPoints: gridPoints.slice(0, 5) // Limit to first 5 for demo
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setResults(data);
      } else {
        throw new Error(data.error || 'Failed to scrape data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePresetLocation = (preset: typeof PRESET_LOCATIONS[0]) => {
    setConfig(prev => ({
      ...prev,
      bounds: preset.bounds
    }));
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <MapPin className="h-8 w-8" />
              Google Maps Scraper
            </h1>
            <p className="text-gray-600 mt-2">
              Generate PhantomBuster CSV links or directly scrape Google Maps data
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search Query */}
                <div>
                  <Label htmlFor="searchQuery">Search Query</Label>
                  <Input
                    id="searchQuery"
                    value={config.searchQuery}
                    onChange={(e) => setConfig(prev => ({ ...prev, searchQuery: e.target.value }))}
                    placeholder="e.g., hair salon, restaurant, dentist"
                  />
                </div>

                {/* Preset Locations */}
                <div>
                  <Label>Quick Locations</Label>
                  <div className="grid grid-cols-2 gap-1 mt-2">
                    {PRESET_LOCATIONS.map((preset) => (
                      <Button
                        key={preset.name}
                        variant="outline"
                        size="sm"
                        onClick={() => handlePresetLocation(preset)}
                        className="text-xs"
                      >
                        {preset.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Coordinate Density */}
                <div>
                  <Label>Coordinate Density (Zoom Level): {config.coordinateDensity}</Label>
                  <Slider
                    value={[config.coordinateDensity]}
                    onValueChange={(value) => setConfig(prev => ({ ...prev, coordinateDensity: value[0] }))}
                    min={8}
                    max={16}
                    step={1}
                    className="mt-2"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Low (8)</span>
                    <span>High (16)</span>
                  </div>
                </div>

                {/* Map Bounds */}
                <div>
                  <Label>Map Bounds</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <Label className="text-xs">North</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={config.bounds.north}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          bounds: { ...prev.bounds, north: parseFloat(e.target.value) }
                        }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">South</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={config.bounds.south}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          bounds: { ...prev.bounds, south: parseFloat(e.target.value) }
                        }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">East</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={config.bounds.east}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          bounds: { ...prev.bounds, east: parseFloat(e.target.value) }
                        }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">West</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={config.bounds.west}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          bounds: { ...prev.bounds, west: parseFloat(e.target.value) }
                        }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Grid Preview */}
                <div>
                  <Label>Grid Preview</Label>
                  <div className="bg-gray-100 p-3 rounded-md mt-2">
                    <div className="text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <Grid className="h-4 w-4" />
                        <span className="font-medium">Grid Points: {gridPoints.length}</span>
                      </div>
                      <div className="text-gray-600 text-xs">
                        Area: {Math.abs(config.bounds.east - config.bounds.west).toFixed(3)}° × {Math.abs(config.bounds.north - config.bounds.south).toFixed(3)}°
                      </div>
                      {gridPoints.length > 5000 && (
                        <div className="text-orange-600 text-xs mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Large dataset - pins will cluster and sample for performance
                        </div>
                      )}
                      {gridPoints.length > 50000 && (
                        <div className="text-red-600 text-xs mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Very large dataset - CSV generation may take 2-5 minutes
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button
                    onClick={handleGenerateCSV}
                    disabled={loading}
                    className="w-full"
                    variant="default"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {loading ? 'Generating CSV...' : 'Generate PhantomBuster CSV'}
                  </Button>

                  {loading && (
                    <div className="text-xs text-gray-600 mt-2 p-2 bg-blue-50 rounded">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Processing {gridPoints.length} points...
                      </div>
                      <div className="mt-1">
                        ⏱️ Large datasets may take 1-2 minutes to process
                      </div>
                      <div className="mt-1">
                        🔍 Check browser console for detailed progress
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleDirectScrape}
                    disabled={loading}
                    className="w-full"
                    variant="outline"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Direct Scrape (Demo)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Map Visualization and Results */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="map" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="map">Map Visualization</TabsTrigger>
                <TabsTrigger value="results">Results</TabsTrigger>
              </TabsList>

              <TabsContent value="map" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Grid Visualization</span>
                      <Badge variant="outline">
                        {gridPoints.length} points
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <InteractiveMap
                      bounds={config.bounds}
                      gridPoints={gridPoints}
                      className="mb-4"
                    />

                    <div className="bg-gray-50 p-3 rounded-md">
                      <div className="text-sm">
                        <div className="grid grid-cols-2 gap-4 mb-2">
                          <div>
                            <span className="font-medium">Search: </span>
                            <span className="text-gray-600">"{config.searchQuery}"</span>
                          </div>
                          <div>
                            <span className="font-medium">Zoom: </span>
                            <span className="text-gray-600">{config.coordinateDensity}</span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          Blue dots represent scraping points. Each point will generate a Google Maps URL for the specified search query.
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Sample URLs Preview */}
                <Card>
                  <CardHeader>
                    <CardTitle>Sample URLs Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {gridPoints.slice(0, 5).map((point, index) => (
                        <div key={index} className="bg-gray-50 p-2 rounded text-xs">
                          <div className="font-medium text-gray-600">
                            Point {index + 1}: {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
                          </div>
                          <div className="text-blue-600 truncate">
                            {point.url}
                          </div>
                        </div>
                      ))}
                      {gridPoints.length > 5 && (
                        <div className="text-center text-gray-500 text-xs">
                          ... and {gridPoints.length - 5} more points
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="results" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Scraping Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {results ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <span className="font-medium">Success!</span>
                        </div>

                        {results.csv && (
                          <div>
                            <Label>CSV Generated</Label>
                            <div className="bg-gray-100 p-3 rounded-md mt-2">
                              <div className="text-sm">
                                <div>Points: {results.totalPoints}</div>
                                <div>File: google-maps-{config.searchQuery}-{new Date().toISOString().split('T')[0]}.csv</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {results.scrapedData && (
                          <div>
                            <Label>Scraped Data</Label>
                            <Textarea
                              value={JSON.stringify(results.scrapedData, null, 2)}
                              readOnly
                              rows={10}
                              className="mt-2 text-xs"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Grid className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-600">No results yet</p>
                        <p className="text-sm text-gray-500 mt-2">
                          Click "Generate PhantomBuster CSV" or "Direct Scrape" to see results
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
} 