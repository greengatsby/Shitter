-- Enhanced GitHub App Integration Schema
-- This extends the existing schema to support GitHub App installations

-- Update github_integrations table to support GitHub Apps
ALTER TABLE github_integrations ADD COLUMN IF NOT EXISTS installation_id BIGINT;
ALTER TABLE github_integrations ADD COLUMN IF NOT EXISTS installation_token TEXT;
ALTER TABLE github_integrations ADD COLUMN IF NOT EXISTS installation_token_expires_at TIMESTAMPTZ;
ALTER TABLE github_integrations ADD COLUMN IF NOT EXISTS app_slug TEXT DEFAULT 'org-flow';
ALTER TABLE github_integrations ADD COLUMN IF NOT EXISTS account_type TEXT; -- 'User' or 'Organization'
ALTER TABLE github_integrations ADD COLUMN IF NOT EXISTS account_login TEXT;
ALTER TABLE github_integrations ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;
ALTER TABLE github_integrations ADD COLUMN IF NOT EXISTS events JSONB DEFAULT '[]'::jsonb;

-- Add unique constraint for installation_id
ALTER TABLE github_integrations ADD CONSTRAINT unique_installation_id UNIQUE (installation_id);

-- Update github_repositories table to include more GitHub data
ALTER TABLE github_repositories ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE github_repositories ADD COLUMN IF NOT EXISTS default_branch TEXT DEFAULT 'main';
ALTER TABLE github_repositories ADD COLUMN IF NOT EXISTS clone_url TEXT;
ALTER TABLE github_repositories ADD COLUMN IF NOT EXISTS ssh_url TEXT;
ALTER TABLE github_repositories ADD COLUMN IF NOT EXISTS size_kb INTEGER;
ALTER TABLE github_repositories ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;
ALTER TABLE github_repositories ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT false;
ALTER TABLE github_repositories ADD COLUMN IF NOT EXISTS pushed_at TIMESTAMPTZ;
ALTER TABLE github_repositories ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;

-- Create GitHub App installations table for tracking installation events
CREATE TABLE IF NOT EXISTS github_app_installations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    installation_id BIGINT UNIQUE NOT NULL,
    app_id INTEGER NOT NULL,
    app_slug TEXT NOT NULL,
    
    -- Account information (the account where the app is installed)
    account_id BIGINT NOT NULL,
    account_login TEXT NOT NULL,
    account_type TEXT NOT NULL, -- 'User' or 'Organization'
    account_avatar_url TEXT,
    
    -- Installation details
    target_type TEXT, -- 'User' or 'Organization'
    target_id BIGINT,
    
    -- Permissions and events
    permissions JSONB DEFAULT '{}'::jsonb,
    events JSONB DEFAULT '[]'::jsonb,
    
    -- Repository selection
    repository_selection TEXT, -- 'all' or 'selected'
    repositories_count INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    suspended_at TIMESTAMPTZ,
    suspended_by TEXT,
    
    -- Our organization mapping
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    CONSTRAINT github_app_installations_updated_at_check CHECK (updated_at >= created_at)
);

-- Create GitHub webhooks log table
CREATE TABLE IF NOT EXISTS github_webhook_deliveries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Webhook details
    delivery_id TEXT UNIQUE,
    event_type TEXT NOT NULL,
    action TEXT,
    installation_id BIGINT,
    
    -- Payload
    payload JSONB NOT NULL,
    headers JSONB,
    
    -- Processing status
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    error_message TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_github_integrations_installation_id ON github_integrations(installation_id);
CREATE INDEX IF NOT EXISTS idx_github_integrations_org_id ON github_integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_github_repositories_integration_id ON github_repositories(github_integration_id);
CREATE INDEX IF NOT EXISTS idx_github_repositories_github_repo_id ON github_repositories(github_repo_id);
CREATE INDEX IF NOT EXISTS idx_github_app_installations_installation_id ON github_app_installations(installation_id);
CREATE INDEX IF NOT EXISTS idx_github_app_installations_org_id ON github_app_installations(organization_id);
CREATE INDEX IF NOT EXISTS idx_github_webhook_deliveries_installation_id ON github_webhook_deliveries(installation_id);
CREATE INDEX IF NOT EXISTS idx_github_webhook_deliveries_event_type ON github_webhook_deliveries(event_type);
CREATE INDEX IF NOT EXISTS idx_github_webhook_deliveries_processed ON github_webhook_deliveries(processed);

-- Add triggers for updated_at
CREATE TRIGGER update_github_app_installations_updated_at 
    BEFORE UPDATE ON github_app_installations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies for GitHub App installations
ALTER TABLE github_app_installations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view their GitHub installations" ON github_app_installations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members 
            WHERE organization_members.organization_id = github_app_installations.organization_id 
            AND organization_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Organization admins can manage GitHub installations" ON github_app_installations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM organization_members 
            WHERE organization_members.organization_id = github_app_installations.organization_id 
            AND organization_members.user_id = auth.uid()
            AND organization_members.role IN ('owner', 'admin')
        )
    );

-- Add RLS for webhook deliveries (admin only)
ALTER TABLE github_webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization admins can view webhook deliveries" ON github_webhook_deliveries
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM github_app_installations gai
            JOIN organization_members om ON gai.organization_id = om.organization_id
            WHERE gai.installation_id = github_webhook_deliveries.installation_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

-- Functions for GitHub App management

-- Function to create or update GitHub installation
CREATE OR REPLACE FUNCTION upsert_github_installation(
    p_installation_id BIGINT,
    p_app_id INTEGER,
    p_app_slug TEXT,
    p_account_id BIGINT,
    p_account_login TEXT,
    p_account_type TEXT,
    p_account_avatar_url TEXT DEFAULT NULL,
    p_permissions JSONB DEFAULT '{}'::jsonb,
    p_events JSONB DEFAULT '[]'::jsonb,
    p_repository_selection TEXT DEFAULT 'all',
    p_repositories_count INTEGER DEFAULT 0,
    p_organization_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    installation_uuid UUID;
BEGIN
    INSERT INTO github_app_installations (
        installation_id,
        app_id,
        app_slug,
        account_id,
        account_login,
        account_type,
        account_avatar_url,
        permissions,
        events,
        repository_selection,
        repositories_count,
        organization_id
    ) VALUES (
        p_installation_id,
        p_app_id,
        p_app_slug,
        p_account_id,
        p_account_login,
        p_account_type,
        p_account_avatar_url,
        p_permissions,
        p_events,
        p_repository_selection,
        p_repositories_count,
        p_organization_id
    )
    ON CONFLICT (installation_id) 
    DO UPDATE SET
        app_id = EXCLUDED.app_id,
        app_slug = EXCLUDED.app_slug,
        account_id = EXCLUDED.account_id,
        account_login = EXCLUDED.account_login,
        account_type = EXCLUDED.account_type,
        account_avatar_url = EXCLUDED.account_avatar_url,
        permissions = EXCLUDED.permissions,
        events = EXCLUDED.events,
        repository_selection = EXCLUDED.repository_selection,
        repositories_count = EXCLUDED.repositories_count,
        organization_id = CASE 
            WHEN EXCLUDED.organization_id IS NOT NULL THEN EXCLUDED.organization_id 
            ELSE github_app_installations.organization_id 
        END,
        updated_at = NOW(),
        is_active = true,
        suspended_at = NULL,
        suspended_by = NULL
    RETURNING id INTO installation_uuid;
    
    RETURN installation_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to suspend GitHub installation
CREATE OR REPLACE FUNCTION suspend_github_installation(
    p_installation_id BIGINT,
    p_suspended_by TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE github_app_installations 
    SET 
        is_active = false,
        suspended_at = NOW(),
        suspended_by = p_suspended_by,
        updated_at = NOW()
    WHERE installation_id = p_installation_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log webhook delivery
CREATE OR REPLACE FUNCTION log_github_webhook(
    p_delivery_id TEXT,
    p_event_type TEXT,
    p_action TEXT,
    p_installation_id BIGINT,
    p_payload JSONB,
    p_headers JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    webhook_id UUID;
BEGIN
    INSERT INTO github_webhook_deliveries (
        delivery_id,
        event_type,
        action,
        installation_id,
        payload,
        headers
    ) VALUES (
        p_delivery_id,
        p_event_type,
        p_action,
        p_installation_id,
        p_payload,
        p_headers
    ) RETURNING id INTO webhook_id;
    
    RETURN webhook_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE github_app_installations IS 'Tracks GitHub App installations across organizations';
COMMENT ON TABLE github_webhook_deliveries IS 'Logs all GitHub webhook deliveries for debugging and audit';
COMMENT ON COLUMN github_integrations.installation_id IS 'GitHub App installation ID';
COMMENT ON COLUMN github_integrations.installation_token IS 'Temporary installation access token';
COMMENT ON COLUMN github_integrations.installation_token_expires_at IS 'When the installation token expires'; 