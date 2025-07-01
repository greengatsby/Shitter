# GitHub App Integration Setup Guide

This guide explains how to set up the GitHub App integration for OrgFlow, which enables secure repository access and automated code changes.

## Overview

The GitHub App integration provides:
- Secure, installation-based authentication
- Granular repository permissions
- Webhook event handling
- Automated code modification capabilities
- Better security than OAuth tokens

## Prerequisites

1. A GitHub account with admin access to the repositories you want to integrate
2. A Supabase database with the required schema
3. Access to your application's environment variables

## 1. GitHub App Configuration

You already have a GitHub App created with these details:
```
App ID: 1492252
App Slug: org-flow
Client ID: [Your GitHub App Client ID]
Client Secret: 55709cb8e33628fff2c14ce399ba5c27c6532998
```

### Required Environment Variables

Add these to your `.env` or environment configuration:

```bash
# GitHub App Configuration
GH_APP_ID=1492252
GH_APP_SLUG=org-flow
GH_APP_PK="-----BEGIN RSA PRIVATE KEY-----
[Your Private Key from github-info.md]
-----END RSA PRIVATE KEY-----"
GH_APP_CLIENT_SECRET=55709cb8e33628fff2c14ce399ba5c27c6532998

# GitHub OAuth (Legacy - for backward compatibility)
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here

# GitHub Webhook Secret (generate a random string)
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# Your application URL
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

## 2. Database Setup

Run the following SQL scripts in your Supabase database:

### Step 1: Apply the enhanced schema
```sql
-- Run the contents of database/github_app_schema.sql
-- This adds new tables and columns for GitHub App support
```

### Step 2: Verify tables exist
After running the schema, you should have these tables:
- `github_app_installations`
- `github_webhook_deliveries`
- Enhanced `github_integrations` table
- Enhanced `github_repositories` table

## 3. GitHub App Configuration

### Update GitHub App Settings

1. Go to your GitHub App settings: https://github.com/settings/apps/org-flow
2. Update the following URLs:

**Homepage URL:**
```
https://your-domain.com
```

**User authorization callback URL:**
```
https://your-domain.com/api/github/callback
```

**Setup URL (optional):**
```
https://your-domain.com/dashboard
```

**Webhook URL:**
```
https://your-domain.com/api/github/webhook
```

**Webhook Secret:**
Use the same value as your `GITHUB_WEBHOOK_SECRET` environment variable.

### Required Permissions

Ensure your GitHub App has these permissions:

**Repository permissions:**
- Contents: Read & Write
- Issues: Read & Write
- Metadata: Read
- Pull requests: Read & Write
- Commit statuses: Read & Write

**Organization permissions (optional):**
- Members: Read
- Administration: Read

**Account permissions:**
- Email addresses: Read

### Webhook Events

Subscribe to these events:
- Installation
- Installation repositories
- Repository
- Push
- Pull request
- Issues

## 4. Application Deployment

### Production Deployment

1. **Set Environment Variables:**
   Ensure all environment variables are set in your production environment.

2. **Database Migration:**
   Run the GitHub App schema migration:
   ```bash
   # Apply the schema updates
   psql -h your-db-host -U your-user -d your-db -f database/github_app_schema.sql
   ```

3. **Test Webhook Endpoint:**
   Verify your webhook endpoint is accessible:
   ```bash
   curl https://your-domain.com/api/github/webhook
   ```

4. **Deploy Application:**
   Deploy your Next.js application with the updated code.

## 5. Testing the Integration

### Test Installation Flow

1. **Navigate to Dashboard:**
   Go to your application's dashboard at `/dashboard`

2. **Install GitHub App:**
   Click "Install GitHub App" button

3. **Complete Installation:**
   - You'll be redirected to GitHub
   - Select repositories to install on
   - Complete the installation process

4. **Verify Installation:**
   - Return to your dashboard
   - The GitHub App should appear as "Connected"
   - Repositories should be synced automatically

### Test Webhook Events

1. **Create a Test Repository:**
   Create a new repository or make changes to an existing one

2. **Check Webhook Logs:**
   Monitor your application logs for webhook events

3. **Verify Database:**
   Check the `github_webhook_deliveries` table for logged events

## 6. Using the GitHub App

### Repository Access

Once installed, the GitHub App can:
- Read repository contents
- Create and modify files
- Create branches and pull requests
- Access repository metadata

### API Usage Examples

```typescript
import { githubAppService } from '@/lib/github-app'

// Get installation repositories
const repos = await githubAppService.getInstallationRepositories(installationId)

// Get file content
const file = await githubAppService.getFileContent(
  installationId,
  'owner',
  'repo',
  'path/to/file.txt'
)

// Update file content
await githubAppService.updateFileContent(
  installationId,
  'owner',
  'repo',
  'path/to/file.txt',
  'new content',
  'Update message',
  file.sha
)

// Create pull request
await githubAppService.createPullRequest(
  installationId,
  'owner',
  'repo',
  'Update feature',
  'Description of changes',
  'feature-branch'
)
```

## 7. Team Management

### Repository Assignments

You can assign team members to specific repositories:

```typescript
import { githubHelpers } from '@/utils/supabase'

// Assign user to repository
await githubHelpers.assignUserToRepository(
  repositoryId,
  userId,
  assignedBy,
  'developer' // or 'reviewer', 'admin'
)

// Get repository assignments
const assignments = await githubHelpers.getRepositoryAssignments(repositoryId)
```

### Phone Integration

Users can be invited by phone number and associated with repositories:

```typescript
// Invite user by phone
await orgHelpers.inviteUserByPhone(
  organizationId,
  '+1234567890',
  'member'
)

// Associate with repositories after they join
await githubHelpers.assignUserToRepository(repositoryId, userId, adminId)
```

## 8. Troubleshooting

### Common Issues

**Installation not detected:**
- Check webhook URL is accessible
- Verify webhook secret matches
- Check application logs for errors

**Repository sync fails:**
- Verify installation has repository access
- Check GitHub App permissions
- Review API rate limits

**Webhook events not processed:**
- Verify webhook signature verification
- Check webhook secret configuration
- Review webhook delivery logs in GitHub

**Database errors:**
- Ensure schema migrations are applied
- Check database connection
- Verify RLS policies are set up correctly

### Debug Commands

```bash
# Test webhook endpoint
curl -X GET https://your-domain.com/api/github/webhook

# Check installation URL generation
curl https://your-domain.com/api/github/install?organization_id=your-org-id

# Test GitHub App JWT generation (server-side only)
node -e "
const { githubAppService } = require('./src/lib/github-app');
console.log(githubAppService.generateJWT());
"
```

### Monitoring

Monitor these metrics:
- Webhook delivery success rate
- Installation token refresh frequency
- API rate limit usage
- Repository sync success rate

## 9. Security Considerations

### Token Management
- Installation tokens are automatically refreshed
- Tokens are cached safely in memory
- Database tokens should be encrypted in production

### Webhook Security
- All webhooks are signature-verified
- Invalid signatures are rejected
- Webhook events are logged for audit

### Access Control
- Row Level Security (RLS) policies control data access
- Users can only see their organization's data
- Repository assignments control individual access

### Best Practices
- Regularly rotate webhook secrets
- Monitor failed webhook deliveries
- Use minimal required permissions
- Implement proper error handling

## 10. Advanced Features

### Automated Code Changes

The GitHub App enables automated code modifications based on:
- SMS requests from clients
- Web form submissions
- API calls from external systems

Example workflow:
1. Client sends SMS: "Change button color to blue"
2. SMS webhook processes request
3. AI analyzes request and identifies changes
4. GitHub App creates branch and modifies code
5. Pull request created for review
6. Changes deployed after approval

### Multi-Repository Management

Manage multiple repositories across different organizations:
- Install on multiple GitHub organizations
- Sync repositories per installation
- Assign team members to specific repositories
- Track changes across all repositories

### Webhook Event Processing

Process GitHub events for automation:
- New repository creation
- Code pushes trigger builds
- Pull request automation
- Issue tracking integration

This completes the GitHub App setup guide. The integration provides a secure, scalable foundation for automated code management and team collaboration. 