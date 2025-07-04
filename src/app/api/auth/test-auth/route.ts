import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/utils/supabase/server';

// this is the way of using supabase server side

export async function POST(request: Request) {
  try {
    // important use this inside the post request
    const supabase = createServerSupabaseClient();
    
    // Get authenticated user - more secure than getSession()
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json({ message: 'Authentication successful' });
  } catch (error) {
    console.error('Error in test-auth API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}