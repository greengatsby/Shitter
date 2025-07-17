import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🚀 [API] Maps scraper POST request received');
    
    const { action, config, gridPoints } = await request.json();
    
    console.log('📊 [API] Request parsed:', {
      action,
      configExists: !!config,
      gridPointsLength: gridPoints?.length,
      requestSize: JSON.stringify({ action, config, gridPoints }).length
    });

    if (!action || !config || !gridPoints) {
      console.error('❌ [API] Missing required parameters');
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    console.log(`🎯 [API] Processing action: ${action} with ${gridPoints.length} points`);

    switch (action) {
      case 'generate_csv':
        console.log('📝 [API] Generating PhantomBuster CSV...');
        const csvResult = await generatePhantomBusterCSV(config, gridPoints);
        console.log(`✅ [API] CSV generation completed in ${Date.now() - startTime}ms`);
        return csvResult;
      
      case 'direct_scrape':
        console.log('🔍 [API] Starting direct scrape...');
        const scrapeResult = await directScrapeGoogleMaps(config, gridPoints);
        console.log(`✅ [API] Direct scrape completed in ${Date.now() - startTime}ms`);
        return scrapeResult;
      
      default:
        console.error(`❌ [API] Invalid action: ${action}`);
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('💥 [API] Maps scraper error:', error);
    console.error('💥 [API] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: Date.now() - startTime
    });
    
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function generatePhantomBusterCSV(config: ScrapingConfig, gridPoints: GridPoint[]) {
  const startTime = Date.now();
  
  try {
    console.log('🗄️ [CSV] Starting CSV generation...');
    console.log(`📊 [CSV] Processing ${gridPoints.length} grid points`);
    
    // Log the scraping session to database
    console.log('💾 [CSV] Inserting scraping session to database...');
    const { data: scrapingSession, error: sessionError } = await supabase
      .from('scraping_sessions')
      .insert({
        search_query: config.searchQuery,
        coordinate_density: config.coordinateDensity,
        bounds: config.bounds,
        scraping_mode: 'phantombuster',
        total_points: gridPoints.length,
        status: 'csv_generated',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) {
      console.error('❌ [CSV] Error logging scraping session:', sessionError);
      // Continue anyway, don't fail the request
    } else {
      console.log(`✅ [CSV] Scraping session created: ${scrapingSession.id}`);
    }

    // Generate CSV content
    console.log('📝 [CSV] Generating CSV headers and rows...');
    const csvHeaders = [
      'Point ID',
      'Latitude',
      'Longitude',
      'Search Query',
      'Zoom Level',
      'Google Maps URL',
      'PhantomBuster Format'
    ];

    console.log('🔄 [CSV] Mapping grid points to CSV rows...');
    const csvRows = gridPoints.map((point, index) => [
      index + 1,
      point.lat.toFixed(6),
      point.lng.toFixed(6),
      `"${config.searchQuery}"`,
      config.coordinateDensity,
      `"${point.url}"`,
      `"${point.url}"` // PhantomBuster uses the same URL format
    ]);

    console.log('📄 [CSV] Joining CSV content...');
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');
    
    console.log(`📄 [CSV] CSV content generated (${csvContent.length} characters, ${csvRows.length} rows)`);

    // Log grid points to database for future reference
    if (scrapingSession) {
      console.log('💾 [CSV] Preparing grid points for database storage...');
      const gridPointsData = gridPoints.map((point, index) => ({
        scraping_session_id: scrapingSession.id,
        point_id: index + 1,
        latitude: point.lat,
        longitude: point.lng,
        google_maps_url: point.url,
        created_at: new Date().toISOString()
      }));

      console.log(`💾 [CSV] Attempting to insert ${gridPointsData.length} grid points to database...`);
      
      // For large datasets, we might need to batch the inserts
      if (gridPointsData.length > 10000) {
        console.log('📦 [CSV] Large dataset detected, using batch insert...');
        const batchSize = 1000;
        
        for (let i = 0; i < gridPointsData.length; i += batchSize) {
          const batch = gridPointsData.slice(i, i + batchSize);
          const batchNumber = Math.floor(i / batchSize) + 1;
          const totalBatches = Math.ceil(gridPointsData.length / batchSize);
          
          console.log(`📤 [CSV] Inserting batch ${batchNumber}/${totalBatches} (${batch.length} points)...`);
          
          const { error: batchError } = await supabase
            .from('scraping_grid_points')
            .insert(batch);

          if (batchError) {
            console.error(`❌ [CSV] Error inserting batch ${batchNumber}:`, batchError);
          } else {
            console.log(`✅ [CSV] Batch ${batchNumber} inserted successfully`);
          }
        }
      } else {
        console.log('📤 [CSV] Inserting all grid points in single operation...');
        const { error: gridError } = await supabase
          .from('scraping_grid_points')
          .insert(gridPointsData);

        if (gridError) {
          console.error('❌ [CSV] Error logging grid points:', gridError);
        } else {
          console.log('✅ [CSV] All grid points inserted successfully');
        }
      }
    }

    console.log(`🎉 [CSV] CSV generation completed in ${Date.now() - startTime}ms`);

    return NextResponse.json({
      success: true,
      csv: csvContent,
      totalPoints: gridPoints.length,
      sessionId: scrapingSession?.id,
      message: 'CSV generated successfully',
      processingTime: Date.now() - startTime
    });

  } catch (error) {
    console.error('💥 [CSV] Error generating CSV:', error);
    console.error('💥 [CSV] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: Date.now() - startTime,
      gridPointsLength: gridPoints.length,
      configDetails: {
        searchQuery: config.searchQuery,
        coordinateDensity: config.coordinateDensity,
        boundsSize: `${Math.abs(config.bounds.east - config.bounds.west)}° × ${Math.abs(config.bounds.north - config.bounds.south)}°`
      }
    });
    
    return NextResponse.json(
      { error: 'Failed to generate CSV', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function directScrapeGoogleMaps(config: ScrapingConfig, gridPoints: GridPoint[]) {
  try {
    // Log the scraping session to database
    const { data: scrapingSession, error: sessionError } = await supabase
      .from('scraping_sessions')
      .insert({
        search_query: config.searchQuery,
        coordinate_density: config.coordinateDensity,
        bounds: config.bounds,
        scraping_mode: 'direct',
        total_points: gridPoints.length,
        status: 'scraping_started',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error logging scraping session:', sessionError);
      return NextResponse.json(
        { error: 'Failed to log scraping session' },
        { status: 500 }
      );
    }

    // For demo purposes, we'll simulate scraping data
    // In a real implementation, you would use a proper scraping library
    const scrapedData = await simulateDirectScraping(gridPoints, config);

    // Update session status
    await supabase
      .from('scraping_sessions')
      .update({
        status: 'completed',
        scraped_results: scrapedData,
        completed_at: new Date().toISOString()
      })
      .eq('id', scrapingSession.id);

    return NextResponse.json({
      success: true,
      scrapedData,
      totalPoints: gridPoints.length,
      sessionId: scrapingSession.id,
      message: 'Direct scraping completed successfully'
    });

  } catch (error) {
    console.error('Error in direct scraping:', error);
    return NextResponse.json(
      { error: 'Failed to scrape data' },
      { status: 500 }
    );
  }
}

async function simulateDirectScraping(gridPoints: GridPoint[], config: ScrapingConfig) {
  // Simulate scraping delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Generate mock scraped data
  const scrapedData = gridPoints.map((point, index) => ({
    pointId: index + 1,
    coordinates: {
      lat: point.lat,
      lng: point.lng
    },
    searchQuery: config.searchQuery,
    businesses: [
      {
        name: `Sample ${config.searchQuery} Business ${index + 1}`,
        address: `${Math.floor(Math.random() * 9999)} Sample St, Sample City, CA`,
        rating: (Math.random() * 2 + 3).toFixed(1), // 3.0 to 5.0
        phone: `(555) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
        website: `https://sample-business-${index + 1}.com`,
        placeId: `sample_place_id_${index + 1}`
      },
      {
        name: `Another ${config.searchQuery} ${index + 1}`,
        address: `${Math.floor(Math.random() * 9999)} Another St, Sample City, CA`,
        rating: (Math.random() * 2 + 3).toFixed(1),
        phone: `(555) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
        website: `https://another-business-${index + 1}.com`,
        placeId: `another_place_id_${index + 1}`
      }
    ],
    scrapedAt: new Date().toISOString()
  }));

  return scrapedData;
}

// GET endpoint for health check
export async function GET() {
  return NextResponse.json({
    message: 'Google Maps Scraper API is running',
    endpoints: {
      post: {
        generate_csv: 'Generate PhantomBuster CSV file',
        direct_scrape: 'Directly scrape Google Maps data'
      }
    },
    version: '1.0.0'
  });
} 