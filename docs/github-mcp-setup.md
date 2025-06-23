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
   - `read:org` - Read org and team membership
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