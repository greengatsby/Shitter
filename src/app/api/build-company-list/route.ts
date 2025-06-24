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
          content: `You are an expert at identifying target companies using Apollo.io's search system. Apollo will automatically filter for:
- Private companies only
- 50-1000 employees  
- <$500M revenue
- Major markets (US, UK, Canada, etc.)

So focus ONLY on simple keywords that identify the RIGHT TYPE of business that needs this service.

Use BASIC TERMS that Apollo recognizes:
✅ "logistics", "supply chain", "manufacturing", "retail", "e-commerce", "SaaS", "healthcare"
❌ Complex phrases like "supply chain risk management startups"

Your job: Pick 2 simple industry terms that match companies who would buy this service.

Examples from working searches:
- "logistics; supply chain" → Found 75+ companies
- "e-commerce; retail" → For retail-focused services  
- "SaaS; technology" → For tech services
- "manufacturing; industrial" → For industrial services

Return as JSON:
{
  "keywords": ["simple_term1", "simple_term2"], // 2 basic industry terms
  "reasoning": "Why companies in these industries need this service",
  "employee_count_min": 50,
  "employee_count_max": 1000
}

Remember: Apollo handles all size/revenue filtering - just focus on INDUSTRY MATCH.`
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
    
    // If we get 0 results, try a fallback search with simpler keywords
    if (searchResults.organizations.length === 0) {
      console.log('Trying fallback search with simpler keywords...');
      const fallbackKeywords = {
        keywords: ['logistics', 'supply chain'], // Simple, individual terms
        employee_count_min: initialKeywords.employee_count_min,
        employee_count_max: initialKeywords.employee_count_max
      };
      searchResults = await searchApolloAPI(fallbackKeywords);
    }
    
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
            content: `You are reviewing search results from Apollo API for potential B2B customers using Apollo's keyword tag system.

You can see the FULL CONVERSATION HISTORY of previous search attempts. Use this to:
- Learn from previous attempts that didn't work well
- RECOGNIZE when results are getting worse (decreasing numbers = keywords too specific)
- If you see pattern like 75→2→5→0, STOP and finalize the best results you had
- Understand what types of companies were found before
- Make smarter refinements (broader when results drop, specific when results are too broad)

Available actions:
- search_refinement: Try different keywords/filters (only if current results are poor quality or <20 companies)
- finalize_results: Accept current results as final (RECOMMENDED if you have 30+ good quality companies)

Return your response as JSON:
{
  "action": "search_refinement" | "finalize_results",
  "reasoning": "Explain your strategy - if results are decreasing, consider BROADENING keywords instead of narrowing",
  "refinements": {
    "keywords": ["broad_industry_term"], // Use BROAD terms that Apollo recognizes. If previous search had <10 results, try BROADER terms
    "employee_count_min": 50,
    "employee_count_max": 1000
  } // only if action is "search_refinement"
}

Evaluation criteria:
- REJECT if you see: LinkedIn, Netflix, Deloitte, Oracle, Microsoft, Amazon, Google, Meta, IBM, Wipro, PwC, Cognizant, EY, J&J, Accenture, TCS, Infosys
- REJECT if companies have >$1B revenue or >1000 employees  
- REJECT if companies are Fortune 500 or well-known brands
- ACCEPT smaller, niche companies that actually need this service
- Look for mid-market companies, agencies, e-commerce brands, SaaS startups, boutique firms, regional companies
- Prioritize finding companies you've never heard of (good sign!)

KEYWORD STRATEGY: 
- If previous search found >50 companies: Try slightly more specific terms
- If previous search found 10-50 companies: Keep similar specificity level  
- If previous search found <10 companies: GO BROADER, use more general industry terms

✅ BROAD TERMS (use when results are low): "logistics", "supply chain", "manufacturing", "retail", "e-commerce", "SaaS", "healthcare", "software", "technology"
✅ MEDIUM TERMS (use when results are good): "warehouse", "shipping", "inventory", "fulfillment", "distribution"
❌ TOO SPECIFIC (avoid unless you have 100+ results): "supply chain analytics startups", "DTC supply chain solutions", "predictive logistics"

IMPORTANT: If you see results dropping (75→2→5), that means keywords are getting TOO SPECIFIC. Go back to broader terms!`
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

      // Log what the AI is evaluating
      console.log(`\n=== AI DECISION POINT (Iteration ${iterationCount + 1}) ===`);
      console.log(`Current results: ${searchResults.organizations.length} companies found`);
      console.log(`Sample company names: ${searchResults.organizations.slice(0, 5).map(c => c.name).join(', ')}`);
      console.log(`AI Decision: ${reviewDecision.action}`);

      // Add decision to the most recent conversation history entry
      conversationHistory[conversationHistory.length - 1].decision = reviewDecision;

      if (reviewDecision.action === 'finalize_results') {
        console.log(`Iteration ${iterationCount + 1}: Finalizing results`);
        console.log(`AI reasoning: ${reviewDecision.reasoning || 'No reasoning provided'}`);
        break;
      } else if (reviewDecision.action === 'search_refinement' && reviewDecision.refinements) {
        console.log(`Iteration ${iterationCount + 1}: Refining search with new keywords`);
        console.log(`AI reasoning: ${reviewDecision.reasoning || 'No reasoning provided'}`);
        console.log(`New keywords: ${JSON.stringify(reviewDecision.refinements.keywords || reviewDecision.refinements)}`);
        searchResults = await searchApolloAPI(reviewDecision.refinements);
        iterationCount++;
        // Add new iteration to conversation history
        conversationHistory.push({
          iteration: iterationCount,
          keywords: reviewDecision.refinements,
          results: searchResults.organizations.slice(0, 10),
          companiesFound: searchResults.organizations.length
        });
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

  // Format keywords for Apollo's keyword tags parameter (based on working Postman example)
  const keywords = searchParams.keywords || ['logistics', 'supply chain'];
  const limitedKeywords = keywords.slice(0, 2); // Limit to 2 keywords max for better results
  const keywordString = limitedKeywords.join('; '); // Use semicolon separator as in working example
  
  // Ensure keyword string doesn't exceed ~100 characters
  const truncatedKeywords = keywordString.length > 100 
    ? keywordString.substring(0, 100).trim()
    : keywordString;
    
  console.log(`Using keywords: "${truncatedKeywords}"`);  

  // Try to get more results by searching multiple pages if needed
  let allOrganizations: CompanySearchResult[] = [];
  let currentPage = 1;
  const maxPages = 10; // Limit to first 3 pages to avoid long search times
  
  while (currentPage <= maxPages) {
    const searchPayload: any = {
      // Use organization keyword tags parameter (from working Postman example)
      'q_organization_keyword_tags[]': truncatedKeywords,
      page: currentPage,
      per_page: 25,
      
      // Use Apollo's native filtering instead of post-filtering - smaller companies
      'organization_num_employees_ranges[]': [`${searchParams.employee_count_min || 50},${searchParams.employee_count_max || 500}`], // Reduced from 1000 to 500
      'publicly_traded_status[]': ['private'], // Focus on private companies to avoid Fortune 500
      
      // Filter by revenue using correct Apollo API parameters (max $100M to avoid large corporations)
      'revenue_range[max]': '50000000', // $100M max revenue
      
      // Focus on specific countries to avoid global consulting giants
      'organization_locations[]': [
        'United States',
        'Canada', 
        'United Kingdom',
        'Australia',
        'Germany',
        'Netherlands'
      ]
    };

    // Build URL with query parameters (following working Postman example)
    const queryParams = new URLSearchParams();
    Object.entries(searchPayload).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => queryParams.append(key, String(v)));
      } else if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    const fullUrl = `https://api.apollo.io/api/v1/mixed_companies/search?${queryParams.toString()}`;
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        'X-Api-Key': apolloApiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apollo API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    // Add organizations from this page to our collection
    if (data.organizations && data.organizations.length > 0) {
      allOrganizations.push(...data.organizations);
      console.log(`Page ${currentPage}: Found ${data.organizations.length} companies`);
      
      // Log a few sample companies from the first page of each search
      if (currentPage === 1) {
        console.log('Sample companies:');
        data.organizations.slice(0, 3).forEach((org: any, index: number) => {
          console.log(`  ${index + 1}. ${org.name} - Revenue: ${org.organization_revenue_printed || 'unknown'}`);
        });
      }
    }

    // Check if there are more pages and if we should continue
    const pagination = data.pagination || data;
    const totalPages = pagination.total_pages || Math.ceil((pagination.total_entries || 0) / (pagination.per_page || 25));
    
    if (currentPage >= totalPages || data.organizations?.length === 0) {
      break;
    }
    
    currentPage++;
    
    // Add a small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`Apollo search completed: ${allOrganizations.length} companies found`);
  
  return {
    organizations: allOrganizations,
    total_entries: allOrganizations.length,
    page: 1,
    per_page: allOrganizations.length
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