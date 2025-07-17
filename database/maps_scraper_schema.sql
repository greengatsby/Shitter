-- Google Maps Scraper Database Schema
-- This schema stores scraping sessions and grid points for the Google Maps scraper tool

-- Create scraping_sessions table
CREATE TABLE IF NOT EXISTS scraping_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_query TEXT NOT NULL,
    coordinate_density INTEGER NOT NULL,
    bounds JSONB NOT NULL,
    scraping_mode TEXT NOT NULL CHECK (scraping_mode IN ('phantombuster', 'direct')),
    total_points INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'csv_generated', 'scraping_started', 'completed', 'failed')),
    scraped_results JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Add indexes for common queries
    INDEX idx_scraping_sessions_search_query (search_query),
    INDEX idx_scraping_sessions_created_at (created_at),
    INDEX idx_scraping_sessions_status (status)
);

-- Create scraping_grid_points table
CREATE TABLE IF NOT EXISTS scraping_grid_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scraping_session_id UUID NOT NULL REFERENCES scraping_sessions(id) ON DELETE CASCADE,
    point_id INTEGER NOT NULL,
    latitude DECIMAL(10, 6) NOT NULL,
    longitude DECIMAL(10, 6) NOT NULL,
    google_maps_url TEXT NOT NULL,
    scraped_businesses JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Add indexes for common queries
    INDEX idx_grid_points_session_id (scraping_session_id),
    INDEX idx_grid_points_coordinates (latitude, longitude),
    INDEX idx_grid_points_point_id (point_id),
    
    -- Unique constraint to prevent duplicate points per session
    UNIQUE(scraping_session_id, point_id)
);

-- Create a view for session summaries
CREATE OR REPLACE VIEW scraping_session_summaries AS
SELECT 
    s.id,
    s.search_query,
    s.coordinate_density,
    s.bounds,
    s.scraping_mode,
    s.total_points,
    s.status,
    s.created_at,
    s.completed_at,
    COUNT(gp.id) as grid_points_count,
    CASE 
        WHEN s.completed_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (s.completed_at - s.created_at))::INTEGER
        ELSE NULL
    END as duration_seconds
FROM scraping_sessions s
LEFT JOIN scraping_grid_points gp ON s.id = gp.scraping_session_id
GROUP BY s.id, s.search_query, s.coordinate_density, s.bounds, s.scraping_mode, s.total_points, s.status, s.created_at, s.completed_at;

-- Create function to get session statistics
CREATE OR REPLACE FUNCTION get_scraping_statistics(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
    total_sessions INTEGER,
    phantombuster_sessions INTEGER,
    direct_scrape_sessions INTEGER,
    completed_sessions INTEGER,
    failed_sessions INTEGER,
    avg_points_per_session DECIMAL,
    most_common_query TEXT,
    total_grid_points INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_sessions,
        COUNT(CASE WHEN scraping_mode = 'phantombuster' THEN 1 END)::INTEGER as phantombuster_sessions,
        COUNT(CASE WHEN scraping_mode = 'direct' THEN 1 END)::INTEGER as direct_scrape_sessions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END)::INTEGER as completed_sessions,
        COUNT(CASE WHEN status = 'failed' THEN 1 END)::INTEGER as failed_sessions,
        AVG(total_points) as avg_points_per_session,
        MODE() WITHIN GROUP (ORDER BY search_query) as most_common_query,
        SUM(total_points)::INTEGER as total_grid_points
    FROM scraping_sessions
    WHERE created_at >= NOW() - INTERVAL '%s days' % days_back;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up old sessions (optional)
CREATE OR REPLACE FUNCTION cleanup_old_scraping_sessions(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM scraping_sessions 
    WHERE created_at < NOW() - INTERVAL '%s days' % days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE scraping_sessions IS 'Stores Google Maps scraping sessions with configuration and results';
COMMENT ON TABLE scraping_grid_points IS 'Stores individual grid points for each scraping session';
COMMENT ON VIEW scraping_session_summaries IS 'Provides summary statistics for scraping sessions';
COMMENT ON FUNCTION get_scraping_statistics(INTEGER) IS 'Returns overall statistics for scraping sessions';
COMMENT ON FUNCTION cleanup_old_scraping_sessions(INTEGER) IS 'Cleans up old scraping sessions to maintain database size';

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON scraping_sessions TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON scraping_grid_points TO your_app_user;
-- GRANT SELECT ON scraping_session_summaries TO your_app_user;
-- GRANT EXECUTE ON FUNCTION get_scraping_statistics(INTEGER) TO your_app_user;
-- GRANT EXECUTE ON FUNCTION cleanup_old_scraping_sessions(INTEGER) TO your_app_user; 