import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { createServerSupabaseAdminClient } from '@/utils/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const adminSupabase = createServerSupabaseAdminClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user data with organization
    const { data: userData, error: userError } = await adminSupabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.organization_id) {
      return NextResponse.json({ error: 'User organization not found' }, { status: 400 });
    }

    // Get search history with lead counts
    const { data: searches, error: searchError } = await adminSupabase
      .from('searches')
      .select(`
        id,
        created_at,
        query,
        page,
        results_count,
        status,
        parameters,
        source,
        search_type,
        leads!inner(count)
      `)
      .eq('organization_id', userData.organization_id)
      .eq('source', 'serper.dev')
      .order('created_at', { ascending: false })
      .limit(50);

    if (searchError) {
      console.error('Error fetching searches:', searchError);
      return NextResponse.json({ error: 'Failed to fetch searches' }, { status: 500 });
    }

    // Group searches by query and aggregate data
    const searchGroups = searches.reduce((acc: any, search: any) => {
      const key = search.query;
      if (!acc[key]) {
        acc[key] = {
          query: search.query,
          first_search: search.created_at,
          last_search: search.created_at,
          total_pages: 0,
          total_leads: 0,
          search_ids: []
        };
      }
      
      acc[key].total_pages = Math.max(acc[key].total_pages, search.page);
      acc[key].total_leads += search.leads?.length || 0;
      acc[key].search_ids.push(search.id);
      
      if (new Date(search.created_at) > new Date(acc[key].last_search)) {
        acc[key].last_search = search.created_at;
      }
      if (new Date(search.created_at) < new Date(acc[key].first_search)) {
        acc[key].first_search = search.created_at;
      }
      
      return acc;
    }, {});

    const searchHistory = Object.values(searchGroups);

    return NextResponse.json({ 
      success: true, 
      searches: searchHistory 
    });

  } catch (error) {
    console.error('Error in GET /api/leads/searches:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 