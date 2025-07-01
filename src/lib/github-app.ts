import { createHmac, timingSafeEqual } from 'crypto';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

// GitHub App configuration
const GITHUB_APP_ID = process.env.GH_APP_ID!;
const GITHUB_APP_PRIVATE_KEY = process.env.GH_APP_PK!;
const GITHUB_APP_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID!;
const GITHUB_APP_CLIENT_SECRET = process.env.GH_APP_CLIENT_SECRET!;
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

export interface GitHubInstallation {
  id: number;
  account: {
    id: number;
    login: string;
    type: 'User' | 'Organization';
    avatar_url: string;
  };
  app_id: number;
  app_slug: string;
  target_id: number;
  target_type: 'User' | 'Organization';
  permissions: Record<string, string>;
  events: string[];
  repository_selection: 'all' | 'selected';
  access_tokens_url: string;
  repositories_url: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  suspended_at?: string;
  suspended_by?: any;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  language: string | null;
  default_branch: string;
  clone_url: string;
  ssh_url: string;
  size: number;
  archived: boolean;
  disabled: boolean;
  pushed_at: string;
  permissions?: {
    admin: boolean;
    maintain?: boolean;
    push: boolean;
    triage?: boolean;
    pull: boolean;
  };
}

export interface InstallationToken {
  token: string;
  expires_at: string;
  permissions: Record<string, string>;
  repository_selection: 'all' | 'selected';
  repositories?: GitHubRepository[];
}

class GitHubAppService {
  private octokitCache = new Map<number, { octokit: Octokit; expires_at: Date }>();

  /**
   * Create authenticated Octokit instance for app-level operations
   */
  private async createAppOctokit(): Promise<Octokit> {
    if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY) {
      throw new Error('GitHub App ID and Private Key must be configured');
    }

    const auth = createAppAuth({
      appId: parseInt(GITHUB_APP_ID),
      privateKey: GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });

    return new Octokit({ auth });
  }

  /**
   * Create authenticated Octokit instance for installation operations (cached)
   */
  private async createInstallationOctokit(installationId: number): Promise<Octokit> {
    // Check cache first
    const cached = this.octokitCache.get(installationId);
    if (cached && cached.expires_at > new Date()) {
      return cached.octokit;
    }

    if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY) {
      throw new Error('GitHub App ID and Private Key must be configured');
    }

    const auth = createAppAuth({
      appId: parseInt(GITHUB_APP_ID),
      privateKey: GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });

    const installationAuth = await auth({
      type: 'installation',
      installationId: installationId,
    });

    const octokit = new Octokit({ auth: installationAuth.token });

    // Cache the Octokit instance (expire after 50 minutes for safety - tokens last 1 hour)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 50);
    
    this.octokitCache.set(installationId, {
      octokit,
      expires_at: expiresAt,
    });

    return octokit;
  }

  // ===========================================
  // GITHUB API OPERATIONS (Fetch from GitHub)
  // ===========================================

  /**
   * Fetch all app installations from GitHub API
   */
  async fetchInstallationsFromGitHub(): Promise<GitHubInstallation[]> {
    try {
      const octokit = await this.createAppOctokit();
      
      const installations = await octokit.paginate(
        octokit.rest.apps.listInstallations,
        { per_page: 100 }
      );

      return installations as GitHubInstallation[];
    } catch (error) {
      console.error('Error fetching installations from GitHub:', error);
      throw new Error(`Failed to fetch installations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch specific installation from GitHub API
   */
  async fetchInstallationFromGitHub(installationId: number): Promise<GitHubInstallation> {
    try {
      const octokit = await this.createAppOctokit();
      
      const { data: installation } = await octokit.rest.apps.getInstallation({
        installation_id: installationId,
      });

      return installation as GitHubInstallation;
    } catch (error) {
      console.error(`Error fetching installation ${installationId} from GitHub:`, error);
      throw new Error(`Failed to fetch installation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch repositories accessible to installation from GitHub API
   */
  async fetchRepositoriesFromGitHub(installationId: number): Promise<GitHubRepository[]> {
    try {
      const octokit = await this.createInstallationOctokit(installationId);

      // Get all repositories with pagination
      const repositories = await octokit.paginate(
        octokit.rest.apps.listReposAccessibleToInstallation,
        { per_page: 100 }
      );

      console.log(`✅ Fetched ${repositories.length} repositories from GitHub for installation ${installationId}`);
      
      // Map to our interface format
      return repositories.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        html_url: repo.html_url,
        description: repo.description,
        language: repo.language,
        default_branch: repo.default_branch || 'main',
        clone_url: repo.clone_url,
        ssh_url: repo.ssh_url,
        size: repo.size,
        archived: repo.archived || false,
        disabled: repo.disabled || false,
        pushed_at: repo.pushed_at || new Date().toISOString(),
        permissions: repo.permissions
      }));
    } catch (error) {
      console.error(`❌ Error fetching repositories from GitHub for installation ${installationId}:`, error);
      throw new Error(`Failed to fetch repositories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch specific repository from GitHub API
   */
  async fetchRepositoryFromGitHub(installationId: number, owner: string, repo: string): Promise<GitHubRepository> {
    try {
      const octokit = await this.createInstallationOctokit(installationId);
      
      const { data: repository } = await octokit.rest.repos.get({
        owner,
        repo,
      });

      return {
        id: repository.id,
        name: repository.name,
        full_name: repository.full_name,
        private: repository.private,
        html_url: repository.html_url,
        description: repository.description,
        language: repository.language,
        default_branch: repository.default_branch || 'main',
        clone_url: repository.clone_url,
        ssh_url: repository.ssh_url,
        size: repository.size,
        archived: repository.archived || false,
        disabled: repository.disabled || false,
        pushed_at: repository.pushed_at || new Date().toISOString(),
        permissions: repository.permissions
      };
    } catch (error) {
      console.error(`Error fetching repository ${owner}/${repo} from GitHub:`, error);
      throw new Error(`Failed to fetch repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search repositories from GitHub API
   */
  async searchRepositoriesInGitHub(
    installationId: number,
    query: string,
    sort: string = 'updated',
    order: 'asc' | 'desc' = 'desc'
  ): Promise<{ repositories: GitHubRepository[]; total_count: number }> {
    try {
      const octokit = await this.createInstallationOctokit(installationId);
      
      const { data } = await octokit.rest.search.repos({
        q: query,
        sort: sort as any,
        order,
        per_page: 100,
      });

      return {
        repositories: data.items.map(repo => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          private: repo.private,
          html_url: repo.html_url,
          description: repo.description,
          language: repo.language,
          default_branch: repo.default_branch || 'main',
          clone_url: repo.clone_url,
          ssh_url: repo.ssh_url,
          size: repo.size,
          archived: repo.archived || false,
          disabled: repo.disabled || false,
          pushed_at: repo.pushed_at || new Date().toISOString(),
        })),
        total_count: data.total_count,
      };
    } catch (error) {
      console.error(`Error searching repositories in GitHub:`, error);
      throw new Error(`Failed to search repositories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ===========================================
  // GITHUB REPOSITORY OPERATIONS
  // ===========================================

  /**
   * Create a new branch in GitHub
   */
  async createBranchInGitHub(
    installationId: number,
    owner: string,
    repo: string,
    branchName: string,
    baseSha: string
  ): Promise<void> {
    try {
      const octokit = await this.createInstallationOctokit(installationId);
      
      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      });
    } catch (error) {
      console.error(`Error creating branch ${branchName} in ${owner}/${repo}:`, error);
      throw new Error(`Failed to create branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get file content from GitHub
   */
  async getFileContentFromGitHub(
    installationId: number,
    owner: string,
    repo: string,
    path: string,
    branch: string = 'main'
  ): Promise<{ content: string; sha: string; encoding: string }> {
    try {
      const octokit = await this.createInstallationOctokit(installationId);
      
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });

      if (Array.isArray(data) || data.type !== 'file') {
        throw new Error('Path does not point to a file');
      }

      return {
        content: data.content,
        sha: data.sha,
        encoding: data.encoding as string,
      };
    } catch (error) {
      console.error(`Error getting file content from GitHub ${owner}/${repo}/${path}:`, error);
      throw new Error(`Failed to get file content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update file content in GitHub
   */
  async updateFileContentInGitHub(
    installationId: number,
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha: string,
    branch: string = 'main'
  ): Promise<any> {
    try {
      const octokit = await this.createInstallationOctokit(installationId);
      
      const encodedContent = Buffer.from(content).toString('base64');
      
      const { data } = await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: encodedContent,
        sha,
        branch,
      });

      return data;
    } catch (error) {
      console.error(`Error updating file content in GitHub ${owner}/${repo}/${path}:`, error);
      throw new Error(`Failed to update file content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create pull request in GitHub
   */
  async createPullRequestInGitHub(
    installationId: number,
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string = 'main'
  ): Promise<any> {
    try {
      const octokit = await this.createInstallationOctokit(installationId);
      
      const { data } = await octokit.rest.pulls.create({
        owner,
        repo,
        title,
        body,
        head,
        base,
      });

      return data;
    } catch (error) {
      console.error(`Error creating pull request in GitHub ${owner}/${repo}:`, error);
      throw new Error(`Failed to create pull request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get repository tree from GitHub
   */
  async getRepositoryTreeFromGitHub(
    installationId: number,
    owner: string,
    repo: string,
    sha: string = 'HEAD',
    recursive: boolean = false
  ): Promise<any> {
    try {
      const octokit = await this.createInstallationOctokit(installationId);
      
      const { data } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: sha,
        recursive: recursive ? 'true' : undefined,
      });

      return data;
    } catch (error) {
      console.error(`Error getting repository tree from GitHub ${owner}/${repo}:`, error);
      throw new Error(`Failed to get repository tree: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ===========================================
  // UTILITY FUNCTIONS
  // ===========================================

  /**
   * Get installation access token for file system operations
   */
  async getInstallationAccessToken(installationId: number): Promise<string> {
    try {
      if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY) {
        throw new Error('GitHub App ID and Private Key must be configured');
      }

      const auth = createAppAuth({
        appId: parseInt(GITHUB_APP_ID),
        privateKey: GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });

      const installationAuth = await auth({
        type: 'installation',
        installationId: installationId,
      });

      return installationAuth.token;
    } catch (error) {
      console.error(`❌ Error getting installation access token for ${installationId}:`, error);
      throw new Error(`Failed to get installation access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!GITHUB_WEBHOOK_SECRET) {
      throw new Error('GitHub webhook secret not configured');
    }

    const expectedSignature = `sha256=${createHmac('sha256', GITHUB_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex')}`;

    try {
      return timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSignature, 'utf8')
      );
    } catch {
      return false;
    }
  }

  /**
   * Generate installation URL for organizations
   */
  generateInstallationURL(organizationId?: string): string {
    const baseUrl = `https://github.com/apps/${process.env.GH_APP_SLUG || 'org-flow'}/installations/new`;
    const params = new URLSearchParams();
    
    if (organizationId) {
      // Include organization ID and timestamp in state parameter
      const state = `org_${organizationId}_${Date.now()}`;
      params.append('state', state);
    }
    
    return `${baseUrl}?${params.toString()}`;
  }

  // ===========================================
  // DEPRECATED - Use specific methods above
  // ===========================================

  /** @deprecated Use fetchRepositoriesFromGitHub instead */
  async getInstallationRepositories(installationId: number): Promise<GitHubRepository[]> {
    console.warn('⚠️  getInstallationRepositories is deprecated. Use fetchRepositoriesFromGitHub instead.');
    return this.fetchRepositoriesFromGitHub(installationId);
  }

  /** @deprecated Use fetchRepositoryFromGitHub instead */
  async getRepository(installationId: number, owner: string, repo: string): Promise<GitHubRepository> {
    console.warn('⚠️  getRepository is deprecated. Use fetchRepositoryFromGitHub instead.');
    return this.fetchRepositoryFromGitHub(installationId, owner, repo);
  }

  /** @deprecated Use createBranchInGitHub instead */
  async createBranch(installationId: number, owner: string, repo: string, branchName: string, baseSha: string): Promise<void> {
    console.warn('⚠️  createBranch is deprecated. Use createBranchInGitHub instead.');
    return this.createBranchInGitHub(installationId, owner, repo, branchName, baseSha);
  }

  /** @deprecated Use getFileContentFromGitHub instead */
  async getFileContent(installationId: number, owner: string, repo: string, path: string, branch: string = 'main'): Promise<{ content: string; sha: string; encoding: string }> {
    console.warn('⚠️  getFileContent is deprecated. Use getFileContentFromGitHub instead.');
    return this.getFileContentFromGitHub(installationId, owner, repo, path, branch);
  }

  /** @deprecated Use updateFileContentInGitHub instead */
  async updateFileContent(installationId: number, owner: string, repo: string, path: string, content: string, message: string, sha: string, branch: string = 'main'): Promise<any> {
    console.warn('⚠️  updateFileContent is deprecated. Use updateFileContentInGitHub instead.');
    return this.updateFileContentInGitHub(installationId, owner, repo, path, content, message, sha, branch);
  }

  /** @deprecated Use createPullRequestInGitHub instead */
  async createPullRequest(installationId: number, owner: string, repo: string, title: string, body: string, head: string, base: string = 'main'): Promise<any> {
    console.warn('⚠️  createPullRequest is deprecated. Use createPullRequestInGitHub instead.');
    return this.createPullRequestInGitHub(installationId, owner, repo, title, body, head, base);
  }

  /** @deprecated Use getRepositoryTreeFromGitHub instead */
  async getRepositoryTree(installationId: number, owner: string, repo: string, sha: string = 'HEAD', recursive: boolean = false): Promise<any> {
    console.warn('⚠️  getRepositoryTree is deprecated. Use getRepositoryTreeFromGitHub instead.');
    return this.getRepositoryTreeFromGitHub(installationId, owner, repo, sha, recursive);
  }

  /** @deprecated Use searchRepositoriesInGitHub instead */
  async searchRepositories(installationId: number, query: string, sort: string = 'updated', order: 'asc' | 'desc' = 'desc'): Promise<{ repositories: GitHubRepository[]; total_count: number }> {
    console.warn('⚠️  searchRepositories is deprecated. Use searchRepositoriesInGitHub instead.');
    return this.searchRepositoriesInGitHub(installationId, query, sort, order);
  }
}

export function isGitHubAppConfigured(): boolean {
  return !!(GITHUB_APP_ID && GITHUB_APP_PRIVATE_KEY && GITHUB_APP_CLIENT_ID && GITHUB_APP_CLIENT_SECRET);
}

export function getGitHubAppConfig() {
  return {
    appId: GITHUB_APP_ID,
    clientId: GITHUB_APP_CLIENT_ID,
    configured: isGitHubAppConfigured(),
  };
}

// Export singleton instance
export const githubAppService = new GitHubAppService(); 