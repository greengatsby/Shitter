import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { createServerSupabaseAdminClient } from '@/utils/supabase/admin';

export async function GET(request: NextRequest, { params }: { params: { searchId: string } }) {
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

    const searchId = params.searchId;

    // Get the search details
    const { data: search, error: searchError } = await adminSupabase
      .from('searches')
      .select('*')
      .eq('id', searchId)
      .eq('organization_id', userData.organization_id)
      .single();

    if (searchError || !search) {
      return NextResponse.json({ error: 'Search not found' }, { status: 404 });
    }

    // Get all leads for this query (across all pages)
    const { data: leads, error: leadsError } = await adminSupabase
      .from('leads')
      .select(`
        *,
        searches!inner(query, created_at)
      `)
      .eq('searches.query', search.query)
      .eq('organization_id', userData.organization_id)
      .order('created_at', { ascending: false });

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      search,
      leads: leads || []
    });

  } catch (error) {
    console.error('Error in GET /api/leads/searches/[searchId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 