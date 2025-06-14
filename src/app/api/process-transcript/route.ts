import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function cleanTranscript(inputText: string): string {
  // Remove timecodes (HH:MM:SS.mmm or HH:MM:SS.mm format)
  const timecodePattern = /\d{2}:\d{2}:\d{2}\.\d{2,3}/g;
  let cleanedText = inputText.replace(timecodePattern, '');
  
  // Replace multiple whitespace characters with single spaces
  cleanedText = cleanedText.replace(/\s+/g, ' ');
  
  // Trim leading and trailing whitespace
  return cleanedText.trim();
}

export async function POST(request: NextRequest) {
  try {
    const { transcript, source } = await request.json();

    if (!transcript || !transcript.trim()) {
      return NextResponse.json(
        { success: false, error: 'Transcript is required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Clean the transcript first
    const cleanedTranscript = cleanTranscript(transcript);

    // Create a prompt for extracting best practices
    const prompt = `You are an expert email marketing consultant. Analyze the following transcript from an email marketing video and extract actionable best practices.

Extract TWO TYPES of practices:

**SIMPLE RULES** - Quick, actionable guidelines (use practice_type: "rule"):
- Word count limits (e.g., "Keep emails under 150 words")
- Formatting rules (e.g., "Use single line breaks between paragraphs") 
- Timing constraints (e.g., "Send follow-ups 3 days apart")
- Simple do/don't guidelines

**DETAILED PRACTICES** - Strategic approaches that need explanation (use practice_type: "detailed"):
- Complex strategies that require context
- Techniques that need examples to understand
- Multi-step processes

For SIMPLE RULES:
{
  "title": "Clear, specific rule",
  "description": "Brief explanation of the rule and why it matters",
  "practice_type": "rule",
  "priority": 1-3
}

For DETAILED PRACTICES:
{
  "title": "Clear practice title", 
  "description": "Detailed explanation of the practice and why it works",
  "example": "Concrete example of implementation",
  "practice_type": "detailed",
  "priority": 1-3
}

Focus on practices that are:
- Specific and actionable
- Backed by evidence or reasoning in the transcript
- Applicable to cold email campaigns
- Mix of simple rules and detailed strategies

Transcript to analyze:
${cleanedTranscript}

Extract 5-12 best practices (mix of rules and detailed practices). Return only the JSON array, no additional text.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert email marketing consultant who extracts actionable best practices from video transcripts. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
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
      
      const practices = JSON.parse(cleanedResponse);
      
      // Validate the response structure
      if (!Array.isArray(practices)) {
        throw new Error('Response is not an array');
      }

      // Validate each practice has required fields
      for (const practice of practices) {
        if (!practice.title || !practice.description || !practice.priority) {
          throw new Error('Invalid practice structure - missing required fields');
        }
        
        // Validate practice_type
        if (practice.practice_type && !['rule', 'detailed', 'guideline'].includes(practice.practice_type)) {
          throw new Error(`Invalid practice_type: ${practice.practice_type}`);
        }
        
        // Set default practice_type if not provided
        if (!practice.practice_type) {
          practice.practice_type = practice.example ? 'detailed' : 'rule';
        }
      }

      return NextResponse.json({
        success: true,
        practices: practices,
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
    console.error('Error processing transcript:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 