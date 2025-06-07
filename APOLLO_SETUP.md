# Apollo API Integration Setup

This feature allows you to automatically generate company lists based on your business ideas using AI-powered keyword generation and Apollo.io's company database.

## Required Environment Variables

Add these to your `.env.local` file:

```bash
# OpenAI API Key (required for AI keyword generation)
OPENAI_API_KEY=your_openai_api_key_here

# Apollo.io API Key (required for company search)
APOLLO_API_KEY=your_apollo_api_key_here
```

## How to Get API Keys

### OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Add it to your environment variables

### Apollo.io API Key
1. Sign up at https://apollo.io
2. Go to Settings → API Keys
3. Generate a new API key
4. Add it to your environment variables

## How It Works

1. **AI Keyword Generation**: Uses GPT-4 to analyze your business idea and generate relevant search keywords
2. **Apollo API Search**: Searches Apollo's database using the generated keywords
3. **AI Review & Refinement**: AI reviews the results and may refine the search up to 3 times
4. **Clay Integration**: Final company list is automatically sent to your Clay webhook

## Usage

1. Go to any idea detail page (`/ideas/[id]`)
2. Click the "Build Company List" button in the top right
3. Wait for the AI to generate keywords, search companies, and send results to Clay
4. Check your Clay table for the imported company data

## Clay Webhook Data Structure

Each company record sent to Clay includes:
- `idea_id`: The ID of the business idea
- `company_id`: Apollo company ID
- `company_name`: Company name
- `website`: Company website
- `linkedin`: LinkedIn URL
- `industry`: Industry classification
- `employee_count`: Number of employees
- `phone`: Company phone number
- `founded_year`: Year founded
- `description`: Company description
- `location_city`, `location_state`, `location_country`: Location details
- `created_at`: Timestamp of when the record was created

## API Endpoint

- **POST** `/api/build-company-list`
- **Body**: `{ ideaId: string, ideaData: object }`
- **Response**: Status and results of the company search process

## Error Handling

The system includes comprehensive error handling for:
- Missing API keys
- Apollo API rate limits
- OpenAI API errors
- Clay webhook failures
- Invalid input data

All errors are logged and returned in the API response for debugging. 