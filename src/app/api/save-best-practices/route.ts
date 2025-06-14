import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface BestPractice {
  title: string;
  description: string;
  example?: string;
  priority: number;
  practice_type?: 'rule' | 'detailed' | 'guideline';
}

async function generateEmbedding(content: string): Promise<number[]> {
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: content,
  });
  return embeddingResponse.data[0].embedding;
}

export async function POST(request: NextRequest) {
  try {
    const { practices, source, skipDuplicateCheck }: { 
      practices: BestPractice[], 
      source: string,
      skipDuplicateCheck?: boolean 
    } = await request.json();

    if (!practices || !Array.isArray(practices) || practices.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Practices array is required' },
        { status: 400 }
      );
    }

    // Validate each practice
    for (const practice of practices) {
      if (!practice.title || !practice.description || !practice.priority) {
        return NextResponse.json(
          { success: false, error: 'Each practice must have title, description, and priority' },
          { status: 400 }
        );
      }
      
      // Validate practice_type if provided
      if (practice.practice_type && !['rule', 'detailed', 'guideline'].includes(practice.practice_type)) {
        return NextResponse.json(
          { success: false, error: `Invalid practice_type: ${practice.practice_type}` },
          { status: 400 }
        );
      }
    }

    // Prepare data for insertion with embeddings
    const practiceData = [];
    
    for (const practice of practices) {
      // Combine content for embedding
      const contentForEmbedding = [
        practice.title,
        practice.description,
        practice.example || ''
      ].filter(Boolean).join('. ');

      // Generate embedding
      let embedding = null;
      try {
        if (process.env.OPENAI_API_KEY) {
          embedding = await generateEmbedding(contentForEmbedding);
        }
      } catch (embeddingError) {
        console.error('Failed to generate embedding:', embeddingError);
        // Continue without embedding - we can generate it later
      }

      practiceData.push({
        title: practice.title.trim(),
        description: practice.description.trim(),
        example: practice.example?.trim() || null,
        priority: practice.priority,
        practice_type: practice.practice_type || (practice.example ? 'detailed' : 'rule'),
        source: source || 'Unknown Source',
        content_embedding: embedding ? JSON.stringify(embedding) : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // Insert into database
    const { data, error } = await supabase
      .from('email_best_practices')
      .insert(practiceData)
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save practices to database' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      saved_count: data?.length || 0,
      practices: data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error saving best practices:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 