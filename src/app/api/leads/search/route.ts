import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { createServerSupabaseAdminClient } from '@/utils/supabase/admin';

const SERPER_API_KEY = '5f350750951167104f02ccfe7a9a1fb1daf63f84';

interface SerperResult {
  title: string;
  link: string;
  snippet: string;
  domain?: string;
}

interface SerperResponse {
  organic: SerperResult[];
  knowledgeGraph?: any;
  answerBox?: any;
  searchInformation?: {
    totalResults: string;
  };
}

function extractLeadsFromResults(results: SerperResult[]): any[] {
  return results.map(result => {
    // Extract domain from URL
    let domain = '';
    try {
      const url = new URL(result.link);
      domain = url.hostname.replace('www.', '');
    } catch (e) {
      // If URL parsing fails, try to extract from link text
      const domainMatch = result.link.match(/https?:\/\/([^\/]+)/);
      domain = domainMatch ? domainMatch[1].replace('www.', '') : '';
    }

    // Extract potential company name from title or domain
    let companyName = '';
    
    // Try to extract from title (look for patterns like "Company Name - " or "About Company")
    const titleMatch = result.title.match(/^([^-|]+?)(?:\s*[-|]|$)/);
    if (titleMatch) {
      companyName = titleMatch[1].trim();
    } else {
      // Fallback to domain-based company name
      companyName = domain.split('.')[0];
    }

    return {
      title: result.title,
      url: result.link,
      description: result.snippet,
      company_name: companyName,
      domain,
      metadata: {
        original_result: result
      },
      status: 'new',
      score: 50 // Default score, can be enhanced later
    };
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const adminSupabase = createServerSupabaseAdminClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.organization_id) {
      return NextResponse.json({ error: 'User organization not found' }, { status: 400 });
    }

    const body = await request.json();
    const { query, source, type, country = 'us', location, language = 'en', num = 10, clay_url } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    if (!clay_url) {
      return NextResponse.json({ error: 'Clay webhook URL is required' }, { status: 400 });
    }

    // Validate clay_url format
    if (!clay_url.startsWith('https://')) {
      return NextResponse.json({ error: 'clay_url must be a valid HTTPS URL' }, { status: 400 });
    }

    // Determine next page to fetch based on previous searches
    // Get all existing pages for this query to find gaps in the sequence
    const { data: existingPages } = await adminSupabase
      .from('searches')
      .select('page')
      .eq('organization_id', userData.organization_id)
      .eq('query', query)
      .order('page', { ascending: true });

    let nextPage: number = 1;
    
    if (existingPages && existingPages.length > 0) {
      const pageNumbers = existingPages.map(p => p.page as number).sort((a, b) => a - b);
      
      // Find the first missing page in the sequence
      let foundGap = false;
      for (let i = 1; i <= pageNumbers[pageNumbers.length - 1]; i++) {
        if (!pageNumbers.includes(i)) {
          nextPage = i;
          foundGap = true;
          break;
        }
      }
      
      // If no gaps found, use the next sequential page
      if (!foundGap) {
        nextPage = pageNumbers[pageNumbers.length - 1] + 1;
      }
    }

    // Prepare serper.dev request (use page for pagination)
    const serperData = {
      q: query,
      gl: country,
      hl: language,
      num,
      page: nextPage,
      ...(location && { location })
    };

    // Debug logging
    console.log('Request body received:', { query, country, language, location });
    console.log('Serper API payload:', serperData);

    // Call serper.dev API
    const serperResponse = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(serperData),
    });

    if (!serperResponse.ok) {
      throw new Error(`Serper API error: ${serperResponse.statusText}`);
    }

    const serperResults: SerperResponse = await serperResponse.json();

    // Debug: Log actual results count
    console.log('Serper API returned results count:', serperResults.organic?.length || 0);
    console.log('Requested num:', num);
    
    // Debug: Log sample results to see language/country issues
    if (serperResults.organic && serperResults.organic.length > 0) {
      console.log('Sample results (first 3):');
      serperResults.organic.slice(0, 3).forEach((result, index) => {
        console.log(`Result ${index + 1}:`, {
          title: result.title,
          link: result.link,
          snippet: result.snippet.substring(0, 100) + '...'
        });
      });
    }

    // Log the search to database
    const { data: searchRecord, error: searchError } = await adminSupabase
      .from('searches')
      .insert({
        query,
        page: nextPage,
        source: source || 'serper.dev',
        search_type: type || 'search',
        parameters: serperData,
        results_count: serperResults.organic?.length || 0,
        raw_response: serperResults,
        status: 'completed',
        organization_id: userData.organization_id,
        user_id: user.id,
        clay_url: clay_url
      })
      .select()
      .single();

    if (searchError) {
      console.error('Error logging search:', searchError);
      return NextResponse.json({ error: 'Failed to log search' }, { status: 500 });
    }

    // Extract leads from results
    const leads = extractLeadsFromResults(serperResults.organic || []);

    // Save leads to database
    const leadsWithSearchId = leads.map(lead => ({
      ...lead,
      search_id: searchRecord.id,
      organization_id: userData.organization_id,
      user_id: user.id
    }));

    // Save leads with upsert to avoid duplicates
    const { data: savedLeads, error: leadsError } = await adminSupabase
      .from('leads')
      .upsert(leadsWithSearchId, { onConflict: 'organization_id,url' })
      .select();

    if (leadsError) {
      console.error('Error saving leads:', leadsError);
      return NextResponse.json({ error: 'Failed to save leads' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      search_id: searchRecord.id,
      query,
      results_count: serperResults.organic?.length || 0,
      leads: savedLeads,
      raw_response: serperResults
    });

  } catch (error) {
    console.error('Lead search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const adminSupabase = createServerSupabaseAdminClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.organization_id) {
      return NextResponse.json({ error: 'User organization not found' }, { status: 400 });
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const searchId = url.searchParams.get('search_id');
    const status = url.searchParams.get('status');

    const offset = (page - 1) * limit;

    let query = adminSupabase
      .from('leads')
      .select(`
        *,
        searches(query, created_at)
      `)
      .eq('organization_id', userData.organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (searchId) {
      query = query.eq('search_id', searchId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: leads, error } = await query;

    if (error) {
      console.error('Error fetching leads:', error);
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    return NextResponse.json({
      leads,
      page,
      limit
    });

  } catch (error) {
    console.error('Error in leads GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 