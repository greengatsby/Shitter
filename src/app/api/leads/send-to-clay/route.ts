import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { createServerSupabaseAdminClient } from '@/utils/supabase/admin';

interface Lead {
  id: string;
  title: string;
  url: string;
  description: string;
  company_name: string;
  domain: string;
  status: string;
  score: number;
  created_at: string;
  sent_to_clay: boolean;
  clay_sent_at: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const adminSupabase = createServerSupabaseAdminClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user's organization
    const { data: userData, error: userDataError } = await adminSupabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get leads that haven't been sent to Clay yet, including search info
    const { data: leads, error: leadsError } = await adminSupabase
      .from('leads')
      .select(`
        *,
        searches(clay_url)
      `)
      .eq('organization_id', userData.organization_id)
      .eq('sent_to_clay', false)
      .order('created_at', { ascending: false });

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No new leads to send to Clay',
        leadsSent: 0 
      });
    }

    // Group leads by clay_url
    const leadsByClayUrl = leads.reduce((acc: any, lead: any) => {
      const clayUrl = lead.searches?.clay_url;
      if (!clayUrl) {
        console.error(`Lead ${lead.id} has no clay_url - this should not happen since clay_url is required`);
        return acc;
      }
      
      if (!acc[clayUrl]) {
        acc[clayUrl] = [];
      }
      acc[clayUrl].push(lead);
      return acc;
    }, {});

    // Check if we have any leads with valid clay_url
    if (Object.keys(leadsByClayUrl).length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'No leads found with valid Clay webhook URLs',
        leadsSent: 0 
      });
    }

    // Send leads to Clay for each unique clay_url
    const allClayResults = [];
    for (const [clayUrl, clayLeads] of Object.entries(leadsByClayUrl)) {
      const clayResults = await sendLeadsToClayWebhook(clayLeads as Lead[], clayUrl);
      allClayResults.push(...clayResults);
    }

    // Mark leads as sent to Clay
    const leadsToUpdate = allClayResults
      .filter(result => result.status === 'success')
      .map(result => result.leadId);

    if (leadsToUpdate.length > 0) {
      const { error: updateError } = await adminSupabase
        .from('leads')
        .update({ 
          sent_to_clay: true, 
          clay_sent_at: new Date().toISOString(),
          clay_response: { results: allClayResults }
        })
        .in('id', leadsToUpdate);

      if (updateError) {
        console.error('Error updating lead Clay status:', updateError);
        return NextResponse.json({ error: 'Failed to update lead status' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully sent ${leadsToUpdate.length} leads to Clay`,
      leadsSent: leadsToUpdate.length,
      totalLeads: leads.length,
      results: allClayResults
    });

  } catch (error) {
    console.error('Error in send-to-clay:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

async function sendLeadsToClayWebhook(leads: Lead[], clayWebhookUrl: string) {
  const results = [];
  
  for (const lead of leads) {
    try {
      const clayPayload = {
        lead_id: lead.id,
        title: lead.title,
        url: lead.url,
        description: lead.description,
        company_name: lead.company_name,
        domain: lead.domain,
        status: lead.status,
        score: lead.score,
        created_at: lead.created_at,
        source: 'leads_search'
      };
      
      const response = await fetch(clayWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clayPayload)
      });
      
      if (response.ok) {
        results.push({ 
          leadId: lead.id, 
          company: lead.company_name, 
          status: 'success' 
        });
      } else {
        results.push({ 
          leadId: lead.id, 
          company: lead.company_name, 
          status: 'failed', 
          error: response.statusText 
        });
      }
    } catch (error) {
      results.push({ 
        leadId: lead.id,
        company: lead.company_name, 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
} 