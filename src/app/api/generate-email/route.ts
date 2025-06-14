import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Idea {
  id: string;
  title?: string;
  idea: Record<string, any>;
  problem: Record<string, any>;
  solution: Record<string, any>;
  outreach: Record<string, any>;
  market: Record<string, any>;
  raw_data?: Record<string, any>;
}

export async function POST(request: NextRequest) {
  try {
    const { idea, customInstructions }: { idea: Idea, customInstructions?: string } = await request.json();

    if (!idea) {
      return NextResponse.json(
        { success: false, error: 'Idea is required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Fetch best practices from database (prioritize high priority ones)
    const { data: bestPractices, error: dbError } = await supabase
      .from('email_best_practices')
      .select('*')
      .order('priority', { ascending: true })
      .limit(15); // Get top 15 practices

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch best practices' },
        { status: 500 }
      );
    }

    // Format best practices for the prompt, grouping by type
    const rulesPractices = bestPractices?.filter(p => p.practice_type === 'rule') || [];
    const detailedPractices = bestPractices?.filter(p => p.practice_type === 'detailed') || [];
    const guidelinePractices = bestPractices?.filter(p => p.practice_type === 'guideline') || [];
    
    const formatPractices = (practices: any[], title: string) => {
      if (practices.length === 0) return '';
      return `\n${title}:\n${practices.map(practice => 
        `• ${practice.title}: ${practice.description}${practice.example ? ` (Example: ${practice.example})` : ''}`
      ).join('\n')}\n`;
    };

    const practicesText = bestPractices?.length > 0 ? 
      `${formatPractices(rulesPractices, 'SIMPLE RULES - Must Follow')}${formatPractices(detailedPractices, 'STRATEGIC PRACTICES - Apply When Relevant')}${formatPractices(guidelinePractices, 'GUIDELINES - Consider')}` 
      : 'No best practices available.';

    // Create the email generation prompt
    const prompt = `You are an expert cold email copywriter. Generate a compelling cold email campaign for the following business idea using the provided email marketing best practices.

BUSINESS IDEA:
Problem: ${idea.problem?.description || 'Not specified'}
Solution: ${idea.solution?.description || 'Not specified'}
Target Market: ${idea.market?.target_market || 'Not specified'}
Value Proposition: ${idea.solution?.value_proposition || 'Not specified'}
${idea.market?.pain_points ? `Pain Points: ${idea.market.pain_points}` : ''}

EMAIL MARKETING BEST PRACTICES TO APPLY:
${practicesText}

${customInstructions ? `CUSTOM INSTRUCTIONS: ${customInstructions}` : ''}

REQUIREMENTS:
1. MUST FOLLOW all "Simple Rules" listed above (these are non-negotiable constraints)
2. APPLY relevant "Strategic Practices" that fit the business idea and target market
3. CONSIDER "Guidelines" where appropriate
4. Create a compelling subject line that gets opened
5. Include a clear call-to-action
6. Make it personalized and relevant to the target market
7. Focus on the prospect's pain points and how the solution helps

OUTPUT FORMAT - Return ONLY a JSON object with this exact structure:
{
  "subject": "Compelling subject line here",
  "body": "Complete email body with proper line breaks and formatting",
  "target_audience": "Brief description of who this email targets",
  "key_points": ["List of", "key persuasion", "points used"]
}

Generate the email now:`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert cold email copywriter. Always respond with valid JSON only, following the exact format requested."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const response = completion.choices[0]?.message?.content?.trim();
    
    if (!response) {
      return NextResponse.json(
        { success: false, error: 'No response from OpenAI' },
        { status: 500 }
      );
    }

    try {
      // Clean the response by removing markdown code blocks if present
      let cleanedResponse = response;
      if (response.startsWith('```json')) {
        cleanedResponse = response.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (response.startsWith('```')) {
        cleanedResponse = response.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const emailData = JSON.parse(cleanedResponse);
      
      // Validate the response structure
      if (!emailData.subject || !emailData.body || !emailData.target_audience || !emailData.key_points) {
        throw new Error('Invalid email structure');
      }

      return NextResponse.json({
        success: true,
        email: emailData,
        practices_used: bestPractices?.length || 0,
        timestamp: new Date().toISOString()
      });

    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      console.error('Raw response:', response);
      
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response. Please try again.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error generating email:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 