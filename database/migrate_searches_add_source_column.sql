-- Migration: Add source column to searches table
-- This migration adds a source column to distinguish between different search sources (e.g., serper.dev)
-- and updates the existing search_type column to represent the type of search (company, person, etc.)

BEGIN;

-- Add source column to searches table
ALTER TABLE searches 
ADD COLUMN IF NOT EXISTS source TEXT;

-- Update existing records to set source to 'serper.dev' where it's currently null
UPDATE searches 
SET source = 'serper.dev' 
WHERE source IS NULL;

-- Make source column NOT NULL with default
ALTER TABLE searches 
ALTER COLUMN source SET NOT NULL,
ALTER COLUMN source SET DEFAULT 'serper.dev';

-- Update existing search_type values to be more specific
-- Convert old 'serper_search' values to 'search' for backward compatibility
UPDATE searches 
SET search_type = 'search' 
WHERE search_type = 'serper_search';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_searches_source ON searches(source);
CREATE INDEX IF NOT EXISTS idx_searches_search_type ON searches(search_type);

-- Add comments for documentation
COMMENT ON COLUMN searches.source IS 'The source of the search (e.g., serper.dev)';
COMMENT ON COLUMN searches.search_type IS 'The type of search (company, person, search, etc.)';

COMMIT; 