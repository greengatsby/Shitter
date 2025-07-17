import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface EmailTemplate {
  id?: string;
  name: string;
  description?: string;
  category?: string;
  subject_line: string;
  body: string;
  is_active?: boolean;
  use_case?: string;
  target_audience?: string;
  tags?: string[];
  variables?: string[];
}

// GET - Fetch all email templates with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const isActive = searchParams.get('is_active');
    const limit = searchParams.get('limit');

    let query = supabase
      .from('email_templates')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters if provided
    if (category) {
      query = query.eq('category', category);
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    if (limit && !isNaN(parseInt(limit))) {
      query = query.limit(parseInt(limit));
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch email templates' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      templates: data || [],
      count: data?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching email templates:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new email template
export async function POST(request: NextRequest) {
  try {
    const template: EmailTemplate = await request.json();

    // Validate required fields
    if (!template.name || !template.subject_line || !template.body) {
      return NextResponse.json(
        { success: false, error: 'Name, subject line, and body are required' },
        { status: 400 }
      );
    }

    // Prepare data for insertion
    const templateData = {
      name: template.name.trim(),
      description: template.description?.trim() || null,
      category: template.category || 'general',
      subject_line: template.subject_line.trim(),
      body: template.body.trim(),
      is_active: template.is_active !== false, // Default to true
      use_case: template.use_case?.trim() || null,
      target_audience: template.target_audience?.trim() || null,
      tags: template.tags || [],
      variables: template.variables || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('email_templates')
      .insert([templateData])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create email template' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      template: data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error creating email template:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update an existing email template
export async function PUT(request: NextRequest) {
  try {
    const template: EmailTemplate & { id: string } = await request.json();

    // Validate required fields
    if (!template.id || !template.name || !template.subject_line || !template.body) {
      return NextResponse.json(
        { success: false, error: 'ID, name, subject line, and body are required' },
        { status: 400 }
      );
    }

    // Prepare data for update
    const updateData = {
      name: template.name.trim(),
      description: template.description?.trim() || null,
      category: template.category || 'general',
      subject_line: template.subject_line.trim(),
      body: template.body.trim(),
      is_active: template.is_active !== false,
      use_case: template.use_case?.trim() || null,
      target_audience: template.target_audience?.trim() || null,
      tags: template.tags || [],
      variables: template.variables || [],
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('email_templates')
      .update(updateData)
      .eq('id', template.id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update email template' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      template: data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating email template:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete an email template
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');

    if (!templateId) {
      return NextResponse.json(
        { success: false, error: 'Template ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', templateId);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete email template' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email template deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error deleting email template:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 