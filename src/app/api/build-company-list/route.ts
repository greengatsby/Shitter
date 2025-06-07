import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Required Environment Variables:
// OPENAI_API_KEY - Your OpenAI API key
// APOLLO_API_KEY - Your Apollo.io API key

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to clean JSON responses that may be wrapped in markdown code blocks
function cleanJsonResponse(content: string): string {
  let cleaned = content.trim();
  
  // Remove markdown code blocks if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  return cleaned.trim();
}

interface CompanySearchResult {
  id: string;  
  name: string;
  website_url?: string;
  linkedin_url?: string;
  industry?: string;
  employee_count?: number;
  phone?: string;
  founded_year?: number;
  description?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
}

interface ApolloSearchResponse {
  organizations: CompanySearchResult[];
  total_entries: number;
  page: number;
  per_page: number;
}

export async function POST(request: NextRequest) {
  try {
    const { ideaId, ideaData } = await request.json();

    // Validate required environment variables
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    if (!process.env.APOLLO_API_KEY) {
      throw new Error('APOLLO_API_KEY environment variable is required');
    }

    // Validate input data
    if (!ideaId || !ideaData) {
      throw new Error('ideaId and ideaData are required');
    }

    // Step 1: Generate initial keywords using AI
    const keywordResponse = await openai.chat.completions.create({
      // model: "gpt-o3",
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert at identifying target companies for B2B sales. Given a business idea, generate VERY SPECIFIC and NICHE keywords that would identify smaller companies who would actually purchase this service.

AVOID broad terms that large corporations would match on (like "social media", "technology", "AI", "marketing").

Focus on:
- Specific industry niches and verticals  
- Unique business model indicators
- Specific pain points or use cases
- Niche software categories or job titles
- Emerging market segments

Target company profile: 50-2000 employees, established businesses with specific needs.

Return your response as a JSON object:
{
  "keywords": ["very_specific_term1", "niche_keyword2"], // MAX 3-4 NICHE keywords
  "reasoning": "Why these specific terms identify our target market",
  "employee_count_min": 50,
  "employee_count_max": 2000
}

CRITICAL: Use highly specific, niche terms that large corporations wouldn't match on.`
        },
        {
          role: "user",
          content: `Business Idea Data: ${JSON.stringify(ideaData, null, 2)}`
        }
      ],
      temperature: 0.7,
    });

    const cleanKeywordResponse = cleanJsonResponse(keywordResponse.choices[0].message.content || '{}');
    const initialKeywords = JSON.parse(cleanKeywordResponse);
    console.log('Generated initial keywords:', initialKeywords);

    // Step 2: Search Apollo API with initial keywords
    let searchResults = await searchApolloAPI(initialKeywords);
    let iterationCount = 0;
    const maxIterations = 3;
    
    // Maintain conversation context for AI
    const conversationHistory: Array<{
      iteration: number;
      keywords: any;
      results: CompanySearchResult[];
      companiesFound: number;
      decision?: any;
    }> = [
      {
        iteration: 0,
        keywords: initialKeywords,
        results: searchResults.organizations.slice(0, 10), // First 10 for context
        companiesFound: searchResults.organizations.length
      }
    ];

    // Step 3: AI review and refinement loop with conversation context
    while (iterationCount < maxIterations) {
      const reviewResponse = await openai.chat.completions.create({
        // model: "gpt-o3",
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are reviewing search results from Apollo API for potential B2B customers.

You can see the FULL CONVERSATION HISTORY of previous search attempts. Use this to:
- Learn from previous attempts that didn't work well
- Avoid repeating the same keywords/strategies
- Understand what types of companies were found before
- Make progressively better refinements

Available actions:
- search_refinement: Try different keywords/filters (avoid repeating previous attempts)
- finalize_results: Accept current results as final (if good quality or reached good diversity)

Return your response as JSON:
{
  "action": "search_refinement" | "finalize_results",
  "reasoning": "Reference previous attempts and explain strategy for finding SMALLER, MORE RELEVANT companies",
  "refinements": {
    "keywords": ["ultra_specific_niche_term"], // MAX 2-3 ULTRA-SPECIFIC keywords, COMPLETELY DIFFERENT approach
    "employee_count_min": 50,
    "employee_count_max": 1000
  } // only if action is "search_refinement"
}

Evaluation criteria:
- REJECT if you see: LinkedIn, Netflix, Deloitte, Oracle, Microsoft, Amazon, Google, Meta, IBM
- REJECT if companies have >2000 employees  
- REJECT if companies are Fortune 500 or well-known brands
- ACCEPT smaller, niche companies that actually need this service
- Look for mid-market companies, agencies, e-commerce brands, SaaS startups
- Prioritize finding companies you've never heard of (good sign!)`
          },
          {
            role: "user", 
            content: `Business Idea: ${JSON.stringify(ideaData, null, 2)}

CONVERSATION HISTORY (${conversationHistory.length} iterations so far):
${conversationHistory.map(h => `
Iteration ${h.iteration}:
- Keywords used: ${JSON.stringify(h.keywords.keywords || h.keywords)}
- Companies found: ${h.companiesFound}
- Sample results: ${JSON.stringify(h.results.slice(0, 5), null, 2)}
${h.decision ? `- AI Decision: ${h.decision.action} - ${h.decision.reasoning}` : ''}
`).join('\n')}

CURRENT SITUATION:
- Latest search found ${searchResults.organizations.length} companies
- Current results sample: ${JSON.stringify(searchResults.organizations.slice(0, 10), null, 2)}

Based on the full conversation history above, decide whether to refine the search further or finalize these results.`
          }
        ],
        temperature: 0.3,
      });

      const cleanReviewResponse = cleanJsonResponse(reviewResponse.choices[0].message.content || '{}');
      const reviewDecision = JSON.parse(cleanReviewResponse);
      console.log(`Review iteration ${iterationCount + 1}:`, reviewDecision);

      // Add decision to the most recent conversation history entry
      conversationHistory[conversationHistory.length - 1].decision = reviewDecision;

      if (reviewDecision.action === 'finalize_results') {
        console.log('AI decided to finalize results');
        break;
      } else if (reviewDecision.action === 'search_refinement' && reviewDecision.refinements) {
        console.log('AI suggested refinements, searching again...');
        searchResults = await searchApolloAPI(reviewDecision.refinements);
        iterationCount++;
        // Add new iteration to conversation history
        conversationHistory.push({
          iteration: iterationCount,
          keywords: reviewDecision.refinements,
          results: searchResults.organizations.slice(0, 10),
          companiesFound: searchResults.organizations.length
        });

        console.log('Conversation history:', JSON.stringify(conversationHistory, null, 2));
      } else {
        break;
      }
    }

    // Step 4: Send final results to Clay webhook
    const clayResponse = await sendToClayWebhook(searchResults.organizations, ideaId);

    return NextResponse.json({
      success: true,
      message: `Found ${searchResults.organizations.length} companies and sent to Clay`,
      companiesFound: searchResults.organizations.length,
      clayResponse: clayResponse,
      iterations: iterationCount + 1
    });

  } catch (error) {
    console.error('Error in build-company-list:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

async function searchApolloAPI(searchParams: any): Promise<ApolloSearchResponse> {
  const apolloApiKey = process.env.APOLLO_API_KEY;
  
  if (!apolloApiKey) {
    throw new Error('Apollo API key not configured');
  }

  // Limit keywords to avoid Apollo's "Value too long" error
  const keywords = searchParams.keywords || ['technology', 'software'];
  const limitedKeywords = keywords.slice(0, 5); // Limit to 5 keywords max
  const keywordString = limitedKeywords.join(' ');
  
  // Ensure keyword string doesn't exceed ~100 characters
  const truncatedKeywords = keywordString.length > 100 
    ? keywordString.substring(0, 100).trim()
    : keywordString;

  const searchPayload = {
    q_keywords: truncatedKeywords,
    page: 1,
    per_page: 25,
    // Employee count filtering using correct Apollo API parameter names
    num_employees_ranges: [`${searchParams.employee_count_min || 50},${searchParams.employee_count_max || 1000}`],
    // Additional filters to avoid large corporations
    public_companies: false, // Exclude publicly traded companies
    organization_revenue_ranges: ['0,100000000'], // Max $100M revenue to avoid Fortune 500
  };

  console.log('Apollo API search payload:', JSON.stringify(searchPayload, null, 2));
  console.log('Apollo API key (first 10 chars):', apolloApiKey.substring(0, 10) + '...');

  const response = await fetch('https://api.apollo.io/api/v1/mixed_companies/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': apolloApiKey
    },
    body: JSON.stringify(searchPayload)
  });

  // console.log('Apollo API response status:', response.status);
  // console.log('Apollo API response headers:', Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    const errorText = await response.text();
    console.log('Apollo API error response:', errorText);
    throw new Error(`Apollo API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`Apollo API returned ${data.organizations?.length || 0} companies`);
  console.log('Apollo API full response structure:', {
    organizations_count: data.organizations?.length,
    total_entries: data.total_entries,
    page: data.page,
    per_page: data.per_page,
    pagination: data.pagination,
    errors: data.errors,
    warnings: data.warnings
  });
  
  // Log sample companies with their employee counts
  if (data.organizations?.length > 0) {
    console.log('Sample companies returned:');
    data.organizations.slice(0, 5).forEach((org: any, index: number) => {
      console.log(`${index + 1}. ${org.name} - Employees: ${org.estimated_num_employees || 'unknown'} - Revenue: ${org.organization_revenue_printed || 'unknown'}`);
    });
  }

  return {
    organizations: data.organizations || [],
    total_entries: data.total_entries || 0,
    page: data.page || 1,
    per_page: data.per_page || 50
  };
}

async function sendToClayWebhook(companies: CompanySearchResult[], ideaId: string) {
  const clayWebhookUrl = 'https://api.clay.com/v3/sources/webhook/pull-in-data-from-a-webhook-86e4785a-e8bd-49cd-99da-6a5bf64dd6a2';
  
  // Send companies in batches to Clay
  const batchSize = 10;
  const results = [];
  
  for (let i = 0; i < companies.length; i += batchSize) {
    const batch = companies.slice(i, i + batchSize);
    
    for (const company of batch) {
      try {
        const clayPayload = {
          idea_id: ideaId,
          company_id: company.id,
          company_name: company.name,
          website: company.website_url,
          linkedin: company.linkedin_url,
          industry: company.industry,
          employee_count: company.employee_count,
          phone: company.phone,
          founded_year: company.founded_year,
          description: company.description,
          location_city: company.location?.city,
          location_state: company.location?.state,
          location_country: company.location?.country,
          created_at: new Date().toISOString()
        };
        
        const response = await fetch(clayWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(clayPayload)
        });
        
        if (response.ok) {
          results.push({ company: company.name, status: 'success' });
        } else {
          results.push({ company: company.name, status: 'failed', error: response.statusText });
        }
      } catch (error) {
        results.push({ 
          company: company.name, 
          status: 'failed', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
} 