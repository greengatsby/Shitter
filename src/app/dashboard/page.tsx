'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Building2,
  Users,
  Github,
  Plus,
  Settings,
  UserPlus,
  Phone,
  Mail,
  ExternalLink,
  GitBranch,
  Code2,
  Shield,
  Eye,
  Crown,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  User,
  Trash2,
  LogOut,
  MessageSquare
} from "lucide-react"
import { useAuth } from '@/context/useAuth'
import { ROLES } from '@/utils/constants'
import { createClient } from '@/utils/supabase/client'
import { sanitizePhoneNumber } from '@/lib/file-system'

const supabase = createClient()

interface Organization {
  id: string
  organization: {
    id: string
    name: string
    slug: string
    description: string | null
    created_at: string
  }
  role: string
  joined_at: string
}

interface Client {
  id: string
  alias: string | null
  role: string
  phone: string | null
  joined_at: string | null
  invited_at: string | null
  created_at: string
  org_client_id: string | null
  client_profile: {
    id: string
    email: string | null
    full_name: string | null
    phone_number: string | null
    avatar_url: string | null
    user_id: string | null
  } | null
  invited_by_profile: {
    id: string
    email: string | null
    full_name: string | null
  } | null
}

interface GitHubInstallation {
  id: string
  installation_id: number
  app_slug: string
  account_login: string
  account_type: string
  account_avatar_url?: string
  repository_selection: string
  repositories_count: number
  is_active: boolean
  created_at: string
  permissions: Record<string, string>
  events: string[]
}

// Removed GitHubIntegration interface - using only GitHub App installations

interface Repository {
  id: string
  name: string
  full_name: string
  description: string | null
  private: boolean
  html_url: string
  github_repo_id: number
  installation_id: number
  installation: {
    account_login: string
    account_type: string
    account_avatar_url?: string
  }
}

interface RepositoryAssignment {
  id: string
  client_id: string
  repository_id: string
  role: string
  permissions: string[]
  created_at: string
  user: {
    id: string
    role: string
    phone: string | null
  }
  assigned_by_user: {
    id: string
    email: string
    full_name: string | null
  }
}

export default function DashboardPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [githubInstallations, setGithubInstallations] = useState<GitHubInstallation[]>([])
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false) // Separate loading state for organization data
  const [error, setError] = useState('')
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteData, setInviteData] = useState({ phone_number: '', role: 'admin', alias: '' })
  const [inviteLoading, setInviteLoading] = useState(false)
  const [githubConnecting, setGithubConnecting] = useState(false)
  const [syncingRepositories, setSyncingRepositories] = useState(false)
  const [repositoryFilter, setRepositoryFilter] = useState<string>('all')
  
  // Repository assignment states
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false)
  const [selectedRepository, setSelectedRepository] = useState<Repository | null>(null)
  const [repositoryAssignments, setRepositoryAssignments] = useState<RepositoryAssignment[]>([])
  const [assignmentLoading, setAssignmentLoading] = useState(false)
  const [assignData, setAssignData] = useState({ client_id: '', role: 'developer' })
  // Track all repository assignments to show unassigned repos in red
  const [allRepositoryAssignments, setAllRepositoryAssignments] = useState<Map<string, RepositoryAssignment[]>>(new Map())

  // hooks
  // const { user, session } = useAuth()

  // 🛡️ DUPLICATE PREVENTION: Use refs to track what's already been loaded
  const organizationsLoaded = useRef(false)
  const orgDataLoaded = useRef<string | null>(null) // Track which org data was loaded

  const getErrorMessage = (error: string) => {
    switch (error) {
      case 'missing_installation_id':
        return 'Installation ID is missing. Please try installing the GitHub App again.'
      case 'missing_organization_id':
        return 'Organization information is missing. Please start the installation from your dashboard.'
      case 'installation_save_failed':
        return 'Failed to save installation data. Please contact support.'
      case 'installation_link_failed':
        return 'Failed to link installation to organization. Please try again.'
      case 'installation_processing_failed':
        return 'Failed to process the installation. Please try again.'
      case 'callback_failed':
        return 'Installation callback failed. Please try again.'
      default:
        return 'An error occurred during installation. Please try again.'
    }
  }

  useEffect(() => {
    const checkAuth = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        console.log('❌ Error checking auth:', error)
        // window.location.href = '/auth/signin'
      }
      if(data) {
        console.log('✅ Auth data:', data)
      }
    }
    checkAuth()
  }, [])

  // 🚀 OPTIMIZED: Single effect for initial load with duplicate prevention
  useEffect(() => {
    const initializeDashboard = async () => {
      // 🛡️ GUARD: Prevent duplicate initialization
      if (organizationsLoaded.current) {
        console.log('⚠️  Organizations already loaded, skipping...')
        return
      }

      try {
        setLoading(true)
        organizationsLoaded.current = true // Mark as loading to prevent duplicates
        
        // Handle URL parameters first
        const urlParams = new URLSearchParams(window.location.search)
        const githubConnected = urlParams.get('github_connected')
        const installationPending = urlParams.get('installation_pending')
        const error = urlParams.get('error')
        
        if (githubConnected === 'true') {
          console.log('✅ GitHub connected successfully')
          window.history.replaceState({}, '', '/dashboard')
        }
        
        if (installationPending === 'true') {
          console.log('⏳ Installation pending - will check for pending installations')
          window.history.replaceState({}, '', '/dashboard')
        }
        
        if (error) {
          setError(getErrorMessage(error))
          window.history.replaceState({}, '', '/dashboard')
        }

        // Load organizations
        await loadOrganizations()
        
      } catch (err) {
        console.error('❌ Dashboard initialization error:', err)
        setError(err instanceof Error ? err.message : 'Failed to initialize dashboard')
        organizationsLoaded.current = false // Reset on error
      } finally {
        setLoading(false)
      }
    }

    initializeDashboard()
  }, []) // Empty dependency array - runs only once on mount

  // 🚀 OPTIMIZED: Separate effect for organization data loading with better guards
  useEffect(() => {
    if (currentOrg && !loading) {
      const orgId = currentOrg.organization.id
      
      // 🛡️ GUARD: Check if we already loaded data for this org
      if (orgDataLoaded.current === orgId) {
        console.log(`⚠️  Data already loaded for org ${currentOrg.organization.name}, skipping...`)
        return
      }

      console.log(`🔄 Organization changed to: ${currentOrg.organization.name}`)
      orgDataLoaded.current = orgId // Mark this org as being loaded
      
      loadOrganizationData()
      
      // Check for pending installations after a short delay. DISABLED, left as docs
      // const timeoutId = setTimeout(() => {
      //   linkPendingInstallations()
      // }, 1000)

      // return () => {
      //   clearTimeout(timeoutId) // Cleanup timeout on unmount/dependency change
      // }
    }
  }, [currentOrg?.organization.id, loading]) // Add loading to dependencies

  const loadOrganizations = async () => {
    try {
      console.log('📋 Loading organizations...')
      const response = await fetch('/api/organizations')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load organizations')
      }

      const orgs = data.organizations.map((item: any) => ({
        id: item.organization.id,
        organization: {
          id: item.organization.id,
          name: item.organization.name,
          slug: item.organization.slug,
          description: item.organization.description,
          created_at: item.organization.created_at
        },
        role: item.role
      }))
      
      console.log(`✅ Loaded ${orgs.length} organizations`)
      setOrganizations(orgs)
      
      if (orgs && orgs.length > 0) {
        setCurrentOrg(orgs[0])
        console.log(`🎯 Set current org to: ${orgs[0].organization.name}`)
      }
    } catch (err) {
      console.error('❌ Error loading organizations:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const loadOrganizationData = async () => {
    if (!currentOrg) {
      console.log('⚠️  No current organization, skipping data load')
      return
    }

    // 🛡️ GUARD: Prevent duplicate calls if already loading
    if (dataLoading) {
      console.log('⏳ Organization data already loading, skipping...')
      return
    }

    try {
      setDataLoading(true)
      console.log(`📊 Loading data for organization: ${currentOrg.organization.name}`)

      // Load all organization data in parallel for better performance
      const [membersResponse, installationsResponse, repoResponse] = await Promise.allSettled([
        fetch(`/api/organizations/${currentOrg.organization.id}/members`),
        fetch(`/api/github/installations?organization_id=${currentOrg.organization.id}`),
        fetch(`/api/organizations/${currentOrg.organization.id}/repositories`)
      ])

      // Handle clients
      if (membersResponse.status === 'fulfilled' && membersResponse.value.ok) {
        const clientsData = await membersResponse.value.json()
        setClients(clientsData.clients || [])
        console.log(`👥 Loaded ${clientsData.clients?.length || 0} clients`)
      } else {
        console.error('❌ Failed to load clients')
        setClients([])
      }

      // Handle GitHub installations
      if (installationsResponse.status === 'fulfilled' && installationsResponse.value.ok) {
        const installationsData = await installationsResponse.value.json()
        setGithubInstallations(installationsData.installations || [])
        console.log(`🔗 Loaded ${installationsData.installations?.length || 0} GitHub installations`)
      } else {
        console.error('❌ Failed to load GitHub installations')
        setGithubInstallations([])
      }

      // Handle repositories
      if (repoResponse.status === 'fulfilled' && repoResponse.value.ok) {
        const repoData = await repoResponse.value.json()
        setRepositories(repoData.repositories || [])
        console.log(`📦 Loaded ${repoData.repositories?.length || 0} repositories`)
        
        // Load assignments for all repositories
        if (repoData.repositories && repoData.repositories.length > 0) {
          loadAllRepositoryAssignments(repoData.repositories)
        }
      } else {
        console.error('❌ Failed to load repositories')
        setRepositories([])
      }

    } catch (err) {
      console.error('❌ Error loading organization data:', err)
    } finally {
      setDataLoading(false)
    }
  }

  // 🔄 REFRESH: Function to refresh organization data (for manual refreshes)
  const refreshOrganizationData = async () => {
    if (!currentOrg) return
    
    // Reset the loaded flag to allow refresh
    orgDataLoaded.current = null
    await loadOrganizationData()
    // Reset the flag back to current org to prevent duplicates
    orgDataLoaded.current = currentOrg.organization.id
    
    // Refresh assignments after data is reloaded
    if (repositories.length > 0) {
      await loadAllRepositoryAssignments(repositories)
    }
  }

  const handleInviteUser = async () => {
    if (!currentOrg || !inviteData.phone_number) return

    setInviteLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/organizations/${currentOrg.organization.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...inviteData,
          phone_number: sanitizePhoneNumber(inviteData.phone_number)
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to invite user')
      }

      setInviteDialogOpen(false)
      setInviteData({ phone_number: '', role: 'member', alias: '' })
      refreshOrganizationData() // Refresh members list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setInviteLoading(false)
    }
  }

  const connectGitHubApp = async () => {
    if (!currentOrg) return

    setGithubConnecting(true)
    setError('')

    try {
      // Get installation URL
      const response = await fetch(`/api/github/install?organization_id=${currentOrg.organization.id}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get installation URL')
      }

      // Open GitHub App installation page
      window.open(data.installation_url, '_blank')
      
      // Poll for installation completion
      pollForInstallation()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect GitHub App')
      setGithubConnecting(false)
    }
  }

  const pollForInstallation = () => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/github/installations?organization_id=${currentOrg?.organization.id}`)
        if (response.ok) {
          const data = await response.json()
          if (data.installations && data.installations.length > 0) {
            clearInterval(pollInterval)
            setGithubConnecting(false)
            await refreshOrganizationData()
          }
        }
      } catch (err) {
        console.error('Error polling for installation:', err)
      }
    }, 5000)

    // Stop polling after 2 minutes
    setTimeout(() => {
      clearInterval(pollInterval)
      setGithubConnecting(false)
    }, 120000)
  }

  const disconnectGitHubApp = async (installationId: number) => {
    if (!currentOrg) return

    try {
      const response = await fetch('/api/github/install', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          installation_id: installationId,
          organization_id: currentOrg.organization.id
        })
      })

      if (!response.ok) {
        throw new Error('Failed to disconnect GitHub App')
      }

      // Reload organization data
      await refreshOrganizationData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect GitHub App')
    }
  }

  // Removed disconnectGitHub function - only using GitHub App now

  const linkPendingInstallations = async () => {
    if (!currentOrg) return

    try {
      // Check for pending installations and try to link them
      const response = await fetch('/api/github/installations/pending')
      if (response.ok) {
        const data = await response.json()
        if (data.installations && data.installations.length > 0) {
          console.log('Found pending installations:', data.installations.length)
          
          // Try to link the most recent installation to this organization
          const latestInstallation = data.installations[0]
          const linkResponse = await fetch('/api/github/installations/link', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              installation_id: latestInstallation.installation_id,
              organization_id: currentOrg.organization.id
            })
          })
          
          if (linkResponse.ok) {
            console.log('Successfully linked pending installation')
            // Reload organization data to show the new installation
            await loadOrganizationData()
          }
        }
      }
    } catch (error) {
      console.error('Error linking pending installations:', error)
      // Don't show error to user, this is background operation
    }
  }

  const syncRepositories = async (installationId: number) => {
    if (!currentOrg) return

    setSyncingRepositories(true)
    setError('')

    try {
      console.log(`🚀 Starting repository sync for installation ${installationId}`)
      
      const response = await fetch('/api/github/sync-repositories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          installation_id: installationId,
          organization_id: currentOrg.organization.id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync repositories')
      }

      console.log(`✅ Successfully synced ${data.synced_count} repositories`)
      
      // Reload organization data to show updated repositories
      await refreshOrganizationData()
      
      // Show success message briefly
      setError('')
      
    } catch (err) {
      console.error('❌ Repository sync failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to sync repositories')
    } finally {
      setSyncingRepositories(false)
    }
  }

  const openAssignmentDialog = async (repository: Repository) => {
    setSelectedRepository(repository)
    setAssignmentDialogOpen(true)
    await loadRepositoryAssignments(repository.id)
  }

  const loadRepositoryAssignments = async (repositoryId: string) => {
    setAssignmentLoading(true)
    try {
      const response = await fetch(`/api/github/repositories/${repositoryId}/assignments`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load assignments')
      }

      setRepositoryAssignments(data.assignments || [])
    } catch (err) {
      console.error('❌ Error loading repository assignments:', err)
      setError(err instanceof Error ? err.message : 'Failed to load assignments')
    } finally {
      setAssignmentLoading(false)
    }
  }

  const loadAllRepositoryAssignments = async (repositories: Repository[]) => {
    try {
      const assignmentMap = new Map<string, RepositoryAssignment[]>()
      
      // Load assignments for all repositories in parallel
      const assignmentPromises = repositories.map(async (repo) => {
        try {
          const response = await fetch(`/api/github/repositories/${repo.id}/assignments`)
          const data = await response.json()
          
          if (response.ok) {
            assignmentMap.set(repo.id, data.assignments || [])
          } else {
            assignmentMap.set(repo.id, [])
          }
        } catch (err) {
          console.error(`❌ Error loading assignments for repo ${repo.name}:`, err)
          assignmentMap.set(repo.id, [])
        }
      })
      
      await Promise.all(assignmentPromises)
      setAllRepositoryAssignments(assignmentMap)
      
    } catch (err) {
      console.error('❌ Error loading all repository assignments:', err)
    }
  }

  const handleAssignUser = async () => {
    if (!selectedRepository || !assignData.client_id) return

    setAssignmentLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/github/repositories/${selectedRepository.id}/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(assignData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to assign user')
      }

      if(!currentOrg) {
        console.error('❌ No organization found')
        throw new Error('No organization found')
      }

      console.log('✅ Assignment successful, starting repository clone...')

      // Find the assigned user's phone number for cloning
      const assignedUser = clients.find(client => client.id === assignData.client_id)
      
      if (assignedUser && (assignedUser.phone || assignedUser.client_profile?.phone_number)) {
        try {
          console.log(`🚀 Cloning repository ${selectedRepository.name} for user: ${assignedUser.client_profile?.full_name || assignedUser.client_profile?.email}`)
          
          const cloneResponse = await fetch('/api/clone-repository', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              repositoryId: selectedRepository.id,
              orgId: currentOrg.organization.id,
              memberPhoneNumber: assignedUser.phone || assignedUser.client_profile?.phone_number,
              branch: undefined // Use default branch
            }),
          })

          const cloneResult = await cloneResponse.json()

          if (!cloneResponse.ok || !cloneResult.success) {
            console.warn('⚠️ Repository assignment succeeded but cloning failed:', cloneResult.error)
            // Don't throw error here - assignment was successful, cloning is secondary
          } else {
            console.log(`✅ Repository cloned successfully to: ${cloneResult.repositoryPath}`)
          }
        } catch (cloneErr) {
          console.warn('⚠️ Repository assignment succeeded but cloning failed:', cloneErr)
          // Don't throw error here - assignment was successful, cloning is secondary
        }
      } else {
        console.warn('⚠️ Cannot clone repository: user has no phone number')
      }

      // Reset form and reload assignments
      setAssignData({ client_id: '', role: 'developer' })
      await loadRepositoryAssignments(selectedRepository.id)
      
      // Refresh the assignment data for all repositories to update the red highlighting
      await loadAllRepositoryAssignments(repositories)
      
    } catch (err) {
      console.error('❌ Assignment failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to assign user')
    } finally {
      setAssignmentLoading(false)
    }
  }

  const handleRemoveAssignment = async (userId: string) => {
    if (!selectedRepository) return

    setAssignmentLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/github/repositories/${selectedRepository.id}/assignments`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ client_id: userId })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove assignment')
      }

      // Reload assignments
      await loadRepositoryAssignments(selectedRepository.id)
      
      // Refresh the assignment data for all repositories to update the red highlighting
      await loadAllRepositoryAssignments(repositories)
      
    } catch (err) {
      console.error('❌ Assignment removal failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to remove assignment')
    } finally {
      setAssignmentLoading(false)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'org-owner': return <Crown className="h-4 w-4 text-yellow-600" />
      case 'org-admin': return <Shield className="h-4 w-4 text-blue-600" />
      default: return <User className="h-4 w-4 text-gray-600" />
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'org-owner': return 'default'
      case 'org-admin': return 'secondary'
      default: return 'outline'
    }
  }

  const isRepositoryAssigned = (repositoryId: string): boolean => {
    const assignments = allRepositoryAssignments.get(repositoryId)
    return assignments ? assignments.length > 0 : false
  }

  const hasGitHubConnection = githubInstallations.length > 0

  // Filter repositories based on selected installation
  const filteredRepositories = repositoryFilter === 'all' 
    ? repositories 
    : repositories.filter(repo => repo.installation_id.toString() === repositoryFilter)

  // Get unique installations for filter options
  const installationOptions = githubInstallations.map(installation => ({
    value: installation.installation_id.toString(),
    label: `@${installation.account_login} (${installation.account_type})`
  }))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!currentOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>No Organization Found</CardTitle>
            <CardDescription>
              You need to create or join an organization to access the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => window.location.href = '/auth/signup'}>
              Create Organization
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Building2 className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold">{currentOrg.organization.name}</h1>
                <p className="text-gray-600">Organization Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={getRoleBadgeVariant(currentOrg.role)} className="flex items-center gap-1">
                {getRoleIcon(currentOrg.role)}
                {currentOrg.role}
              </Badge>
              {(currentOrg.role === ROLES.ORG_ADMIN || currentOrg.role === ROLES.ORG_OWNER) && (
                <Button variant="outline" size="sm" onClick={() => window.location.href = '/dashboard/web-chat'}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Web Chat
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={async () => {
                await supabase.auth.signOut()
                window.location.href = '/auth/signin'
              }}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients.length}</div>
              {dataLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              <p className="text-xs text-muted-foreground">
                Active clients in organization
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">GitHub Repos</CardTitle>
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{repositories.length}</div>
              {dataLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              <p className="text-xs text-muted-foreground">
                Connected repositories
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">GitHub Status</CardTitle>
              <Github className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {hasGitHubConnection ? 'Connected' : 'Not Connected'}
              </div>
              {dataLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              <p className="text-xs text-muted-foreground">
                {githubInstallations.length > 0 ? 'GitHub App' : 'Integration status'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="team" className="space-y-6">
          <TabsList>
            <TabsTrigger value="team">Clients</TabsTrigger>
            <TabsTrigger value="github">GitHub Integration</TabsTrigger>
            <TabsTrigger value="repositories">Repositories</TabsTrigger>
          </TabsList>

          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Clients</CardTitle>
                    <CardDescription>
                      Manage your organization's clients and their roles
                    </CardDescription>
                  </div>
                  <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite Clients
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Invite Client</DialogTitle>
                        <DialogDescription>
                          Add a new client to your organization by phone number
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone Number</Label>
                          <Input
                            id="phone"
                            placeholder="+1 (555) 123-4567"
                            value={inviteData.phone_number}
                            onChange={(e) => setInviteData(prev => ({ ...prev, phone_number: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="alias">Alias (Optional)</Label>
                          <Input
                            id="alias"
                            placeholder="e.g., John Doe, Metal Blog App"
                            value={inviteData.alias}
                            onChange={(e) => setInviteData(prev => ({ ...prev, alias: e.target.value }))}
                          />
                          <p className="text-xs text-gray-500">
                            A display name to help you identify this person before they accept the invitation
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="role">Role</Label>
                          <Select
                            value={inviteData.role}
                            onValueChange={(value) => setInviteData(prev => ({ ...prev, role: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleInviteUser} disabled={inviteLoading}>
                          {inviteLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            'Send Invitation'
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {clients.map((client) => (
                    <div key={client.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          {client.client_profile?.full_name?.charAt(0) || client.client_profile?.email?.charAt(0) || client.phone?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-medium">(alias) {client.alias || 'Unknown'}</p>
                          <p className="text-sm text-gray-600">{client.client_profile?.email || 'No email'}</p>
                          {(client.phone || client.client_profile?.phone_number) && (
                            <p className="text-sm text-gray-500 flex items-center">
                              <Phone className="h-3 w-3 mr-1" />
                              {client.phone || client.client_profile?.phone_number}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={getRoleBadgeVariant(client.role)} className="flex items-center gap-1">
                          {getRoleIcon(client.role)}
                          {client.role}
                        </Badge>
                        {client.joined_at ? (
                          <span className="text-sm text-green-600">Active</span>
                        ) : (
                          <span className="text-sm text-yellow-600">Pending</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {clients.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No clients yet. Invite someone to get started!
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="github" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>GitHub Integration</CardTitle>
                <CardDescription>
                  Connect your GitHub account to sync repositories and manage team access
                </CardDescription>
              </CardHeader>
              <CardContent>
                {githubInstallations.length > 0 ? (
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-gray-600">GitHub App Installations</h4>
                    {githubInstallations.map((installation) => (
                      <div key={installation.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <Github className="h-8 w-8" />
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="font-medium">@{installation.account_login}</p>
                              <Badge variant={installation.is_active ? "default" : "secondary"}>
                                {installation.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                              <Badge variant="outline">{installation.account_type}</Badge>
                            </div>
                            <p className="text-sm text-gray-600">
                              {installation.repository_selection} repositories • 
                              Connected {new Date(installation.created_at).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-gray-500">
                              Installation ID: {installation.installation_id}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => syncRepositories(installation.installation_id)}
                            disabled={syncingRepositories}
                          >
                            {syncingRepositories ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Syncing...
                              </>
                            ) : (
                              'Sync Repos'
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a 
                              href={`https://github.com/settings/installations/${installation.installation_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Manage
                            </a>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => disconnectGitHubApp(installation.installation_id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Disconnect
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                
                ) : (
                  <div className="text-center py-8">
                    <Github className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Connect GitHub</h3>
                    <p className="text-gray-600 mb-4">
                      Install our GitHub App to sync repositories and manage team access securely
                    </p>
                    <div className="space-y-2">
                      <Button onClick={connectGitHubApp} disabled={githubConnecting}>
                        {githubConnecting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Github className="h-4 w-4 mr-2" />
                            Install GitHub App
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-gray-500">
                        Recommended: More secure and feature-rich than OAuth
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="repositories" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Repositories</CardTitle>
                    <CardDescription>
                      Manage GitHub repositories and team member access
                    </CardDescription>
                  </div>
                  {githubInstallations.length > 0 && (
                    <Button 
                      variant="outline" 
                      onClick={() => syncRepositories(githubInstallations[0].installation_id)}
                      disabled={syncingRepositories}
                    >
                      {syncingRepositories ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <Code2 className="h-4 w-4 mr-2" />
                          Sync Repositories
                        </>
                      )}
                    </Button>
                  )}
                </div>
                                  {repositories.length > 0 && (
                  <div className="flex items-center space-x-4 pt-4">
                    <Label htmlFor="installation-filter" className="text-sm font-medium">
                      Filter by Installation:
                    </Label>
                    <Select value={repositoryFilter} onValueChange={setRepositoryFilter}>
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="All installations" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All installations</SelectItem>
                        {installationOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge variant="outline" className="ml-auto">
                      {filteredRepositories.length} of {repositories.length} repositories
                    </Badge>
                    {(() => {
                      const unassignedCount = filteredRepositories.filter(repo => !isRepositoryAssigned(repo.id)).length
                      return unassignedCount > 0 ? (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {unassignedCount} unassigned
                        </Badge>
                      ) : (
                        <Badge variant="default" className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          All assigned
                        </Badge>
                      )
                    })()}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {filteredRepositories.length > 0 ? (
                  <div className="space-y-4">
                    {filteredRepositories.map((repo) => {
                      const isAssigned = isRepositoryAssigned(repo.id)
                      return (
                        <div key={repo.id} className={`flex items-center justify-between p-4 border rounded-lg ${!isAssigned ? 'border-red-300 bg-red-50' : ''}`}>
                          <div className="flex items-center space-x-4">
                            <GitBranch className={`h-6 w-6 ${!isAssigned ? 'text-red-600' : 'text-gray-600'}`} />
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <p className={`font-medium ${!isAssigned ? 'text-red-900' : ''}`}>{repo.name}</p>
                                {repo.private && (
                                  <Badge variant="secondary" className="text-xs">Private</Badge>
                                )}
                                {!isAssigned && (
                                  <Badge variant="destructive" className="text-xs">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Unassigned
                                  </Badge>
                                )}
                              </div>
                              <p className={`text-sm mb-1 ${!isAssigned ? 'text-red-700' : 'text-gray-600'}`}>
                                {repo.description || 'No description'}
                              </p>
                              {!isAssigned && (
                                <p className="text-xs text-red-600 font-medium mb-1">
                                  ⚠️ This repository must be assigned to a team member
                                </p>
                              )}
                              <div className="flex items-center space-x-2">
                                <Github className="h-3 w-3 text-gray-400" />
                                <span className="text-xs text-gray-500">
                                  @{repo.installation?.account_login || 'Unknown'} 
                                  <span className="ml-1">({repo.installation?.account_type || 'unknown'})</span>
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button variant="outline" size="sm" asChild>
                              <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View on GitHub
                              </a>
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openAssignmentDialog(repo)}
                            >
                              <UserCheck className="h-4 w-4 mr-2" />
                              Manage Access
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {syncingRepositories ? (
                      <div className="flex flex-col items-center space-y-2">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                        <p>Syncing repositories from GitHub...</p>
                      </div>
                    ) : repositories.length > 0 && filteredRepositories.length === 0 ? (
                      <div className="space-y-2">
                        <p>No repositories found for the selected installation.</p>
                        <Button variant="link" onClick={() => setRepositoryFilter('all')}>
                          Show all repositories
                        </Button>
                      </div>
                    ) : githubInstallations.length > 0 ? (
                      <div className="space-y-2">
                        <p>No repositories synced yet.</p>
                        <p className="text-sm">Click "Sync Repositories" above to fetch your repositories from GitHub.</p>
                      </div>
                    ) : (
                      "Connect GitHub first to see your repositories."
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Repository Assignment Dialog */}
        <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Repository Access</DialogTitle>
              <DialogDescription>
                Assign clients to {selectedRepository?.name} repository
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Assign New User */}
              <div className="space-y-4">
                <h4 className="font-medium">Assign New Member</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assign-user">Team Member</Label>
                    <Select
                      value={assignData.client_id}
                      onValueChange={(value) => setAssignData(prev => ({ ...prev, client_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select member" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients
                          .filter(client => client.phone && !repositoryAssignments.some(assignment => assignment.user.phone === client.phone))
                          .map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.client_profile?.full_name || client.client_profile?.email || client.phone || 'Unknown'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assign-role">Role</Label>
                    <Select
                      value={assignData.role}
                      onValueChange={(value) => setAssignData(prev => ({ ...prev, role: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="developer">Developer</SelectItem>
                        <SelectItem value="reviewer">Reviewer</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={handleAssignUser} 
                      disabled={assignmentLoading || !assignData.client_id}
                      className="w-full"
                    >
                      {assignmentLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Assigning...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Assign
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Current Assignments */}
              <div className="space-y-4">
                <h4 className="font-medium">Current Assignments</h4>
                {assignmentLoading && repositoryAssignments.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : repositoryAssignments.length > 0 ? (
                  <div className="space-y-3">
                    {repositoryAssignments.map((assignment) => (
                      <div key={assignment.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                            H
                          </div>
                          <div>
                            <p className="font-medium">{assignment.user.phone || 'Unknown'}</p>
                            <p className="text-sm text-gray-600">{assignment.user.phone}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{assignment.role}</Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveAssignment(assignment.client_id)}
                            disabled={assignmentLoading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No members assigned to this repository yet.
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignmentDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
} 