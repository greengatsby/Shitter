-- Migration: Update user_repository_assignments to use client_id referencing organization_clients
-- This script migrates the user_repository_assignments table to use client_id instead of user_id
-- and updates the foreign key to reference organization_clients instead of users

BEGIN;

-- Step 1: Drop existing constraints and indexes
ALTER TABLE public.user_repository_assignments 
DROP CONSTRAINT IF EXISTS user_repository_assignments_user_id_fkey;

ALTER TABLE public.user_repository_assignments 
DROP CONSTRAINT IF EXISTS user_repository_assignments_user_id_repository_id_key;

DROP INDEX IF EXISTS idx_user_repository_assignments_user_id;

-- Step 2: Rename the column from user_id to client_id
ALTER TABLE public.user_repository_assignments 
RENAME COLUMN user_id TO client_id;

-- Step 3: Create new unique constraint with the renamed column
ALTER TABLE public.user_repository_assignments 
ADD CONSTRAINT user_repository_assignments_client_id_repository_id_key 
UNIQUE (client_id, repository_id);

-- Step 4: Create new index for the renamed column
CREATE INDEX IF NOT EXISTS idx_user_repository_assignments_client_id 
ON public.user_repository_assignments USING btree (client_id) 
TABLESPACE pg_default;

-- Step 5: Add new foreign key constraint pointing to organization_clients
ALTER TABLE public.user_repository_assignments 
ADD CONSTRAINT user_repository_assignments_client_id_fkey 
FOREIGN KEY (client_id) REFERENCES public.organization_clients (id) ON DELETE CASCADE;

-- Step 6: Keep assigned_by referencing users table
-- The assigned_by field should continue to reference users (admins who do the assignment)
-- No changes needed for assigned_by foreign key constraint

COMMIT;

-- Verification queries to run after migration:
-- SELECT constraint_name, constraint_type FROM information_schema.table_constraints 
-- WHERE table_name = 'user_repository_assignments';
-- 
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename = 'user_repository_assignments';
--
-- \d user_repository_assignments 