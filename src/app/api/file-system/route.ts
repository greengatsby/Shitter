import { NextRequest, NextResponse } from 'next/server';
import { 
  cloneRepository, 
  cloneFirstRepositoryForOrganization, 
  listClonedRepositories,
  removeClonedRepository,
  isRepositoryCloned,
  getRepositoryPath,
  cleanupOldRepositories
} from '../../../lib/file-system';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, repositoryId, organizationId, targetPath, repositoryName, branch, shallow = true, daysOld = 7 } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'clone-repository': {
        if (!repositoryId) {
          return NextResponse.json(
            { error: 'Repository ID is required for clone-repository action' },
            { status: 400 }
          );
        }

        console.log(`🚀 API: Cloning repository ${repositoryId}`);
        const result = await cloneRepository(repositoryId, targetPath, branch, shallow);
        
        return NextResponse.json({
          success: result.success,
          repositoryPath: result.repositoryPath,
          repositoryInfo: result.repositoryInfo,
          error: result.error
        });
      }

      case 'clone-first-org-repository': {
        if (!organizationId) {
          return NextResponse.json(
            { error: 'Organization ID is required for clone-first-org-repository action' },
            { status: 400 }
          );
        }

        console.log(`🚀 API: Cloning first repository for organization ${organizationId}`);
        const result = await cloneFirstRepositoryForOrganization(organizationId, targetPath, branch, shallow);
        
        return NextResponse.json({
          success: result.success,
          repositoryPath: result.repositoryPath,
          repositoryInfo: result.repositoryInfo,
          error: result.error
        });
      }

      case 'remove-repository': {
        if (!repositoryName) {
          return NextResponse.json(
            { error: 'Repository name is required for remove-repository action' },
            { status: 400 }
          );
        }

        console.log(`🗑️ API: Removing repository ${repositoryName}${organizationId ? ` from organization ${organizationId}` : ''}`);
        const success = await removeClonedRepository(repositoryName, organizationId || undefined);
        
        return NextResponse.json({
          success,
          message: success ? 'Repository removed successfully' : 'Failed to remove repository'
        });
      }

      case 'cleanup-old': {
        console.log(`🧹 API: Cleaning up repositories older than ${daysOld} days`);
        const cleanedRepos = await cleanupOldRepositories(daysOld);
        
        return NextResponse.json({
          success: true,
          cleanedRepositories: cleanedRepos,
          count: cleanedRepos.length,
          message: `Cleaned up ${cleanedRepos.length} old repositories`
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('❌ API Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const repositoryName = searchParams.get('repositoryName');
    const organizationId = searchParams.get('organizationId');

    if (!action) {
      return NextResponse.json(
        { error: 'Action parameter is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'list-cloned': {
        console.log('📋 API: Listing cloned repositories');
        const repositories = await listClonedRepositories();
        
        return NextResponse.json({
          success: true,
          repositories,
          count: repositories.length
        });
      }

      case 'check-cloned': {
        if (!repositoryName) {
          return NextResponse.json(
            { error: 'Repository name is required for check-cloned action' },
            { status: 400 }
          );
        }

        console.log(`🔍 API: Checking if repository ${repositoryName} is cloned${organizationId ? ` in organization ${organizationId}` : ''}`);
        const isCloned = await isRepositoryCloned(repositoryName, organizationId || undefined);
        const repositoryPath = await getRepositoryPath(repositoryName, organizationId || undefined);
        
        return NextResponse.json({
          success: true,
          isCloned,
          repositoryName,
          repositoryPath: isCloned ? repositoryPath : null
        });
      }

      case 'get-path': {
        if (!repositoryName) {
          return NextResponse.json(
            { error: 'Repository name is required for get-path action' },
            { status: 400 }
          );
        }

        const repositoryPath = await getRepositoryPath(repositoryName, organizationId || undefined);
        
        return NextResponse.json({
          success: true,
          repositoryName,
          repositoryPath
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('❌ API Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
