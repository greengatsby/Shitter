import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/utils/supabase';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface RubricLevel {
  level: number;
  title: string;
  description: string;
}

interface RubricField {
  id: string;
  name: string;
  description: string;
  levels: RubricLevel[];
}

interface RubricCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  column_mapping?: string;
  fields: RubricField[];
}

function generateRubricPrompt(categories: RubricCategory[]): string {
  let prompt = "SCORING RUBRICS:\n\n";
  prompt += "For each category below, score EVERY field on a scale of 1-5 based on the detailed criteria provided.\n\n";

  categories.forEach(category => {
    prompt += `**${category.icon} ${category.name.toUpperCase()} SCORING:**\n`;
    prompt += `${category.description}\n\n`;

    category.fields.forEach(field => {
      prompt += `${field.name}:\n`;
      prompt += `${field.description}\n`;
      
      field.levels.forEach(level => {
        prompt += `  ${level.level}: ${level.title} - ${level.description}\n`;
      });
      prompt += "\n";
    });
    prompt += "\n";
  });

  prompt += "INSTRUCTIONS:\n";
  prompt += "- Score each field individually on a 1-5 scale\n";
  prompt += "- Provide a brief justification for each score\n";
  prompt += "- Be precise and specific in your reasoning\n";
  prompt += "- Consider the exact criteria for each level\n\n";

  return prompt;
}

function generateDynamicJSONStructure(categories: RubricCategory[]): string {
  let jsonStructure = "{\n";
  
  // Fixed business fields
  jsonStructure += '  "businessIdea": "Brief one-sentence description of the business idea",\n';
  jsonStructure += '  "problemDescription": "What specific problem this solves",\n';
  jsonStructure += '  "valueProposition": "What value we provide to customers",\n';
  jsonStructure += '  "targetMarket": "Who are the ideal customers",\n';
  jsonStructure += '  "solutionOverview": "How the AI solves this problem",\n';
  jsonStructure += '  "revenueModel": "How this will make money",\n';
  jsonStructure += '  "implementationPlan": "High-level technical approach",\n';
  jsonStructure += '  "digitalDetectionMethod": "How we can identify customers with this problem digitally",\n';
  jsonStructure += '  "leadMagnetStrategy": "How we can offer initial value for free",\n';
  jsonStructure += '  "automationApproach": "How we will automate customer detection",\n';
  
  // Dynamic detailed scores from database
  jsonStructure += '  "detailedScores": {\n';
  
  categories.forEach((category, categoryIndex) => {
    jsonStructure += `    "${category.name}": {\n`;
    
    category.fields.forEach((field, fieldIndex) => {
      jsonStructure += `      "${field.name}": {\n`;
      jsonStructure += '        "score": 1-5,\n';
      jsonStructure += '        "justification": "Brief explanation of score"\n';
      jsonStructure += `      }${fieldIndex < category.fields.length - 1 ? ',' : ''}\n`;
    });
    
    jsonStructure += `    }${categoryIndex < categories.length - 1 ? ',' : ''}\n`;
  });
  
  jsonStructure += "  }\n";
  jsonStructure += "}";
  
  return jsonStructure;
}

interface CategoryScore {
  averageScore: number;
  totalScore: number;
  fieldCount: number;
  letterGrade: string;
}

function calculateCategoryScores(detailedScores: any): Record<string, CategoryScore> {
  const categoryScores: Record<string, CategoryScore> = {};

  Object.keys(detailedScores).forEach(categoryName => {
    const fields = detailedScores[categoryName];
    let totalScore = 0;
    let fieldCount = 0;

    Object.keys(fields).forEach(fieldName => {
      const field = fields[fieldName];
      if (field && typeof field.score === 'number') {
        totalScore += field.score;
        fieldCount++;
      }
    });

    if (fieldCount > 0) {
      const averageScore = totalScore / fieldCount;
      let letterGrade: string;

      // Convert 1-5 scale to letter grades
      if (averageScore >= 4.5) {
        letterGrade = 'A';
      } else if (averageScore >= 3.5) {
        letterGrade = 'B';
      } else if (averageScore >= 2.5) {
        letterGrade = 'C';
      } else if (averageScore >= 1.5) {
        letterGrade = 'D';
      } else {
        letterGrade = 'F';
      }

      categoryScores[categoryName] = {
        averageScore,
        totalScore,
        fieldCount,
        letterGrade
      };
    }
  });

  return categoryScores;
}

export async function POST(request: NextRequest) {
  try {
    // Fetch existing ideas from database
    const { data: existingIdeas, error: ideasError } = await supabase
      .from('ideas')
      .select('title')
      .order('created_at', { ascending: false });

    if (ideasError) {
      console.error('Error fetching existing ideas:', ideasError);
    }

    // Fetch rubrics from database
    const rubricsResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/rubrics?include_fields=true&include_levels=true`);
    const rubricsData = await rubricsResponse.json();
    
    if (!rubricsData.success) {
      throw new Error('Failed to fetch rubrics from database');
    }

    // Generate rubric prompt from database
    const rubricPrompt = generateRubricPrompt(rubricsData.categories);
    
    // Generate dynamic JSON structure from database
    const dynamicJSONStructure = generateDynamicJSONStructure(rubricsData.categories);

    // Build existing ideas context
    let existingIdeasContext = '';
    if (existingIdeas && existingIdeas.length > 0) {
      existingIdeasContext = `\n\nEXISTING IDEAS TO AVOID DUPLICATING:\n${existingIdeas.map(idea => `- ${idea.title}`).join('\n')}\n\nIMPORTANT: Do NOT generate ideas that are similar to or duplicate any of the existing ideas listed above. Create something genuinely different and novel.\n`;
    }

    // Build the prompt
    const prompt = `Your job is to generate an AI software business idea and score it using detailed rubrics.

${rubricPrompt}${existingIdeasContext}

Generate a business idea and respond with ONLY a JSON object that has these exact fields:

${dynamicJSONStructure}

Respond with ONLY the JSON object, no additional text.`;

    // Call OpenAI with o3 model
    const completion = await openai.chat.completions.create({
      model: "o3-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const rawResponse = completion.choices[0]?.message?.content;
    
    if (!rawResponse) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    let parsedIdea;
    try {
      parsedIdea = JSON.parse(rawResponse);
    } catch (parseError) {
      throw new Error(`Failed to parse AI response as JSON: ${parseError}`);
    }

    // Calculate category scores from detailed scores
    const categoryScores = calculateCategoryScores(parsedIdea.detailedScores);

    // Enrich detailed scores with rubric metadata for future-proofing
    const enrichedDetailedScores: any = {};
    
    Object.keys(parsedIdea.detailedScores).forEach(categoryName => {
      const category = rubricsData.categories.find((cat: RubricCategory) => cat.name === categoryName);
      if (!category) return;
      
      enrichedDetailedScores[categoryName] = {};
      
      Object.keys(parsedIdea.detailedScores[categoryName]).forEach(fieldName => {
        const field = category.fields.find((f: RubricField) => f.name === fieldName);
        if (!field) return;
        
        const fieldScore = parsedIdea.detailedScores[categoryName][fieldName];
        const level = field.levels.find((l: RubricLevel) => l.level === fieldScore.score);
        
        enrichedDetailedScores[categoryName][fieldName] = {
          score: fieldScore.score,
          justification: fieldScore.justification,
          // Baked-in rubric metadata
          fieldName: field.name,
          fieldDescription: field.description,
          levelTitle: level?.title || `Level ${fieldScore.score}`,
          levelDefinition: level?.description || 'No definition available'
        };
      });
    });

    // Dynamically build database insert based on categories
    const dynamicInsertData: any = {
      title: parsedIdea.businessIdea,
      idea: {
        businessIdea: parsedIdea.businessIdea,
        valueProposition: parsedIdea.valueProposition,
        revenueModel: parsedIdea.revenueModel,
        problemDescription: parsedIdea.problemDescription,
        solutionOverview: parsedIdea.solutionOverview,
        implementationPlan: parsedIdea.implementationPlan,
        digitalDetectionMethod: parsedIdea.digitalDetectionMethod,
        leadMagnetStrategy: parsedIdea.leadMagnetStrategy,
        automationApproach: parsedIdea.automationApproach,
        targetMarket: parsedIdea.targetMarket
      },
      detailed_scores: enrichedDetailedScores,
      raw_data: {
        originalResponse: rawResponse,
        parsedIdea: parsedIdea
      }
    };

    // Build category-specific data dynamically using database column mappings
    rubricsData.categories.forEach((category: RubricCategory) => {
      const columnName = category.column_mapping;
      if (!columnName) return;

      const categoryData: any = {
        [`${columnName.toLowerCase()}Grade`]: categoryScores[category.name]?.letterGrade,
        gradeJustification: `Avg: ${categoryScores[category.name]?.averageScore?.toFixed(1)} (${categoryScores[category.name]?.totalScore}/${categoryScores[category.name]?.fieldCount * 5})`,
        ...enrichedDetailedScores?.[category.name] || {}
      };

      // Handle special grade field naming for legacy compatibility
      if (category.name === 'Email Strategy') {
        categoryData.emailGrade = categoryScores[category.name]?.letterGrade;
        categoryData.emailGradeJustification = categoryData.gradeJustification;
        delete categoryData.gradeJustification;
      } else if (category.name === 'Business Viability') {
        categoryData.viabilityGrade = categoryScores[category.name]?.letterGrade;
        categoryData.viabilityGradeJustification = categoryData.gradeJustification;
        delete categoryData.gradeJustification;
      }

      dynamicInsertData[columnName] = categoryData;
    });

    // Save to Supabase using dynamic schema
    let savedId = null;
    let saveError = null;
    
    try {
      const { data, error } = await supabase
        .from('ideas')
        .insert(dynamicInsertData)
        .select('id')
        .single();
      
      if (error) {
        console.error('Supabase save error:', error);
        saveError = error.message;
      } else {
        savedId = data?.id;
        console.log('Saved idea to Supabase with ID:', savedId);
      }
    } catch (dbError: any) {
      console.error('Database error:', dbError);
      saveError = dbError.message;
    }

    return NextResponse.json({ 
      success: true, 
      idea: parsedIdea,
      rawResponse: rawResponse,
      timestamp: new Date().toISOString(),
      savedId: savedId,
      saveError: saveError
    });

  } catch (error: any) {
    console.error('Error generating idea:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to generate idea',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Use POST method to generate ideas',
    endpoint: '/api/ideate',
    method: 'POST'
  });
}