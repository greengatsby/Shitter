-- Create enum types for business idea categorization
CREATE TYPE idea_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high');

-- Create the main table for storing business ideas
CREATE TABLE business_ideas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Core business idea
    business_idea TEXT NOT NULL,
    status idea_status DEFAULT 'draft',
    priority priority_level DEFAULT 'medium',
    
    -- Problem identification
    problem_description TEXT,
    is_observable_publicly BOOLEAN,
    digital_detection_method TEXT,
    
    -- Value proposition
    value_description TEXT,
    what_they_currently_pay TEXT,
    our_cost_to_provide TEXT,
    lead_magnet_strategy TEXT,
    
    -- Dream outcome
    dream_outcome TEXT,
    
    -- Customer detection strategy
    digital_signals JSONB DEFAULT '[]'::jsonb,
    scraping_targets JSONB DEFAULT '[]'::jsonb,
    automation_approach TEXT,
    identification_criteria JSONB DEFAULT '[]'::jsonb,
    
    -- Business details
    target_market TEXT,
    solution_overview TEXT,
    revenue_model TEXT,
    implementation_plan TEXT,
    success_metrics JSONB DEFAULT '[]'::jsonb,
    
    -- Raw response for debugging
    raw_response TEXT,
    
    -- User tracking (optional for future multi-user support)
    user_id UUID,
    
    -- Timestamps
    CONSTRAINT business_ideas_updated_at_check CHECK (updated_at >= created_at)
);

-- Create indexes for better query performance
CREATE INDEX idx_business_ideas_created_at ON business_ideas(created_at DESC);
CREATE INDEX idx_business_ideas_status ON business_ideas(status);
CREATE INDEX idx_business_ideas_priority ON business_ideas(priority);
CREATE INDEX idx_business_ideas_user_id ON business_ideas(user_id);

-- Create a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_business_ideas_updated_at 
    BEFORE UPDATE ON business_ideas 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create a view for easier querying with formatted data
CREATE VIEW business_ideas_formatted AS
SELECT 
    id,
    created_at,
    updated_at,
    business_idea,
    status,
    priority,
    
    -- Problem identification object
    jsonb_build_object(
        'description', problem_description,
        'isObservablePublicly', is_observable_publicly,
        'digitalDetectionMethod', digital_detection_method
    ) as problem_identification,
    
    -- Value proposition object
    jsonb_build_object(
        'description', value_description,
        'whatTheyCurrentlyPay', what_they_currently_pay,
        'ourCostToProvide', our_cost_to_provide,
        'leadMagnetStrategy', lead_magnet_strategy
    ) as value_proposition,
    
    -- Dream outcome object
    jsonb_build_object(
        'conciseStatement', dream_outcome
    ) as dream_outcome,
    
    -- Customer detection strategy object
    jsonb_build_object(
        'digitalSignals', digital_signals,
        'scrapingTargets', scraping_targets,
        'automationApproach', automation_approach,
        'identificationCriteria', identification_criteria
    ) as customer_detection_strategy,
    
    target_market,
    solution_overview,
    revenue_model,
    implementation_plan,
    success_metrics,
    raw_response,
    user_id
FROM business_ideas;

-- Add Row Level Security (RLS) policies for future multi-user support
ALTER TABLE business_ideas ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to see their own ideas (for future use)
CREATE POLICY "Users can view their own ideas" ON business_ideas
    FOR SELECT USING (user_id = auth.uid());

-- Policy to allow users to insert their own ideas (for future use)
CREATE POLICY "Users can insert their own ideas" ON business_ideas
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy to allow users to update their own ideas (for future use)
CREATE POLICY "Users can update their own ideas" ON business_ideas
    FOR UPDATE USING (user_id = auth.uid());

-- For now, allow anonymous access (remove these when you add authentication)
CREATE POLICY "Allow anonymous select" ON business_ideas
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert" ON business_ideas
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous update" ON business_ideas
    FOR UPDATE USING (true);

-- Create a function to insert a business idea from JSON
CREATE OR REPLACE FUNCTION insert_business_idea(idea_data JSONB)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO business_ideas (
        business_idea,
        problem_description,
        is_observable_publicly,
        digital_detection_method,
        value_description,
        what_they_currently_pay,
        our_cost_to_provide,
        lead_magnet_strategy,
        dream_outcome,
        digital_signals,
        scraping_targets,
        automation_approach,
        identification_criteria,
        target_market,
        solution_overview,
        revenue_model,
        implementation_plan,
        success_metrics,
        raw_response
    ) VALUES (
        idea_data->>'businessIdea',
        idea_data->'problemIdentification'->>'description',
        CASE 
            WHEN idea_data->'problemIdentification'->>'isObservablePublicly' = 'Yes' THEN true
            WHEN idea_data->'problemIdentification'->>'isObservablePublicly' = 'No' THEN false
            ELSE null
        END,
        idea_data->'problemIdentification'->>'digitalDetectionMethod',
        idea_data->'valueProposition'->>'description',
        idea_data->'valueProposition'->>'whatTheyCurrentlyPay',
        idea_data->'valueProposition'->>'ourCostToProvide',
        idea_data->'valueProposition'->>'leadMagnetStrategy',
        idea_data->'dreamOutcome'->>'conciseStatement',
        COALESCE(idea_data->'customerDetectionStrategy'->'digitalSignals', '[]'::jsonb),
        COALESCE(idea_data->'customerDetectionStrategy'->'scrapingTargets', '[]'::jsonb),
        idea_data->'customerDetectionStrategy'->>'automationApproach',
        COALESCE(idea_data->'customerDetectionStrategy'->'identificationCriteria', '[]'::jsonb),
        idea_data->>'targetMarket',
        idea_data->>'solutionOverview',
        idea_data->>'revenueModel',
        idea_data->>'implementationPlan',
        COALESCE(idea_data->'successMetrics', '[]'::jsonb),
        idea_data->>'rawResponse'
    ) RETURNING id INTO new_id;
    
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;