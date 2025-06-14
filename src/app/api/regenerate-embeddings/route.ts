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

async function generateEmbedding(content: string): Promise<number[]> {
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: content,
  });
  return embeddingResponse.data[0].embedding;
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Get all practices without embeddings
    const { data: practices, error: fetchError } = await supabase
      .from('email_best_practices')
      .select('id, title, description, example')
      .is('content_embedding', null);

    if (fetchError) {
      console.error('Error fetching practices:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch practices' },
        { status: 500 }
      );
    }

    if (!practices || practices.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No practices need embedding regeneration',
        updated_count: 0
      });
    }

    let successCount = 0;
    const errors = [];

    // Process each practice
    for (const practice of practices) {
      try {
        // Combine content for embedding
        const contentForEmbedding = [
          practice.title,
          practice.description,
          practice.example || ''
        ].filter(Boolean).join('. ');

        // Generate embedding
        const embedding = await generateEmbedding(contentForEmbedding);

        // Update the practice with the new embedding
        const { error: updateError } = await supabase
          .from('email_best_practices')
          .update({ 
            content_embedding: JSON.stringify(embedding),
            updated_at: new Date().toISOString()
          })
          .eq('id', practice.id);

        if (updateError) {
          console.error(`Failed to update practice ${practice.id}:`, updateError);
          errors.push(`Failed to update practice: ${practice.title}`);
        } else {
          successCount++;
        }

      } catch (error) {
        console.error(`Error processing practice ${practice.id}:`, error);
        errors.push(`Error processing practice: ${practice.title}`);
      }
    }

    return NextResponse.json({
      success: true,
      total_practices: practices.length,
      updated_count: successCount,
      errors: errors,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error regenerating embeddings:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get count of practices without embeddings
    const { count, error } = await supabase
      .from('email_best_practices')
      .select('id', { count: 'exact', head: true })
      .is('content_embedding', null);

    if (error) {
      console.error('Error counting practices:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to count practices' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      practices_without_embeddings: count || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error checking embeddings:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 