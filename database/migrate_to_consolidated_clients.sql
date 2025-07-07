-- Migration script to consolidate organization_clients_profile into organization_clients
-- This script moves data from the separate profile table into the main clients table

BEGIN;

-- Step 1: Add the new columns to organization_clients table
ALTER TABLE organization_clients 
ADD COLUMN IF NOT EXISTS auth_user_id UUID,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS position TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS status user_status DEFAULT 'active',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS temp_profile_data JSONB;

-- Step 2: Update existing organization_clients records with profile data
UPDATE organization_clients oc
SET 
  auth_user_id = ocp.auth_user_id,
  email = ocp.email,
  full_name = ocp.full_name,
  phone_number = ocp.phone_number,
  avatar_url = ocp.avatar_url,
  company_name = ocp.company_name,
  position = ocp.position,
  notes = ocp.notes,
  status = ocp.status,
  metadata = ocp.metadata,
  temp_profile_data = jsonb_build_object(
    'migrated_from_profile_id', ocp.id,
    'migration_timestamp', NOW()
  )
FROM organization_clients_profile ocp
WHERE oc.org_client_id = ocp.id;

-- Step 3: Handle organization_clients records that don't have matching profiles
-- This shouldn't happen in a well-formed database, but let's be safe
UPDATE organization_clients 
SET temp_profile_data = jsonb_build_object(
  'no_profile_found', true,
  'migration_timestamp', NOW()
)
WHERE auth_user_id IS NULL AND temp_profile_data IS NULL;

-- Step 4: Create new organization_clients records for any profiles that don't have clients
-- This handles cases where someone has a profile but isn't in any organization yet
INSERT INTO organization_clients (
  organization_id,
  auth_user_id,
  email,
  full_name,
  phone_number,
  avatar_url,
  company_name,
  position,
  notes,
  status,
  metadata,
  role,
  temp_profile_data
)
SELECT 
  NULL as organization_id, -- These will be orphaned records that need manual cleanup
  ocp.auth_user_id,
  ocp.email,
  ocp.full_name,
  ocp.phone_number,
  ocp.avatar_url,
  ocp.company_name,
  ocp.position,
  ocp.notes,
  ocp.status,
  ocp.metadata,
  'member' as role,
  jsonb_build_object(
    'orphaned_profile', true,
    'original_profile_id', ocp.id,
    'migration_timestamp', NOW()
  ) as temp_profile_data
FROM organization_clients_profile ocp
WHERE NOT EXISTS (
  SELECT 1 FROM organization_clients oc 
  WHERE oc.org_client_id = ocp.id
);

-- Step 5: Drop old RLS policies that depend on org_client_id
DROP POLICY IF EXISTS "Organizations visible to members" ON organizations;
DROP POLICY IF EXISTS "Organization admins can view webhook deliveries" ON github_webhook_deliveries;
DROP POLICY IF EXISTS "Organization clients can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Organization owners can update their organizations" ON organizations;
DROP POLICY IF EXISTS "Organization clients can view organization ideas" ON business_ideas;
DROP POLICY IF EXISTS "Organization clients can view GitHub integrations" ON github_integrations;
DROP POLICY IF EXISTS "Organization admins can manage GitHub integrations" ON github_integrations;
DROP POLICY IF EXISTS "Organization clients can view GitHub repositories" ON github_repositories;
DROP POLICY IF EXISTS "Users can view their repository assignments" ON user_repository_assignments;

-- Step 6: Remove the old foreign key constraints
ALTER TABLE organization_clients 
DROP CONSTRAINT IF EXISTS organization_clients_org_client_id_fkey;

ALTER TABLE organization_clients 
DROP CONSTRAINT IF EXISTS organization_clients_invited_by_fkey;

-- Step 7: Drop the old columns
ALTER TABLE organization_clients 
DROP COLUMN IF EXISTS org_client_id;

-- Step 8: Recreate RLS policies with new structure
-- Organizations RLS
CREATE POLICY "Organization clients can view their organizations" ON organizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_clients oc
            WHERE oc.organization_id = organizations.id 
            AND oc.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Organization owners can update their organizations" ON organizations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM organization_clients oc
            WHERE oc.organization_id = organizations.id 
            AND oc.auth_user_id = auth.uid()
            AND oc.role IN ('owner', 'admin')
        )
    );

-- GitHub integrations RLS (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'github_integrations') THEN
        EXECUTE 'CREATE POLICY "Organization clients can view GitHub integrations" ON github_integrations
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM organization_clients oc
                    WHERE oc.organization_id = github_integrations.organization_id 
                    AND oc.auth_user_id = auth.uid()
                )
            )';
        
        EXECUTE 'CREATE POLICY "Organization admins can manage GitHub integrations" ON github_integrations
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM organization_clients oc
                    WHERE oc.organization_id = github_integrations.organization_id 
                    AND oc.auth_user_id = auth.uid()
                    AND oc.role IN (''owner'', ''admin'')
                )
            )';
    END IF;
END $$;

-- GitHub repositories RLS (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'github_repositories') THEN
        EXECUTE 'CREATE POLICY "Organization clients can view GitHub repositories" ON github_repositories
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM github_integrations gi
                    JOIN organization_clients oc ON gi.organization_id = oc.organization_id
                    WHERE gi.id = github_repositories.github_integration_id 
                    AND oc.auth_user_id = auth.uid()
                )
            )';
    END IF;
END $$;

-- User repository assignments RLS (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_repository_assignments') THEN
        EXECUTE 'CREATE POLICY "Users can view their repository assignments" ON user_repository_assignments
            FOR SELECT USING (
                user_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM github_repositories gr
                    JOIN github_integrations gi ON gr.github_integration_id = gi.id
                    JOIN organization_clients oc ON gi.organization_id = oc.organization_id
                    WHERE gr.id = user_repository_assignments.repository_id 
                    AND oc.auth_user_id = auth.uid()
                )
            )';
    END IF;
END $$;

-- Business ideas RLS (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'business_ideas') THEN
        EXECUTE 'CREATE POLICY "Organization clients can view organization ideas" ON business_ideas
            FOR SELECT USING (
                organization_id IS NOT NULL AND
                EXISTS (
                    SELECT 1 FROM organization_clients oc
                    WHERE oc.organization_id = business_ideas.organization_id 
                    AND oc.auth_user_id = auth.uid()
                )
            )';
    END IF;
END $$;

-- GitHub webhook deliveries RLS (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'github_webhook_deliveries') THEN
        EXECUTE 'CREATE POLICY "Organization admins can view webhook deliveries" ON github_webhook_deliveries
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM github_app_installations gai
                    JOIN organization_clients oc ON gai.organization_id = oc.organization_id
                    WHERE gai.installation_id = github_webhook_deliveries.installation_id
                    AND oc.auth_user_id = auth.uid()
                    AND oc.role IN (''owner'', ''admin'')
                )
            )';
    END IF;
END $$;

-- Step 9: Update invited_by to reference auth.users instead of profiles
-- For now, set to NULL where we can't map it properly
-- This might need manual cleanup depending on your data
UPDATE organization_clients 
SET invited_by = NULL 
WHERE invited_by IS NOT NULL;

-- Step 10: Add the new foreign key constraint for invited_by
ALTER TABLE organization_clients 
ADD CONSTRAINT organization_clients_invited_by_fkey 
FOREIGN KEY (invited_by) REFERENCES auth.users(id);

-- Step 11: Add foreign key constraint for auth_user_id
ALTER TABLE organization_clients 
ADD CONSTRAINT organization_clients_auth_user_id_fkey 
FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 12: Add the new unique constraint
ALTER TABLE organization_clients 
ADD CONSTRAINT organization_clients_organization_id_auth_user_id_key 
UNIQUE (organization_id, auth_user_id);

-- Step 13: Create indexes for the new structure
CREATE INDEX IF NOT EXISTS idx_organization_clients_auth_user_id_new 
ON organization_clients(auth_user_id);

CREATE INDEX IF NOT EXISTS idx_organization_clients_email_new 
ON organization_clients(email);

CREATE INDEX IF NOT EXISTS idx_organization_clients_phone_number_new 
ON organization_clients(phone_number);

-- Step 14: Verification queries (commented out - uncomment to run checks)
/*
-- Check that all profiles were migrated
SELECT 
  'Profiles in old table' as check_type,
  COUNT(*) as count
FROM organization_clients_profile
UNION ALL
SELECT 
  'Clients with profile data' as check_type,
  COUNT(*) as count
FROM organization_clients 
WHERE auth_user_id IS NOT NULL
UNION ALL
SELECT 
  'Orphaned clients (no profile)' as check_type,
  COUNT(*) as count
FROM organization_clients 
WHERE auth_user_id IS NULL;
*/

-- Step 15: Drop the old organization_clients_profile table
-- WARNING: This is irreversible! Make sure the migration worked correctly first
-- DROP TABLE IF EXISTS organization_clients_profile CASCADE;

-- Step 16: Clean up temporary migration data
-- Remove the temporary column after verifying migration success
-- ALTER TABLE organization_clients DROP COLUMN IF EXISTS temp_profile_data;

COMMIT;

-- Post-migration notes:
-- 1. Verify that all expected data was migrated correctly
-- 2. Update any application code that still references org_client_id
-- 3. Test that authentication and permissions still work
-- 4. Consider running VACUUM ANALYZE on organization_clients after migration
-- 5. Uncomment and run the verification queries above to check migration success
-- 6. Only drop the old table after thorough testing
-- 7. Remove temp_profile_data column after verification 