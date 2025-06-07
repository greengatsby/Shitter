# Supabase Setup Instructions

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be fully provisioned

## 2. Run the Database Schema

1. In your Supabase dashboard, go to the SQL Editor
2. Copy and paste the contents of `database/schema.sql`
3. Run the SQL to create all tables, functions, and policies

## 3. Get Your Project Credentials

1. In your Supabase dashboard, go to Settings > API
2. Copy the following values:
   - **Project URL** (looks like: `https://abc123.supabase.co`)
   - **anon public key** (starts with `eyJ...`)

## 4. Update Environment Variables

Add these to your `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
```

## 5. Test the Connection

1. Start your development server: `npm run dev`
2. Go to `/ideate` and generate a business idea
3. Check the console for successful save messages
4. Go to `/ideas` to view saved ideas

## Database Schema Overview

The setup creates:

### Tables
- **business_ideas**: Main table storing all generated ideas with full details
- **business_ideas_formatted**: View that returns data in JSON format matching the UI

### Functions
- **insert_business_idea()**: Safely inserts a business idea from JSON data
- **update_updated_at_column()**: Automatically updates timestamps

### Security
- Row Level Security (RLS) enabled
- Anonymous access allowed (remove when adding authentication)
- Future-ready for user-specific access

### Key Features
- Automatic timestamping
- JSON storage for arrays (digital signals, scraping targets, etc.)
- Enum types for status and priority
- Optimized queries with indexes

## API Endpoints

- **POST /api/ideate**: Generate and save new ideas
- **GET /api/ideas**: Retrieve saved ideas (with pagination)
- **DELETE /api/ideas?id=uuid**: Delete a specific idea

## Troubleshooting

### Common Issues

1. **"relation does not exist" error**
   - Make sure you've run the schema.sql file completely
   - Check that all tables were created in the public schema

2. **"permission denied" error**
   - Verify your RLS policies are set up correctly
   - Check that anonymous access policies are enabled

3. **Environment variables not working**
   - Restart your development server after adding env vars
   - Make sure variable names match exactly (including NEXT_PUBLIC prefix)

4. **JSON parsing errors**
   - Check that the AI response structure matches expected JSON format
   - Look at console logs for raw responses

### Verification Steps

1. Check Supabase table editor to see saved ideas
2. Test API endpoints directly with tools like Postman
3. Monitor the Network tab in browser dev tools
4. Check Supabase logs for database errors

## Future Enhancements

- Add user authentication with Supabase Auth
- Implement idea sharing and collaboration
- Add idea categorization and tagging
- Create analytics dashboard for idea performance
- Add export functionality (PDF, CSV)