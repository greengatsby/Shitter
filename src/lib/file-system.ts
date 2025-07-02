import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { githubAppService } from './github-app';
import { githubHelpers } from '../utils/supabase';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

// Simple in-memory lock to prevent concurrent clones of the same repo
const cloneLocks = new Map<string, Promise<any>>();

// Base directory for cloned repositories
// Use environment variable if set, otherwise use environment-specific defaults
const BASE_CLONE_PATH = process.env.CLONE_REPOS_PATH || 
  (process.env.NODE_ENV === 'production' 
    ? '/home/ismae/apps/editable-claude-projects'  // Production path for Ubuntu VPS
    : '/home/ismae/apps/editable-claude-projects');  // Development path relative to project root

// Get the STEER_PROJECTS_DIR_BASE for the new structure
const STEER_PROJECTS_DIR_BASE = process.env.STEER_PROJECTS_DIR_BASE || BASE_CLONE_PATH;

export interface CloneResult {
  success: boolean;
  repositoryPath: string;
  repositoryInfo?: {
    id: string;
    name: string;
    fullName: string;
    cloneUrl: string;
  };
  error?: string;
}

/**
 * Ensures the base directory exists, creates it if it doesn't
 */
async function ensureBaseDirectory(): Promise<void> {
  try {
    await fs.promises.access(BASE_CLONE_PATH);
  } catch {
    await fs.promises.mkdir(BASE_CLONE_PATH, { recursive: true });
    console.log(`✅ Created base directory: ${BASE_CLONE_PATH}`);
  }
}

/**
 * Ensures the STEER base directory exists, creates it if it doesn't
 */
async function ensureSteerBaseDirectory(): Promise<void> {
  try {
    await fs.promises.access(STEER_PROJECTS_DIR_BASE);
  } catch {
    await fs.promises.mkdir(STEER_PROJECTS_DIR_BASE, { recursive: true });
    console.log(`✅ Created STEER base directory: ${STEER_PROJECTS_DIR_BASE}`);
  }
}

/**
 * Ensures the organization directory exists, creates it if it doesn't
 */
async function ensureOrganizationDirectory(organizationId: string): Promise<string> {
  const orgPath = path.join(BASE_CLONE_PATH, organizationId);
  try {
    await fs.promises.access(orgPath);
  } catch {
    await fs.promises.mkdir(orgPath, { recursive: true });
    console.log(`✅ Created organization directory: ${orgPath}`);
  }
  return orgPath;
}

/**
 * Sanitizes a phone number to be safe for use as a directory name
 * Removes or replaces characters that might cause issues in file paths
 */
function sanitizePhoneNumber(phoneNumber: string): string {
  // Remove all non-alphanumeric characters and replace with underscores
  // Keep only digits, letters, and convert spaces/special chars to underscores
  return phoneNumber
    .replace(/[^\w\d]/g, '_')  // Replace non-word chars with underscore
    .replace(/_+/g, '_')       // Replace multiple underscores with single
    .replace(/^_|_$/g, '');    // Remove leading/trailing underscores
}

/**
 * Ensures the new structured directory exists: STEER_PROJECTS_DIR_BASE/orgId/memberPhoneNumber/repoName
 */
async function ensureStructuredDirectory(orgId: string, memberPhoneNumber: string, repoName: string): Promise<string> {
  await ensureSteerBaseDirectory();
  
  // Sanitize phone number for safe directory name
  const sanitizedPhone = sanitizePhoneNumber(memberPhoneNumber);
  const fullPath = path.join(STEER_PROJECTS_DIR_BASE, orgId, sanitizedPhone, repoName);
  
  try {
    await fs.promises.access(fullPath);
    console.log(`📁 Structured directory already exists: ${fullPath}`);
  } catch {
    await fs.promises.mkdir(fullPath, { recursive: true });
    console.log(`✅ Created structured directory: ${fullPath}`);
  }
  
  return fullPath;
}

/**
 * Masks sensitive tokens in URLs for safe logging
 */
function maskTokenInUrl(url: string): string {
  return url.replace(/x-access-token:[^@]+@/, 'x-access-token:[MASKED]@');
}

/**
 * Acquires a lock for a repository to prevent concurrent operations
 */
async function acquireRepositoryLock<T>(repositoryKey: string, operation: () => Promise<T>): Promise<T> {
  // Check if there's already an operation in progress for this repo
  if (cloneLocks.has(repositoryKey)) {
    console.log(`⏳ Waiting for existing operation on repository: ${repositoryKey}`);
    await cloneLocks.get(repositoryKey);
  }

  // Create a new promise for this operation
  const operationPromise = operation();
  cloneLocks.set(repositoryKey, operationPromise);

  try {
    const result = await operationPromise;
    return result;
  } finally {
    // Clean up the lock
    cloneLocks.delete(repositoryKey);
  }
}

/**
 * Gets an installation token for authenticating git operations
 */
async function getInstallationToken(installationId: number): Promise<string> {
  try {
    // Use the public method to get installation access token
    return await githubAppService.getInstallationAccessToken(installationId);
  } catch (error) {
    console.error(`❌ Error getting installation token for ${installationId}:`, error);
    throw new Error(`Failed to get installation token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Clones a repository using the new structured path: STEER_PROJECTS_DIR_BASE/orgId/memberPhoneNumber/repoName
 * @param repositoryId - The UUID of the repository in our database
 * @param orgId - Organization ID
 * @param memberPhoneNumber - Member phone number for the directory structure
 * @param branch - Optional branch to clone, defaults to repository's default branch
 * @param shallow - Whether to perform a shallow clone (faster, smaller), defaults to true
 */
export async function cloneRepositoryWithStructuredPath(
  repositoryId: string,
  orgId: string,
  memberPhoneNumber: string,
  branch?: string,
  shallow: boolean = true
): Promise<CloneResult> {
  // Use repository-specific lock to prevent concurrent operations
  const sanitizedPhone = sanitizePhoneNumber(memberPhoneNumber);
  const repositoryKey = `structured-repo-${repositoryId}-${orgId}-${sanitizedPhone}`;
  
  return acquireRepositoryLock(repositoryKey, async () => {
    try {
      console.log(`🚀 Starting structured clone process for repository ID: ${repositoryId}, org: ${orgId}, member phone: ${memberPhoneNumber}`);
      
      // Get repository data from database
      const { data: repoData, error: repoError } = await githubHelpers.getRepositoryFromDatabase(repositoryId);
      
      if (repoError || !repoData) {
        console.error(`❌ Repository not found:`, repoError);
        return {
          success: false,
          repositoryPath: '',
          error: `Repository not found: ${repoError?.message || 'Unknown error'}`
        };
      }

      console.log(`📋 Found repository: ${repoData.full_name}`);

      // Create the structured directory path
      const structuredPath = await ensureStructuredDirectory(orgId, memberPhoneNumber, repoData.name);
      
      const targetBranch = branch || repoData.default_branch || 'main';
      
      // Check if directory already exists and has git repo
      try {
        await fs.promises.access(path.join(structuredPath, '.git'));
        console.log(`📁 Git repository already exists at: ${structuredPath}`);
        
        // Refresh token and update remote URL before pulling
        console.log(`🔄 Refreshing token and pulling latest changes...`);
        const freshToken = await getInstallationToken(repoData.installation_id);
        const freshCloneUrl = repoData.clone_url.replace(
          'https://github.com/',
          `https://x-access-token:${freshToken}@github.com/`
        );
        
        // Update remote URL with fresh token (use execFileAsync for security)
        await execFileAsync('git', ['-C', structuredPath, 'remote', 'set-url', 'origin', freshCloneUrl]);
        
        // Pull latest changes
        await execFileAsync('git', ['-C', structuredPath, 'pull']);
        
        return {
          success: true,
          repositoryPath: structuredPath,
          repositoryInfo: {
            id: repoData.id,
            name: repoData.name,
            fullName: repoData.full_name,
            cloneUrl: repoData.clone_url
          }
        };
      } catch {
        // Repository doesn't exist or isn't a git repo, need to clone
        console.log(`📥 Repository not found at ${structuredPath}, proceeding with clone...`);
        
        // Check if directory exists but isn't a git repo
        try {
          const dirContents = await fs.promises.readdir(structuredPath);
          if (dirContents.length > 0) {
            console.log(`🗑️ Removing non-git directory content: ${structuredPath}`);
            await fs.promises.rm(structuredPath, { recursive: true, force: true });
            await ensureStructuredDirectory(orgId, memberPhoneNumber, repoData.name);
          }
        } catch {
          // Directory is empty or doesn't exist, which is fine
        }
      }

      // Get installation token for authentication
      const installationToken = await getInstallationToken(repoData.installation_id);
      
      // Create authenticated clone URL
      const cloneUrl = repoData.clone_url.replace(
        'https://github.com/',
        `https://x-access-token:${installationToken}@github.com/`
      );

      // Log with masked token for security
      console.log(`📥 Cloning repository from: ${maskTokenInUrl(cloneUrl)} to: ${structuredPath}`);
      
      // Prepare git clone arguments (use execFileAsync to avoid shell injection)
      const gitArgs = ['clone'];
      
      // Add branch specification
      gitArgs.push('--branch', targetBranch);
      
      // Add URLs - clone directly into the structured path
      gitArgs.push(cloneUrl, structuredPath);
      
      // Clone the repository using execFileAsync for security
      const { stdout, stderr } = await execFileAsync('git', gitArgs);
      
      if (stderr && !stderr.includes('Cloning into')) {
        console.error(`⚠️  Git clone stderr:`, stderr);
      }
      
      console.log(`✅ Repository cloned successfully to structured path`);

      return {
        success: true,
        repositoryPath: structuredPath,
        repositoryInfo: {
          id: repoData.id,
          name: repoData.name,
          fullName: repoData.full_name,
          cloneUrl: repoData.clone_url
        }
      };

    } catch (error) {
      console.error(`💥 Error cloning repository with structured path:`, error);
      return {
        success: false,
        repositoryPath: '',
        error: `Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  });
}

/**
 * Clones a repository by its database ID
 * @param repositoryId - The UUID of the repository in our database
 * @param targetPath - Optional custom path, defaults to BASE_CLONE_PATH/{repo-name}
 * @param branch - Optional branch to clone, defaults to repository's default branch
 * @param shallow - Whether to perform a shallow clone (faster, smaller), defaults to true
 */
export async function cloneRepository(
  repositoryId: string, 
  targetPath?: string,
  branch?: string,
  shallow: boolean = true
): Promise<CloneResult> {
  // Use repository-specific lock to prevent concurrent operations
  const repositoryKey = `repo-${repositoryId}`;
  
  return acquireRepositoryLock(repositoryKey, async () => {
    try {
      console.log(`🚀 Starting clone process for repository ID: ${repositoryId}`);
      
      // Get repository data from database
      const { data: repoData, error: repoError } = await githubHelpers.getRepositoryFromDatabase(repositoryId);
      
      if (repoError || !repoData) {
        console.error(`❌ Repository not found:`, repoError);
        return {
          success: false,
          repositoryPath: '',
          error: `Repository not found: ${repoError?.message || 'Unknown error'}`
        };
      }

      console.log(`📋 Found repository: ${repoData.full_name}`);

      // Ensure base directory exists
      await ensureBaseDirectory();

      // Determine target path with organization structure
      let finalPath: string;
      if (targetPath) {
        finalPath = targetPath;
      } else {
        // Get organization ID from installation data
        const organizationId = repoData.installation?.organization_id;
        if (organizationId) {
          // Create organization directory and use structured path: /orgId/repoName
          await ensureOrganizationDirectory(organizationId);
          finalPath = path.join(BASE_CLONE_PATH, organizationId, repoData.name);
          console.log(`📁 Using organization-based path: ${organizationId}/${repoData.name}`);
        } else {
          // Fallback to old behavior if no organization ID
          finalPath = path.join(BASE_CLONE_PATH, repoData.name);
          console.log(`⚠️  No organization ID found, using simple path: ${repoData.name}`);
        }
      }
      
      const targetBranch = branch || repoData.default_branch || 'main';
      
      // Check if directory already exists
      try {
        await fs.promises.access(finalPath);
        console.log(`⚠️  Directory already exists: ${finalPath}`);
        
        // Check if it's a git repository
        try {
          await fs.promises.access(path.join(finalPath, '.git'));
          console.log(`📁 Git repository already exists at: ${finalPath}`);
          
          // Refresh token and update remote URL before pulling
          console.log(`🔄 Refreshing token and pulling latest changes...`);
          const freshToken = await getInstallationToken(repoData.installation_id);
          const freshCloneUrl = repoData.clone_url.replace(
            'https://github.com/',
            `https://x-access-token:${freshToken}@github.com/`
          );
          
          // Update remote URL with fresh token (use execFileAsync for security)
          await execFileAsync('git', ['-C', finalPath, 'remote', 'set-url', 'origin', freshCloneUrl]);
          
          // Pull latest changes
          await execFileAsync('git', ['-C', finalPath, 'pull']);
          
          return {
            success: true,
            repositoryPath: finalPath,
            repositoryInfo: {
              id: repoData.id,
              name: repoData.name,
              fullName: repoData.full_name,
              cloneUrl: repoData.clone_url
            }
          };
        } catch {
          // Not a git repo, remove the directory
          console.log(`🗑️  Removing non-git directory: ${finalPath}`);
          await fs.promises.rm(finalPath, { recursive: true, force: true });
        }
      } catch {
        // Directory doesn't exist, which is fine
      }

      // Get installation token for authentication
      const installationToken = await getInstallationToken(repoData.installation_id);
      
      // Create authenticated clone URL
      const cloneUrl = repoData.clone_url.replace(
        'https://github.com/',
        `https://x-access-token:${installationToken}@github.com/`
      );

      // Log with masked token for security
      console.log(`📥 Cloning repository from: ${maskTokenInUrl(cloneUrl)} to: ${finalPath}`);
      
      // Prepare git clone arguments (use execFileAsync to avoid shell injection)
      const gitArgs = ['clone'];
      
      // Add shallow clone option for better performance
    //   if (shallow) {
    //     gitArgs.push('--depth', '1');
    //   }
      
      // Add branch specification
      gitArgs.push('--branch', targetBranch);
      
      // Add URLs
      gitArgs.push(cloneUrl, finalPath);
      
      // Clone the repository using execFileAsync for security
      const { stdout, stderr } = await execFileAsync('git', gitArgs);
      
      if (stderr && !stderr.includes('Cloning into')) {
        console.error(`⚠️  Git clone stderr:`, stderr);
      }
      
      console.log(`✅ Repository cloned successfully`);

      return {
        success: true,
        repositoryPath: finalPath,
        repositoryInfo: {
          id: repoData.id,
          name: repoData.name,
          fullName: repoData.full_name,
          cloneUrl: repoData.clone_url
        }
      };

    } catch (error) {
      console.error(`💥 Error cloning repository:`, error);
      return {
        success: false,
        repositoryPath: '',
        error: `Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  });
}

/**
 * Clones the first repository found for an organization
 * @param organizationId - The UUID of the organization
 * @param targetPath - Optional custom path, defaults to BASE_CLONE_PATH/{repo-name}
 * @param branch - Optional branch to clone, defaults to repository's default branch
 * @param shallow - Whether to perform a shallow clone (faster, smaller), defaults to true
 */
export async function cloneFirstRepositoryForOrganization(
  organizationId: string,
  targetPath?: string,
  branch?: string,
  shallow: boolean = true
): Promise<CloneResult> {
  try {
    console.log(`🔍 Looking for repositories in organization: ${organizationId}`);
    
    // Get repositories for the organization
    const { data: repositories, error: reposError } = await githubHelpers.getRepositoriesFromDatabase(organizationId);
    
    if (reposError) {
      console.error(`❌ Error fetching repositories:`, reposError);
      return {
        success: false,
        repositoryPath: '',
        error: `Failed to fetch repositories: ${reposError.message}`
      };
    }

    if (!repositories || repositories.length === 0) {
      console.log(`📭 No repositories found for organization: ${organizationId}`);
      return {
        success: false,
        repositoryPath: '',
        error: 'No repositories found for this organization'
      };
    }

    // Get the first repository
    const firstRepo = repositories[0];
    console.log(`🎯 Found ${repositories.length} repositories, selecting first: ${firstRepo.full_name}`);

    // Clone the first repository using the cloneRepository function with all security improvements
    return await cloneRepository(firstRepo.id, targetPath, branch, shallow);

  } catch (error) {
    console.error(`💥 Error cloning first repository for organization:`, error);
    return {
      success: false,
      repositoryPath: '',
      error: `Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Lists all cloned repositories in the base directory (organized by organization)
 * @returns Array of objects with organizationId and repositoryName
 */
export async function listClonedRepositories(): Promise<Array<{organizationId: string; repositoryName: string; fullPath: string}>> {
  try {
    await ensureBaseDirectory();
    const entries = await fs.promises.readdir(BASE_CLONE_PATH, { withFileTypes: true });
    
    const repositories = [];
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const orgPath = path.join(BASE_CLONE_PATH, entry.name);
        
        try {
          // Check if this directory contains git repos (organization directory)
          const orgEntries = await fs.promises.readdir(orgPath, { withFileTypes: true });
          
          for (const repoEntry of orgEntries) {
            if (repoEntry.isDirectory()) {
              const repoPath = path.join(orgPath, repoEntry.name);
              try {
                // Check if it's a git repository
                await fs.promises.access(path.join(repoPath, '.git'));
                repositories.push({
                  organizationId: entry.name,
                  repositoryName: repoEntry.name,
                  fullPath: repoPath
                });
              } catch {
                // Not a git repository, skip
              }
            }
          }
        } catch {
          // Could be a legacy repository in root directory (old structure)
          try {
            await fs.promises.access(path.join(orgPath, '.git'));
            repositories.push({
              organizationId: 'legacy',
              repositoryName: entry.name,
              fullPath: orgPath
            });
          } catch {
            // Not a git repository, skip
          }
        }
      }
    }
    
    return repositories;
  } catch (error) {
    console.error(`Error listing cloned repositories:`, error);
    return [];
  }
}

/**
 * Removes a cloned repository from the file system
 * @param repositoryName - Name of the repository to remove
 * @param organizationId - Optional organization ID. If not provided, searches all organizations
 */
export async function removeClonedRepository(repositoryName: string, organizationId?: string): Promise<boolean> {
  try {
    let repositoryPath: string;
    
    if (organizationId) {
      // Direct path with organization ID
      repositoryPath = path.join(BASE_CLONE_PATH, organizationId, repositoryName);
    } else {
      // Search through all organizations for the repository
      const repositories = await listClonedRepositories();
      const foundRepo = repositories.find(repo => repo.repositoryName === repositoryName);
      
      if (!foundRepo) {
        console.log(`Repository not found: ${repositoryName}`);
        return false;
      }
      
      repositoryPath = foundRepo.fullPath;
      console.log(`📍 Found repository in organization: ${foundRepo.organizationId}`);
    }
    
    // Check if directory exists
    try {
      await fs.promises.access(repositoryPath);
    } catch {
      console.log(`Repository directory not found: ${repositoryPath}`);
      return false;
    }

    // Remove the directory
    await fs.promises.rm(repositoryPath, { recursive: true, force: true });
    console.log(`✅ Removed repository: ${repositoryPath}`);
    
    return true;
  } catch (error) {
    console.error(`Error removing repository:`, error);
    return false;
  }
}

/**
 * Gets the absolute path for a repository
 * @param repositoryName - Name of the repository
 * @param organizationId - Optional organization ID. If not provided, searches all organizations
 */
export async function getRepositoryPath(repositoryName: string, organizationId?: string): Promise<string | null> {
  if (organizationId) {
    // Direct path with organization ID
    return path.join(BASE_CLONE_PATH, organizationId, repositoryName);
  } else {
    // Search through all organizations for the repository
    const repositories = await listClonedRepositories();
    const foundRepo = repositories.find(repo => repo.repositoryName === repositoryName);
    return foundRepo ? foundRepo.fullPath : null;
  }
}

/**
 * Checks if a repository is already cloned
 * @param repositoryName - Name of the repository
 * @param organizationId - Optional organization ID. If not provided, searches all organizations
 */
export async function isRepositoryCloned(repositoryName: string, organizationId?: string): Promise<boolean> {
  try {
    const repositoryPath = await getRepositoryPath(repositoryName, organizationId);
    if (!repositoryPath) return false;
    
    await fs.promises.access(path.join(repositoryPath, '.git'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Cleans up old repositories that haven't been accessed in the specified number of days
 * @param daysOld - Number of days since last access to consider a repo "old"
 * @returns Array of repository identifiers that were cleaned up (format: "orgId/repoName")
 */
export async function cleanupOldRepositories(daysOld: number = 7): Promise<string[]> {
  try {
    await ensureBaseDirectory();
    const repositories = await listClonedRepositories();
    const cleanedRepos: string[] = [];
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

    for (const repo of repositories) {
      try {
        // Check last access time
        const stats = await fs.promises.stat(repo.fullPath);
        if (stats.atime.getTime() < cutoffTime) {
          const repoIdentifier = `${repo.organizationId}/${repo.repositoryName}`;
          console.log(`🗑️  Cleaning up old repository: ${repoIdentifier} (last accessed: ${stats.atime.toISOString()})`);
          
          await fs.promises.rm(repo.fullPath, { recursive: true, force: true });
          cleanedRepos.push(repoIdentifier);
          
          // Check if organization directory is now empty and remove it
          const orgPath = path.join(BASE_CLONE_PATH, repo.organizationId);
          try {
            const orgEntries = await fs.promises.readdir(orgPath);
            if (orgEntries.length === 0 && repo.organizationId !== 'legacy') {
              console.log(`🗑️  Removing empty organization directory: ${repo.organizationId}`);
              await fs.promises.rmdir(orgPath);
            }
          } catch {
            // Organization directory might have other repos, skip
          }
        }
      } catch (error) {
        console.error(`Error checking repository ${repo.organizationId}/${repo.repositoryName}:`, error);
      }
    }

    console.log(`✅ Cleaned up ${cleanedRepos.length} old repositories`);
    return cleanedRepos;
  } catch (error) {
    console.error(`Error cleaning up old repositories:`, error);
    return [];
  }
}
