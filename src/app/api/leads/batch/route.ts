import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { createServerSupabaseAdminClient } from '@/utils/supabase/admin';

const SERPER_API_KEY = '5f350750951167104f02ccfe7a9a1fb1daf63f84';

interface SerperResult {
  title: string;
  link: string;
  snippet: string;
}

interface SerperResponse {
  organic: SerperResult[];
  knowledgeGraph?: any;
  answerBox?: any;
}

function extractLeadsFromResults(results: SerperResult[]): any[] {
  return results.map((result) => {
    let domain = '';
    try {
      domain = new URL(result.link).hostname.replace('www.', '');
    } catch (_) {}
    // Very naive company name extraction from title (first part before dash or pipe)
    const companyName = result.title.split(/[-|]/)[0].trim();
    return {
      title: result.title,
      url: result.link,
      description: result.snippet,
      company_name: companyName,
      domain,
      metadata: { original_result: result },
      status: 'new',
      score: 50,
    };
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const adminSupabase = createServerSupabaseAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // org lookup
    const { data: userData, error: userError } = await adminSupabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();
    if (userError || !userData?.organization_id) {
      return NextResponse.json({ error: 'User organization not found' }, { status: 400 });
    }

    const body = await request.json();
    const {
      queries = [],
      pages = 1,
      num = 10,
      country = 'us',
      language = 'en',
      location,
      clay_url,
    } = body;

    if (!Array.isArray(queries) || queries.length === 0) {
      return NextResponse.json({ error: 'queries must be a non-empty array' }, { status: 400 });
    }

    if (!clay_url) {
      return NextResponse.json({ error: 'Clay webhook URL is required' }, { status: 400 });
    }

    // Validate clay_url format
    if (!clay_url.startsWith('https://')) {
      return NextResponse.json({ error: 'clay_url must be a valid HTTPS URL' }, { status: 400 });
    }

    const batchResults: any[] = [];

    for (const q of queries) {
      const query = q.trim();
      if (!query) continue;
      let pagesFetched = 0;
      let leadsAdded = 0;

      for (let i = 0; i < pages; i++) {
        // Determine next page number - find the lowest missing page
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
          for (let j = 1; j <= pageNumbers[pageNumbers.length - 1]; j++) {
            if (!pageNumbers.includes(j)) {
              nextPage = j;
              foundGap = true;
              break;
            }
          }
          
          // If no gaps found, use the next sequential page
          if (!foundGap) {
            nextPage = pageNumbers[pageNumbers.length - 1] + 1;
          }
        }

        // Build serper payload
        const serperData: any = {
          q: query,
          gl: country,
          hl: language,
          num,
          page: nextPage,
        };
        if (location) serperData.location = location;

        const serperRes = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': SERPER_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(serperData),
        });

        if (!serperRes.ok) {
          console.error('Serper error', await serperRes.text());
          break;
        }

        const serperJson: SerperResponse = await serperRes.json();
        const organic = serperJson.organic || [];

        // Insert search record
        const { data: searchRecord, error: searchError } = await adminSupabase
          .from('searches')
          .insert({
            query,
            page: nextPage,
            source: 'serper.dev',
            search_type: 'search', // Batch searches are generic searches
            parameters: serperData,
            results_count: organic.length,
            raw_response: serperJson,
            status: 'completed',
            organization_id: userData.organization_id,
            user_id: user.id,
            clay_url: clay_url,
          })
          .select()
          .single();

        if (searchError) {
          console.error('Error logging search', searchError);
          break;
        }

        const leads = extractLeadsFromResults(organic);
        const leadsWithMeta = leads.map((l) => ({
          ...l,
          search_id: searchRecord.id,
          organization_id: userData.organization_id,
          user_id: user.id,
        }));

        const { data: savedLeads, error: leadsError } = await adminSupabase
          .from('leads')
          .upsert(leadsWithMeta, { onConflict: 'organization_id,url' })
          .select();

        if (leadsError) {
          console.error('Lead insert error', leadsError);
        }

        leadsAdded += savedLeads?.length || 0;
        pagesFetched += 1;

        // If no new organic results, stop early
        if (organic.length === 0) break;
      }

      batchResults.push({ query, pagesFetched, leadsAdded });
    }

    return NextResponse.json({ success: true, batchResults });
  } catch (err) {
    console.error('Batch search error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
} 