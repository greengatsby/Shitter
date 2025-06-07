import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeFields = searchParams.get('include_fields') === 'true';
    const includeLevels = searchParams.get('include_levels') === 'true';

    // Get categories
    const { data: categories, error: categoriesError } = await supabase
      .from('rubric_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      return NextResponse.json({ success: false, error: categoriesError.message }, { status: 500 });
    }

    if (!includeFields) {
      return NextResponse.json({
        success: true,
        categories,
        timestamp: new Date().toISOString()
      });
    }

    // Get fields for each category
    const categoriesWithFields = await Promise.all(
      categories.map(async (category) => {
        const { data: fields, error: fieldsError } = await supabase
          .from('rubric_fields')
          .select('*')
          .eq('category_id', category.id)
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (fieldsError) {
          console.error('Error fetching fields:', fieldsError);
          throw fieldsError;
        }

        if (!includeLevels) {
          return { ...category, fields };
        }

        // Get levels for each field
        const fieldsWithLevels = await Promise.all(
          fields.map(async (field) => {
            const { data: levels, error: levelsError } = await supabase
              .from('rubric_levels')
              .select('*')
              .eq('field_id', field.id)
              .order('level', { ascending: true });

            if (levelsError) {
              console.error('Error fetching levels:', levelsError);
              throw levelsError;
            }

            return { ...field, levels };
          })
        );

        return { ...category, fields: fieldsWithLevels };
      })
    );

    return NextResponse.json({
      success: true,
      categories: categoriesWithFields,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error fetching rubrics:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch rubrics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    switch (type) {
      case 'category':
        const { data: newCategory, error: categoryError } = await supabase
          .from('rubric_categories')
          .insert(data)
          .select()
          .single();

        if (categoryError) {
          return NextResponse.json({ success: false, error: categoryError.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          category: newCategory,
          timestamp: new Date().toISOString()
        });

      case 'field':
        const { data: newField, error: fieldError } = await supabase
          .from('rubric_fields')
          .insert(data)
          .select()
          .single();

        if (fieldError) {
          return NextResponse.json({ success: false, error: fieldError.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          field: newField,
          timestamp: new Date().toISOString()
        });

      case 'level':
        const { data: newLevel, error: levelError } = await supabase
          .from('rubric_levels')
          .insert(data)
          .select()
          .single();

        if (levelError) {
          return NextResponse.json({ success: false, error: levelError.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          level: newLevel,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid type specified' },
          { status: 400 }
        );
    }

  } catch (error: any) {
    console.error('Error creating rubric item:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create rubric item' },
      { status: 500 }
    );
  }
}