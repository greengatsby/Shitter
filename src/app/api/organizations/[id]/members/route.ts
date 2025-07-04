import { NextRequest, NextResponse } from 'next/server'
import { organizationHelpers } from '@/utils/supabase'
import { createServerSupabaseClient } from '@/utils/supabase/server'

// GET /api/organizations/[id]/members - Get organization members
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const organizationId = params.id;
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    const { data, error } = await organizationHelpers.getOrganizationClients(
      organizationId,
      supabase
    );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      clients: data || []
    });

  } catch (error) {
    console.error('Get members error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// POST /api/organizations/[id]/members - Invite user to organization
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const organizationId = params.id;
    const { phone_number, role = 'member' } = await request.json();

    if (!phone_number) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Validate phone number format
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/
    if (!phoneRegex.test(phone_number)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    // Validate role
    if (!['member', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Role must be either "member" or "admin"' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    const { data, error } = await organizationHelpers.handleAddClientToOrg(
      organizationId,
      phone_number,
      role,
      supabase
    );

    if (error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'User with that phone number not found. They need to create an account first.' },
          { status: 404 }
        )
      }
      if (error.message.includes('already in this organization') || error.message.includes('already a member')) {
        return NextResponse.json(
          { error: 'A client with this phone number is already in this organization' },
          { status: 409 }
        )
      }
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(
          { error: 'You do not have permission to invite clients to this organization' },
          { status: 403 }
        )
      }
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      client: data,
      message: 'Client added successfully'
    });
  } catch (error) {
    console.error('Invite user error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 