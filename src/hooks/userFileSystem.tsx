// hooks/useFileSystem.tsx
import { useState } from 'react';

interface Repository {
  organizationId: string;
  repositoryName: string;
  fullPath: string;
}

interface CloneResult {
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

export function useFileSystem() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cloneRepository = async (repositoryId: string, targetPath?: string, branch?: string, shallow: boolean = true): Promise<CloneResult> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/file-system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clone-repository',
          repositoryId,
          targetPath,
          branch,
          shallow
        })
      });
      
      const result = await response.json();
      if (!result.success && result.error) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      const error = err as any;
      setError(error.message);
      return { success: false, repositoryPath: '', error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const cloneFirstOrgRepo = async (organizationId: string, targetPath?: string, branch?: string, shallow: boolean = true): Promise<CloneResult> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/file-system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clone-first-org-repository',
          organizationId,
          targetPath,
          branch,
          shallow
        })
      });
      
      const result = await response.json();
      if (!result.success && result.error) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      const error = err as any;
      setError(error.message);
      return { success: false, repositoryPath: '', error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const listClonedRepositories = async (): Promise<Repository[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/file-system?action=list-cloned');
      const result = await response.json();
      
      if (!result.success) {
        setError(result.error || 'Failed to list repositories');
        return [];
      }
      
      return result.repositories || [];
    } catch (err) {
      const error = err as any;
      setError(error.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const isRepositoryCloned = async (repositoryName: string, organizationId?: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        action: 'check-cloned',
        repositoryName
      });
      
      if (organizationId) {
        params.append('organizationId', organizationId);
      }
      
      const response = await fetch(`/api/file-system?${params}`);
      const result = await response.json();
      
      if (!result.success) {
        setError(result.error || 'Failed to check repository');
        return false;
      }
      
      return result.isCloned || false;
    } catch (err) {
      const error = err as any;
      setError(error.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getRepositoryPath = async (repositoryName: string, organizationId?: string): Promise<string | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        action: 'get-path',
        repositoryName
      });
      
      if (organizationId) {
        params.append('organizationId', organizationId);
      }
      
      const response = await fetch(`/api/file-system?${params}`);
      const result = await response.json();
      
      if (!result.success) {
        setError(result.error || 'Failed to get repository path');
        return null;
      }
      
      return result.repositoryPath || null;
    } catch (err) {
      const error = err as any;
      setError(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const removeRepository = async (repositoryName: string, organizationId?: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/file-system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove-repository',
          repositoryName,
          organizationId
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        setError(result.error || result.message || 'Failed to remove repository');
        return false;
      }
      
      return result.success;
    } catch (err) {
      const error = err as any;
      setError(error.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const cleanupOldRepositories = async (daysOld: number = 7): Promise<string[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/file-system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cleanup-old',
          daysOld
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        setError(result.error || 'Failed to cleanup repositories');
        return [];
      }
      
      return result.cleanedRepositories || [];
    } catch (err) {
      const error = err as any;
      setError(error.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return { 
    cloneRepository, 
    cloneFirstOrgRepo, 
    listClonedRepositories,
    isRepositoryCloned,
    getRepositoryPath,
    removeRepository,
    cleanupOldRepositories,
    loading, 
    error 
  };
}