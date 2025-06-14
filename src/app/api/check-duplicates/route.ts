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

interface BestPractice {
  title: string;
  description: string;
  example?: string;
  practice_type?: string;
}

interface SimilarPractice {
  id: string;
  title: string;
  description: string;
  similarity_score: number;
}

export async function POST(request: NextRequest) {
  try {
    const { practices }: { practices: BestPractice[] } = await request.json();

    if (!practices || !Array.isArray(practices) || practices.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Practices array is required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const results = [];

    for (const practice of practices) {
      try {
        // Combine title, description, and example for embedding
        const contentForEmbedding = [
          practice.title,
          practice.description,
          practice.example || ''
        ].filter(Boolean).join('. ');

        // Generate embedding using OpenAI
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: contentForEmbedding,
        });

        const embedding = embeddingResponse.data[0].embedding;

        // Check for similar practices in the database
        const { data: similarPractices, error: searchError } = await supabase
          .rpc('find_similar_practices', {
            input_embedding: JSON.stringify(embedding),
            similarity_threshold: 0.75, // 75% similarity threshold
            max_results: 5
          });

        if (searchError) {
          console.error('Error searching for similar practices:', searchError);
          results.push({
            practice,
            duplicates: [],
            embedding: embedding,
            error: 'Failed to search for duplicates'
          });
          continue;
        }

        results.push({
          practice,
          duplicates: similarPractices || [],
          embedding: embedding,
          hasDuplicates: (similarPractices?.length || 0) > 0
        });

      } catch (error) {
        console.error('Error processing practice:', practice.title, error);
        results.push({
          practice,
          duplicates: [],
          embedding: null,
          error: 'Failed to process practice'
        });
      }
    }

    return NextResponse.json({
      success: true,
      results: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error checking duplicates:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 