-- Create enum types for business idea categorization
CREATE TYPE idea_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high');

-- Organization and user management
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE user_status AS ENUM ('active', 'pending', 'inactive');

-- Create organizations table
CREATE TABLE organizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    
    -- Settings
    settings JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT organizations_updated_at_check CHECK (updated_at >= created_at)
);

-- Create users table (extends Supabase auth)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Profile information
    email TEXT NOT NULL,
    full_name TEXT,
    phone_number TEXT UNIQUE,
    avatar_url TEXT,
    
    -- Status
    status user_status DEFAULT 'active',
    
    -- Phone verification
    phone_verified BOOLEAN DEFAULT false,
    phone_verification_code TEXT,
    phone_verification_expires_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT users_updated_at_check CHECK (updated_at >= created_at)
);

-- Create organization clients table (updated structure)
CREATE TABLE organization_clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    org_client_id UUID REFERENCES organization_clients_profile(id) ON DELETE CASCADE,
    
    role member_role DEFAULT 'member',
    phone TEXT,
    
    -- Invitation system
    invited_by UUID REFERENCES organization_clients_profile(id),
    invited_at TIMESTAMP WITH TIME ZONE,
    joined_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(organization_id, org_client_id),
    CONSTRAINT organization_clients_updated_at_check CHECK (updated_at >= created_at)
);

-- Create organization clients profile table
CREATE TABLE organization_clients_profile (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Foreign key to auth.users
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Profile information
    email TEXT,
    full_name TEXT,
    phone_number TEXT,
    avatar_url TEXT,
    
    -- Additional client-specific fields
    company_name TEXT,
    position TEXT,
    notes TEXT,
    
    -- Status
    status user_status DEFAULT 'active',
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT organization_clients_profile_updated_at_check CHECK (updated_at >= created_at)
);

-- Create GitHub integrations table
CREATE TABLE github_integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- GitHub OAuth data
    github_user_id INTEGER NOT NULL,
    github_username TEXT NOT NULL,
    access_token TEXT NOT NULL, -- Encrypted in production
    
    -- Integration settings
    is_active BOOLEAN DEFAULT true,
    
    UNIQUE(organization_id, github_user_id),
    CONSTRAINT github_integrations_updated_at_check CHECK (updated_at >= created_at)
);

-- Create GitHub repositories table
CREATE TABLE github_repositories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    github_integration_id UUID NOT NULL REFERENCES github_integrations(id) ON DELETE CASCADE,
    
    -- GitHub repository data
    github_repo_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    description TEXT,
    private BOOLEAN DEFAULT false,
    html_url TEXT NOT NULL,
    
    -- Repository settings
    is_active BOOLEAN DEFAULT true,
    
    UNIQUE(github_integration_id, github_repo_id),
    CONSTRAINT github_repositories_updated_at_check CHECK (updated_at >= created_at)
);

-- Create user repository assignments table
CREATE TABLE user_repository_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL REFERENCES github_repositories(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES users(id),
    
    -- Assignment details
    role TEXT DEFAULT 'developer', -- developer, reviewer, admin
    permissions JSONB DEFAULT '[]'::jsonb, -- Array of permission strings
    
    UNIQUE(user_id, repository_id),
    CONSTRAINT user_repository_assignments_updated_at_check CHECK (updated_at >= created_at)
);

-- Create processed messages table for SMS deduplication
CREATE TABLE processed_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    message_id TEXT NOT NULL UNIQUE,
    phone_number TEXT NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Optional metadata
    message_text TEXT,
    user_id UUID REFERENCES users(id)
);

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
    
    -- User and organization tracking
    user_id UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    
    -- Timestamps
    CONSTRAINT business_ideas_updated_at_check CHECK (updated_at >= created_at)
);

-- Create indexes for better query performance
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_users_phone_number ON users(phone_number);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_organization_clients_org_id ON organization_clients(organization_id);
CREATE INDEX idx_organization_clients_org_client_id ON organization_clients(org_client_id);
CREATE INDEX idx_organization_clients_phone ON organization_clients(phone);

-- Indexes for organization_clients_profile
CREATE INDEX idx_organization_clients_profile_auth_user_id ON organization_clients_profile(auth_user_id);
CREATE INDEX idx_organization_clients_profile_email ON organization_clients_profile(email);
CREATE INDEX idx_organization_clients_profile_phone_number ON organization_clients_profile(phone_number);
CREATE INDEX idx_github_integrations_org_id ON github_integrations(organization_id);
CREATE INDEX idx_github_repositories_integration_id ON github_repositories(github_integration_id);
CREATE INDEX idx_user_repository_assignments_user_id ON user_repository_assignments(user_id);
CREATE INDEX idx_user_repository_assignments_repo_id ON user_repository_assignments(repository_id);
CREATE INDEX idx_processed_messages_message_id ON processed_messages(message_id);
CREATE INDEX idx_processed_messages_phone_number ON processed_messages(phone_number);

-- Original business ideas indexes
CREATE INDEX idx_business_ideas_created_at ON business_ideas(created_at DESC);
CREATE INDEX idx_business_ideas_status ON business_ideas(status);
CREATE INDEX idx_business_ideas_priority ON business_ideas(priority);
CREATE INDEX idx_business_ideas_user_id ON business_ideas(user_id);
CREATE INDEX idx_business_ideas_organization_id ON business_ideas(organization_id);

-- Create triggers to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at 
    BEFORE UPDATE ON organizations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_clients_updated_at 
    BEFORE UPDATE ON organization_clients 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_clients_profile_updated_at 
    BEFORE UPDATE ON organization_clients_profile 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_github_integrations_updated_at 
    BEFORE UPDATE ON github_integrations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_github_repositories_updated_at 
    BEFORE UPDATE ON github_repositories 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_repository_assignments_updated_at 
    BEFORE UPDATE ON user_repository_assignments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

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
    user_id,
    organization_id
FROM business_ideas;

-- Add Row Level Security (RLS) policies

-- Organizations RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization clients can view their organizations" ON organizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_clients oc
            JOIN organization_clients_profile ocp ON oc.org_client_id = ocp.id
            WHERE oc.organization_id = organizations.id 
            AND ocp.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Organization owners can update their organizations" ON organizations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM organization_clients oc
            JOIN organization_clients_profile ocp ON oc.org_client_id = ocp.id
            WHERE oc.organization_id = organizations.id 
            AND ocp.auth_user_id = auth.uid()
            AND oc.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Users can create organizations" ON organizations
    FOR INSERT WITH CHECK (true);

-- Users RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Allow user profile creation" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Organization clients can view other users" ON users
    FOR SELECT USING (
        auth.uid() = id OR
        EXISTS (
            SELECT 1 FROM organization_clients_profile ocp1
            JOIN organization_clients oc1 ON ocp1.id = oc1.org_client_id
            JOIN organization_clients oc2 ON oc1.organization_id = oc2.organization_id
            JOIN organization_clients_profile ocp2 ON oc2.org_client_id = ocp2.id
            WHERE ocp1.auth_user_id = auth.uid() AND ocp2.auth_user_id = id
        )
    );

-- Organization clients RLS
ALTER TABLE organization_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization clients can view their memberships" ON organization_clients
    FOR SELECT USING (
        org_client_id IN (
            SELECT id FROM organization_clients_profile WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Organization admins can manage clients" ON organization_clients
    FOR ALL USING (
        org_client_id IN (
            SELECT id FROM organization_clients_profile WHERE auth_user_id = auth.uid()
        ) OR
        organization_id IN (
            SELECT oc.organization_id 
            FROM organization_clients oc
            JOIN organization_clients_profile ocp ON oc.org_client_id = ocp.id
            WHERE ocp.auth_user_id = auth.uid() 
            AND oc.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Allow organization client creation" ON organization_clients
    FOR INSERT WITH CHECK (true);

-- Organization clients profile RLS
ALTER TABLE organization_clients_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own client profile" ON organization_clients_profile
    FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own client profile" ON organization_clients_profile
    FOR UPDATE USING (auth_user_id = auth.uid());

CREATE POLICY "Allow client profile creation" ON organization_clients_profile
    FOR INSERT WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Organization admins can view client profiles" ON organization_clients_profile
    FOR SELECT USING (
        id IN (
            SELECT oc.org_client_id
            FROM organization_clients oc
            JOIN organization_clients_profile ocp_admin ON oc.org_client_id = ocp_admin.id
            WHERE ocp_admin.auth_user_id = auth.uid()
            AND oc.role IN ('owner', 'admin')
        ) OR
        auth_user_id = auth.uid()
    );

-- GitHub integrations RLS
ALTER TABLE github_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization clients can view GitHub integrations" ON github_integrations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_clients oc
            JOIN organization_clients_profile ocp ON oc.org_client_id = ocp.id
            WHERE oc.organization_id = github_integrations.organization_id 
            AND ocp.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Organization admins can manage GitHub integrations" ON github_integrations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM organization_clients oc
            JOIN organization_clients_profile ocp ON oc.org_client_id = ocp.id
            WHERE oc.organization_id = github_integrations.organization_id 
            AND ocp.auth_user_id = auth.uid()
            AND oc.role IN ('owner', 'admin')
        )
    );

-- GitHub repositories RLS
ALTER TABLE github_repositories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization clients can view GitHub repositories" ON github_repositories
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM github_integrations gi
            JOIN organization_clients oc ON gi.organization_id = oc.organization_id
            JOIN organization_clients_profile ocp ON oc.org_client_id = ocp.id
            WHERE gi.id = github_repositories.github_integration_id 
            AND ocp.auth_user_id = auth.uid()
        )
    );

-- User repository assignments RLS
ALTER TABLE user_repository_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their repository assignments" ON user_repository_assignments
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM github_repositories gr
            JOIN github_integrations gi ON gr.github_integration_id = gi.id
            JOIN organization_clients oc ON gi.organization_id = oc.organization_id
            JOIN organization_clients_profile ocp ON oc.org_client_id = ocp.id
            WHERE gr.id = user_repository_assignments.repository_id 
            AND ocp.auth_user_id = auth.uid()
        )
    );

-- Business ideas RLS (updated)
ALTER TABLE business_ideas ENABLE ROW LEVEL SECURITY;

-- Remove old policies
DROP POLICY IF EXISTS "Users can view their own ideas" ON business_ideas;
DROP POLICY IF EXISTS "Users can insert their own ideas" ON business_ideas;
DROP POLICY IF EXISTS "Users can update their own ideas" ON business_ideas;
DROP POLICY IF EXISTS "Allow anonymous select" ON business_ideas;
DROP POLICY IF EXISTS "Allow anonymous insert" ON business_ideas;
DROP POLICY IF EXISTS "Allow anonymous update" ON business_ideas;

-- New policies
CREATE POLICY "Users can view their own ideas" ON business_ideas
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Organization clients can view organization ideas" ON business_ideas
    FOR SELECT USING (
        organization_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM organization_clients oc
            JOIN organization_clients_profile ocp ON oc.org_client_id = ocp.id
            WHERE oc.organization_id = business_ideas.organization_id 
            AND ocp.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own ideas" ON business_ideas
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own ideas" ON business_ideas
    FOR UPDATE USING (user_id = auth.uid());

-- Functions

-- Function to create organization with owner
CREATE OR REPLACE FUNCTION create_organization_with_owner(
    org_name TEXT,
    org_slug TEXT,
    owner_auth_user_id UUID
) RETURNS UUID AS $$
DECLARE
    new_org_id UUID;
    client_profile_id UUID;
BEGIN
    -- Insert organization
    INSERT INTO organizations (name, slug)
    VALUES (org_name, org_slug)
    RETURNING id INTO new_org_id;
    
    -- Create client profile if it doesn't exist
    INSERT INTO organization_clients_profile (auth_user_id)
    VALUES (owner_auth_user_id)
    ON CONFLICT (auth_user_id) DO NOTHING
    RETURNING id INTO client_profile_id;
    
    -- Get client profile id if it already existed
    IF client_profile_id IS NULL THEN
        SELECT id INTO client_profile_id 
        FROM organization_clients_profile 
        WHERE auth_user_id = owner_auth_user_id;
    END IF;
    
    -- Add owner as organization client
    INSERT INTO organization_clients (organization_id, org_client_id, role, joined_at)
    VALUES (new_org_id, client_profile_id, 'owner', NOW());
    
    RETURN new_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to invite user to organization via phone
CREATE OR REPLACE FUNCTION invite_user_to_organization(
    org_id UUID,
    phone TEXT,
    inviter_user_id UUID,
    member_role member_role DEFAULT 'member'
) RETURNS UUID AS $$
DECLARE
    target_user_id UUID;
    existing_member_id UUID;
    new_member_id UUID;
BEGIN
    -- Check if inviter has permission
    IF NOT EXISTS (
        SELECT 1 FROM organization_members 
        WHERE organization_id = org_id 
        AND user_id = inviter_user_id 
        AND role IN ('owner', 'admin')
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions to invite users';
    END IF;
    
    -- Find user by phone number
    SELECT id INTO target_user_id 
    FROM users 
    WHERE phone_number = phone;
    
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User with phone number % not found', phone;
    END IF;
    
    -- Check if user is already a member
    SELECT id INTO existing_member_id
    FROM organization_members
    WHERE organization_id = org_id AND user_id = target_user_id;
    
    IF existing_member_id IS NOT NULL THEN
        RAISE EXCEPTION 'User is already a member of this organization';
    END IF;
    
    -- Add user to organization
    INSERT INTO organization_members (
        organization_id, 
        user_id, 
        role, 
        invited_by, 
        invited_at, 
        joined_at
    )
    VALUES (
        org_id, 
        target_user_id, 
        member_role, 
        inviter_user_id, 
        NOW(), 
        NOW()
    )
    RETURNING id INTO new_member_id;
    
    RETURN new_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Keep the original insert_business_idea function
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