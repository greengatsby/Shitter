-- Clean GitHub App Migration - Remove OAuth integration entirely
-- This drops the legacy github_integrations table and updates repositories to only use installations

BEGIN;

-- 1. Drop existing foreign key constraint and column from github_repositories
ALTER TABLE github_repositories DROP CONSTRAINT IF EXISTS github_repositories_github_integration_id_fkey;
ALTER TABLE github_repositories DROP COLUMN IF EXISTS github_integration_id;

-- 2. Add installation_id column to github_repositories (if it doesn't exist)
ALTER TABLE github_repositories 
ADD COLUMN IF NOT EXISTS installation_id bigint NOT NULL;

-- 3. Add foreign key constraint to github_app_installations
ALTER TABLE github_repositories 
ADD CONSTRAINT github_repositories_installation_id_fkey 
FOREIGN KEY (installation_id) REFERENCES github_app_installations(installation_id) ON DELETE CASCADE;

-- 4. Add index for the new foreign key
CREATE INDEX IF NOT EXISTS idx_github_repositories_installation_id 
ON github_repositories(installation_id);

-- 5. Update unique constraint to use installation_id instead of integration_id
ALTER TABLE github_repositories DROP CONSTRAINT IF EXISTS github_repositories_github_integration_id_github_repo_id_key;
ALTER TABLE github_repositories ADD CONSTRAINT github_repositories_installation_id_github_repo_id_key 
UNIQUE (installation_id, github_repo_id);

-- 6. Drop the github_integrations table entirely
DROP TABLE IF EXISTS github_integrations CASCADE;

-- 7. Update user_repository_assignments if it references github_repositories
-- (The foreign key should cascade properly, but let's be explicit)
-- No changes needed here as it references github_repositories.id which remains unchanged

-- 8. Update the repositories count in installations
UPDATE github_app_installations 
SET repositories_count = (
    SELECT COUNT(*) 
    FROM github_repositories 
    WHERE installation_id = github_app_installations.installation_id 
    AND is_active = true
);

COMMIT; 