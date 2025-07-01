"use client"
import { useFileSystem } from "@/hooks/userFileSystem"
import { useEffect, useState } from "react"

const HARDCODED_ORG_ID = 'edff77be-dcc5-4ca3-aa55-40d0cb67dc31'

interface Repository {
  organizationId: string;
  repositoryName: string;
  fullPath: string;
}

export default function TestsPage() {
  const { 
    cloneRepository, 
    cloneFirstOrgRepo, 
    listClonedRepositories,
    isRepositoryCloned,
    getRepositoryPath,
    removeRepository,
    cleanupOldRepositories,
    loading, 
    error 
  } = useFileSystem()

  const [repositories, setRepositories] = useState<Repository[]>([])
  const [lastResult, setLastResult] = useState<any>(null)
  const [testRepoName, setTestRepoName] = useState('second-test')
  const [checkRepoResult, setCheckRepoResult] = useState<boolean | null>(null)
  const [repoPath, setRepoPath] = useState<string | null>(null)
  const [cleanupDays, setCleanupDays] = useState(7)

  // Load repositories on mount and after operations
  const loadRepositories = async () => {
    const repos = await listClonedRepositories()
    setRepositories(repos)
  }

  useEffect(() => {
    loadRepositories()
  }, [])

  const handleCloneFirstRepo = async () => {
    const result = await cloneFirstOrgRepo(HARDCODED_ORG_ID)
    setLastResult(result)
    if (result.success) {
      await loadRepositories()
    }
  }

  const handleCheckRepository = async () => {
    const isCloned = await isRepositoryCloned(testRepoName, HARDCODED_ORG_ID)
    setCheckRepoResult(isCloned)
  }

  const handleGetRepositoryPath = async () => {
    const path = await getRepositoryPath(testRepoName, HARDCODED_ORG_ID)
    setRepoPath(path)
  }

  const handleRemoveRepository = async (repoName: string, orgId: string) => {
    const success = await removeRepository(repoName, orgId)
    if (success) {
      await loadRepositories()
      setLastResult({ success: true, message: `Repository ${repoName} removed successfully` })
    } else {
      setLastResult({ success: false, error: `Failed to remove repository ${repoName}` })
    }
  }

  const handleCleanupOld = async () => {
    const cleanedRepos = await cleanupOldRepositories(cleanupDays)
    setLastResult({ 
      success: true, 
      message: `Cleaned up ${cleanedRepos.length} repositories`,
      cleanedRepositories: cleanedRepos 
    })
    await loadRepositories()
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold mb-6">File System Tests Dashboard</h1>
      
      {/* Loading and Error States */}
      {loading && (
        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
          Loading...
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {error}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Clone Operations</h3>
          <div className="space-y-2">
            <button 
              className="w-full bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50" 
              onClick={handleCloneFirstRepo}
              disabled={loading}
            >
              Clone First Org Repository
            </button>
            <button 
              className="w-full bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:opacity-50" 
              onClick={loadRepositories}
              disabled={loading}
            >
              Refresh Repository List
            </button>
          </div>
        </div>

        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Repository Checks</h3>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={testRepoName}
                onChange={(e) => setTestRepoName(e.target.value)}
                placeholder="Repository name"
                className="flex-1 px-2 py-1 border rounded text-sm"
              />
            </div>
            <button 
              className="w-full bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 disabled:opacity-50" 
              onClick={handleCheckRepository}
              disabled={loading}
            >
              Check if Cloned
            </button>
            <button 
              className="w-full bg-indigo-500 text-white px-4 py-2 rounded-md hover:bg-indigo-600 disabled:opacity-50" 
              onClick={handleGetRepositoryPath}
              disabled={loading}
            >
              Get Repository Path
            </button>
            {checkRepoResult !== null && (
              <div className={`text-sm p-2 rounded ${checkRepoResult ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                Repository is {checkRepoResult ? 'cloned' : 'not cloned'}
              </div>
            )}
            {repoPath && (
              <div className="text-xs p-2 bg-gray-100 rounded break-all">
                Path: {repoPath}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Cleanup</h3>
          <div className="space-y-2">
            <div className="flex gap-2 items-center">
              <span className="text-sm">Days old:</span>
              <input
                type="number"
                value={cleanupDays}
                onChange={(e) => setCleanupDays(parseInt(e.target.value) || 7)}
                className="w-16 px-2 py-1 border rounded text-sm"
                min="1"
              />
            </div>
            <button 
              className="w-full bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 disabled:opacity-50" 
              onClick={handleCleanupOld}
              disabled={loading}
            >
              Cleanup Old Repositories
            </button>
          </div>
        </div>
      </div>

      {/* Current Repositories */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Cloned Repositories ({repositories.length})</h2>
          <span className="text-sm text-gray-500">Org ID: {HARDCODED_ORG_ID}</span>
        </div>
        
        {repositories.length === 0 ? (
          <p className="text-gray-500 italic">No repositories cloned yet.</p>
        ) : (
          <div className="space-y-2">
            {repositories.map((repo, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{repo.repositoryName}</div>
                  <div className="text-sm text-gray-600">Org: {repo.organizationId}</div>
                  <div className="text-xs text-gray-500 font-mono break-all">{repo.fullPath}</div>
                </div>
                <button
                  onClick={() => handleRemoveRepository(repo.repositoryName, repo.organizationId)}
                  className="ml-4 bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 disabled:opacity-50"
                  disabled={loading}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Last Operation Result */}
      {lastResult && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Last Operation Result</h2>
          <div className={`p-4 rounded-lg ${lastResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="font-medium mb-2">
              Status: {lastResult.success ? '✅ Success' : '❌ Failed'}
            </div>
            {lastResult.error && (
              <div className="text-red-600 mb-2">Error: {lastResult.error}</div>
            )}
            {lastResult.message && (
              <div className="mb-2">Message: {lastResult.message}</div>
            )}
            {lastResult.repositoryPath && (
              <div className="text-sm font-mono bg-gray-100 p-2 rounded mb-2">
                Path: {lastResult.repositoryPath}
              </div>
            )}
            {lastResult.repositoryInfo && (
              <div className="text-sm">
                <div>Repository: {lastResult.repositoryInfo.fullName}</div>
                <div>ID: {lastResult.repositoryInfo.id}</div>
              </div>
            )}
            {lastResult.cleanedRepositories && lastResult.cleanedRepositories.length > 0 && (
              <div className="text-sm">
                <div>Cleaned repositories:</div>
                <ul className="list-disc list-inside ml-2">
                  {lastResult.cleanedRepositories.map((repo: string, index: number) => (
                    <li key={index} className="font-mono">{repo}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* System Info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2">System Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Base Path:</strong> /home/ismae/editable-claude-projects
          </div>
          <div>
            <strong>Organization Structure:</strong> /{'{'}orgId{'}'}/{'{'}repoName{'}'}
          </div>
          <div>
            <strong>Test Organization ID:</strong> 
            <span className="font-mono text-xs ml-1">{HARDCODED_ORG_ID}</span>
          </div>
          <div>
            <strong>Shallow Clone:</strong> Enabled by default
          </div>
        </div>
      </div>
    </div>
  )
}
