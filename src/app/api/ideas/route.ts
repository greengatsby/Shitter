import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');

    let query = supabase
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: error.message 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ideas: data,
      count: data?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error fetching ideas:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch ideas' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'ID parameter is required' 
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('ideas')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase delete error:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: error.message 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Idea deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error deleting idea:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to delete idea' 
      },
      { status: 500 }
    );
  }
}