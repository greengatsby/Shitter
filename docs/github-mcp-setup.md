# GitHub MCP Server Setup

The GitHub MCP (Model Context Protocol) server has been added to this project, providing GitHub integration capabilities.

## Setup Instructions

### 1. Get a GitHub Personal Access Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a descriptive name (e.g., "Claude Code MCP Server")
4. Select appropriate scopes based on your needs:
   - `repo` - Full control of private repositories
   - `public_repo` - Access to public repositories
   - `read:org` - Read org and clientship
   - `read:user` - Read user profile data
   - `user:email` - Access user email addresses

### 2. Add Token to Environment

Add your GitHub token to `.env.local`:

```bash
GITHUB_PERSONAL_ACCESS_TOKEN=your_token_here
```

### 3. Available Capabilities

Once configured, the GitHub MCP server provides these tools:

#### Repository Operations
- `github_list_repos` - List repositories for a user/organization
- `github_get_repo` - Get repository details
- `github_create_repo` - Create a new repository
- `github_fork_repo` - Fork a repository

#### File Operations
- `github_get_file` - Get file contents from a repository
- `github_create_file` - Create a new file in a repository
- `github_update_file` - Update an existing file
- `github_delete_file` - Delete a file from a repository

#### Branch Operations
- `github_list_branches` - List repository branches
- `github_create_branch` - Create a new branch
- `github_get_branch` - Get branch details

#### Issue Management
- `github_list_issues` - List repository issues
- `github_get_issue` - Get issue details
- `github_create_issue` - Create a new issue
- `github_update_issue` - Update an existing issue

#### Pull Request Management
- `github_list_prs` - List pull requests
- `github_get_pr` - Get pull request details
- `github_create_pr` - Create a new pull request
- `github_update_pr` - Update a pull request

#### Search Operations
- `github_search_repos` - Search for repositories
- `github_search_issues` - Search for issues
- `github_search_code` - Search code in repositories

### 4. Usage Examples

Once configured, you can use these capabilities in Claude Code:

```javascript
// Example: List repositories for a user
const repos = await github_list_repos({
  owner: "username",
  type: "all"
});

// Example: Get file contents
const file = await github_get_file({
  owner: "username",
  repo: "repository",
  path: "src/index.js"
});

// Example: Create a new issue
const issue = await github_create_issue({
  owner: "username",
  repo: "repository",
  title: "Bug report",
  body: "Description of the bug"
});
```

### 5. Configuration File

The MCP server is configured in `.claude-code.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    }
  }
}
```

### 6. Testing the Setup

To test if the GitHub MCP server is working:

1. Ensure your GitHub token is set in `.env.local`
2. Restart Claude Code
3. Try listing your repositories or getting file contents

### 7. Troubleshooting

**Token Issues:**
- Ensure the token has the correct scopes
- Check that the token isn't expired
- Verify the token is properly set in the environment

**MCP Server Issues:**
- Check that the package is installed: `npm list @modelcontextprotocol/server-github`
- Verify the configuration in `.claude-code.json`
- Check Claude Code logs for MCP server startup messages

**Permission Issues:**
- Ensure your token has access to the repositories you're trying to access
- Check if repositories are private and token has appropriate permissions

### 8. Security Notes

- Keep your GitHub token secure and never commit it to version control
- Use the minimum required scopes for your token
- Consider using GitHub Apps for production deployments
- Regularly rotate your tokens for better security

## Available Resources

The GitHub MCP server also provides these resources:
- Repository information
- File contents and directory listings
- Issue and pull request data
- Commit history and branch information

These resources can be accessed through the MCP protocol and used by Claude Code for various GitHub operations.

# GitHub Integration Setup

The GitHub integration has been implemented with full OAuth support, allowing organizations to connect their GitHub accounts and sync repositories.

## Setup Instructions

### 1. Create a GitHub OAuth App

1. Go to [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/applications/new)
2. Click "New OAuth App"
3. Fill in the application details:
   - **Application name**: Your application name (e.g., "Shitter - Team Management")
   - **Homepage URL**: Your application URL (e.g., `http://localhost:3000` for development)
   - **Application description**: Optional description
   - **Authorization callback URL**: `http://localhost:3000/api/github/callback` (replace with your domain for production)

4. Click "Register application"
5. Copy the **Client ID** and generate a **Client Secret**

### 2. Add Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# GitHub OAuth Configuration
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
```

**Important Notes:**
- The `NEXT_PUBLIC_GITHUB_CLIENT_ID` is exposed to the client side for OAuth initiation
- The `GITHUB_CLIENT_SECRET` is kept server-side only for security
- For production, update the callback URL to match your production domain

### 3. Database Schema

The integration uses the following database tables (already included in your schema):

- `github_integrations` - Stores GitHub OAuth data per organization
- `github_repositories` - Stores synced repository information
- `user_repository_assignments` - Manages user access to repositories

### 4. How the Integration Works

#### OAuth Flow:
1. User clicks "Connect GitHub" in the dashboard
2. A popup opens with GitHub's OAuth authorization page
3. User authorizes the application on GitHub
4. GitHub redirects to `/api/github/callback` with an authorization code
5. The callback page communicates back to the parent window
6. The authorization code is exchanged for an access token
7. User info and repositories are fetched and stored

#### Features:
- **Connect GitHub Account**: OAuth integration with popup flow
- **Sync Repositories**: Fetch and update repository list from GitHub
- **Disconnect Integration**: Deactivate the GitHub integration
- **Repository Management**: View synced repositories with links to GitHub
- **Team Access**: Manage which clients have access to which repositories

### 5. API Endpoints

The following API endpoints are available:

#### GitHub OAuth
- `GET /api/github/oauth?organization_id={id}` - Get integrations and repositories
- `POST /api/github/oauth` - Handle OAuth callback and save integration
- `DELETE /api/github/oauth/{integration_id}` - Disconnect integration

#### Repository Management
- `POST /api/github/sync-repositories` - Sync repositories from GitHub
- `POST /api/github/repositories/{id}/assignments` - Assign user to repository
- `GET /api/github/repositories/{id}/assignments` - Get repository assignments

#### OAuth Callback
- `GET /api/github/callback` - OAuth callback endpoint (handles popup communication)

### 6. Permissions and Scopes

The integration requests the following GitHub scopes:
- `repo` - Access to private and public repositories
- `read:org` - Read organization membership
- `read:user` - Read user profile information
- `user:email` - Access to user email addresses

### 7. Security Considerations

- Access tokens are stored encrypted in the database
- OAuth state parameter includes organization ID for validation
- Popup-based OAuth flow prevents redirect hijacking
- Server-side token exchange keeps client secret secure
- Row Level Security (RLS) policies control data access

### 8. Development vs Production

**Development:**
- Callback URL: `http://localhost:3000/api/github/callback`
- Site URL: `http://localhost:3000`

**Production:**
- Update callback URL in GitHub OAuth app settings
- Update `NEXT_PUBLIC_SITE_URL` environment variable
- Ensure HTTPS is enabled for OAuth security

### 9. Troubleshooting

**Common Issues:**
- **"GitHub integration not properly configured"**: Check that `NEXT_PUBLIC_GITHUB_CLIENT_ID` is set
- **"Popup blocked"**: User needs to allow popups for the domain
- **"OAuth state mismatch"**: Clear browser cache and try again
- **"Failed to exchange code"**: Check that `GITHUB_CLIENT_SECRET` is correct
- **"Repository sync failed"**: GitHub token may have expired or insufficient permissions

**Debug Steps:**
1. Check browser console for JavaScript errors
2. Verify environment variables are loaded
3. Test OAuth app settings in GitHub
4. Check API endpoint responses in Network tab