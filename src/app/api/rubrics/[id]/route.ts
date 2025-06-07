import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { type, data } = body;

    let tableName: string;
    switch (type) {
      case 'category':
        tableName = 'rubric_categories';
        break;
      case 'field':
        tableName = 'rubric_fields';
        break;
      case 'level':
        tableName = 'rubric_levels';
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid type specified' },
          { status: 400 }
        );
    }

    const { data: updatedItem, error } = await supabase
      .from(tableName)
      .update(data)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating ${type}:`, error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      [type]: updatedItem,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error updating rubric item:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update rubric item' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type) {
      return NextResponse.json(
        { success: false, error: 'Type parameter is required' },
        { status: 400 }
      );
    }

    let tableName: string;
    switch (type) {
      case 'category':
        tableName = 'rubric_categories';
        break;
      case 'field':
        tableName = 'rubric_fields';
        break;
      case 'level':
        tableName = 'rubric_levels';
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid type specified' },
          { status: 400 }
        );
    }

    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error(`Error deleting ${type}:`, error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${type} deleted successfully`,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error deleting rubric item:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete rubric item' },
      { status: 500 }
    );
  }
}