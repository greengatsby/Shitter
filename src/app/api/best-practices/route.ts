import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const priority = searchParams.get('priority');
    const source = searchParams.get('source');
    const limit = searchParams.get('limit');

    let query = supabase
      .from('email_best_practices')
      .select('*')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    // Apply filters if provided
    if (priority && ['1', '2', '3'].includes(priority)) {
      query = query.eq('priority', parseInt(priority));
    }

    if (source) {
      query = query.ilike('source', `%${source}%`);
    }

    if (limit && !isNaN(parseInt(limit))) {
      query = query.limit(parseInt(limit));
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch best practices' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      practices: data || [],
      count: data?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching best practices:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 