import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface BestPractice {
  id?: string;
  title: string;
  description: string;
  example?: string;
  priority: number;
  practice_type?: 'rule' | 'detailed' | 'guideline';
  source?: string;
}

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

// PUT - Update an existing best practice
export async function PUT(request: NextRequest) {
  try {
    const practice: BestPractice & { id: string } = await request.json();

    // Validate required fields
    if (!practice.id || !practice.title || !practice.description || !practice.priority) {
      return NextResponse.json(
        { success: false, error: 'ID, title, description, and priority are required' },
        { status: 400 }
      );
    }

    // Validate practice_type if provided
    if (practice.practice_type && !['rule', 'detailed', 'guideline'].includes(practice.practice_type)) {
      return NextResponse.json(
        { success: false, error: `Invalid practice_type: ${practice.practice_type}` },
        { status: 400 }
      );
    }

    // Prepare data for update
    const updateData = {
      title: practice.title.trim(),
      description: practice.description.trim(),
      example: practice.example?.trim() || null,
      priority: practice.priority,
      practice_type: practice.practice_type || 'rule',
      source: practice.source?.trim() || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('email_best_practices')
      .update(updateData)
      .eq('id', practice.id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update best practice' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      practice: data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating best practice:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a best practice
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const practiceId = searchParams.get('id');

    if (!practiceId) {
      return NextResponse.json(
        { success: false, error: 'Practice ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('email_best_practices')
      .delete()
      .eq('id', practiceId);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete best practice' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Best practice deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error deleting best practice:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 