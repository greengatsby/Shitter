import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('ideas')
      .select('*')
      .eq('id', params.id)
      .single();

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

    if (!data) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Idea not found' 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      idea: data,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error fetching idea:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch idea' 
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    // Validate that we're only updating allowed fields
    const allowedFields = ['title', 'status', 'idea', 'problem', 'solution', 'outreach', 'market'];
    const updateData: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No valid fields to update' 
        },
        { status: 400 }
      );
    }

    // Always update the updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('ideas')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Supabase update error:', error);
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
      idea: data,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error updating idea:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to update idea' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await supabase
      .from('ideas')
      .delete()
      .eq('id', params.id);

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