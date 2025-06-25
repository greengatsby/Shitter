'use client'

import { useState, useEffect } from 'react'
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
  Trash2
} from "lucide-react"

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

interface Member {
  id: string
  role: string
  joined_at: string
  user: {
    id: string
    email: string
    full_name: string | null
    phone_number: string | null
    avatar_url: string | null
  }
}

interface GitHubIntegration {
  id: string
  github_username: string
  github_user_id: number
  is_active: boolean
  created_at: string
}

interface Repository {
  id: string
  name: string
  full_name: string
  description: string | null
  private: boolean
  html_url: string
  github_repo_id: number
}

export default function DashboardPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [githubIntegrations, setGithubIntegrations] = useState<GitHubIntegration[]>([])
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteData, setInviteData] = useState({ phone_number: '', role: 'member' })
  const [inviteLoading, setInviteLoading] = useState(false)
  const [githubConnecting, setGithubConnecting] = useState(false)

  useEffect(() => {
    loadOrganizations()
  }, [])

  useEffect(() => {
    if (currentOrg) {
      loadOrganizationData()
    }
  }, [currentOrg])

  const loadOrganizations = async () => {
    try {
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
      setOrganizations(orgs)
      if (orgs && orgs.length > 0) {
        setCurrentOrg(orgs[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const loadOrganizationData = async () => {
    if (!currentOrg) return

    try {
      // Load members
      const membersResponse = await fetch(`/api/organizations/${currentOrg.organization.id}/members`)
      if (membersResponse.ok) {
        const membersData = await membersResponse.json()
        setMembers(membersData.members || [])
      }

      // Load GitHub integrations
      const githubResponse = await fetch(`/api/github/oauth?organization_id=${currentOrg.organization.id}`)
      const githubData = await githubResponse.json()
      setGithubIntegrations(githubData.integrations || [])
      setRepositories(githubData.repositories || [])
    } catch (err) {
      console.error('Error loading organization data:', err)
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
        body: JSON.stringify(inviteData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to invite user')
      }

      setInviteDialogOpen(false)
      setInviteData({ phone_number: '', role: 'member' })
      loadOrganizationData() // Refresh members list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setInviteLoading(false)
    }
  }

  const connectGitHub = () => {
    if (!currentOrg) return

    setGithubConnecting(true)
    setError('')

    // Create GitHub OAuth URL
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID
    if (!clientId) {
      setError('GitHub integration not properly configured. Missing client ID.')
      setGithubConnecting(false)
      return
    }

    const scope = 'repo,read:org,read:user,user:email'
    const state = `org_${currentOrg.organization.id}_${Date.now()}`
    const redirectUri = `${window.location.origin}/api/github/callback`

    const githubAuthUrl = `https://github.com/login/oauth/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${encodeURIComponent(state)}`

    // Open GitHub OAuth in a popup
    const popup = window.open(
      githubAuthUrl,
      'github-oauth',
      'width=600,height=700,scrollbars=yes,resizable=yes'
    )

    if (!popup) {
      setError('Popup blocked. Please allow popups and try again.')
      setGithubConnecting(false)
      return
    }

    // Listen for the OAuth callback
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return

      if (event.data.type === 'GITHUB_OAUTH_SUCCESS') {
        const { code, state: returnedState } = event.data

        // Verify state parameter
        if (!returnedState.includes(`org_${currentOrg.organization.id}`)) {
          setError('Invalid OAuth state. Please try again.')
          setGithubConnecting(false)
          return
        }

        try {
          // Exchange code for access token and save integration
          const response = await fetch('/api/github/oauth', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              organization_id: currentOrg.organization.id,
              code
            })
          })

          const data = await response.json()

          if (!response.ok) {
            throw new Error(data.error || 'Failed to connect GitHub')
          }

          // Reload organization data to show the new integration
          await loadOrganizationData()
          popup.close()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to connect GitHub')
        } finally {
          setGithubConnecting(false)
        }
      } else if (event.data.type === 'GITHUB_OAUTH_ERROR') {
        setError(event.data.error || 'GitHub OAuth failed')
        setGithubConnecting(false)
        popup.close()
      }
    }

    window.addEventListener('message', handleMessage)

    // Clean up if popup is closed manually
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed)
        window.removeEventListener('message', handleMessage)
        setGithubConnecting(false)
      }
    }, 1000)
  }

  const disconnectGitHub = async (integrationId: string) => {
    if (!currentOrg) return

    try {
      const response = await fetch(`/api/github/oauth/${integrationId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to disconnect GitHub')
      }

      // Reload organization data
      await loadOrganizationData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect GitHub')
    }
  }

  const syncRepositories = async (integrationId: string) => {
    if (!currentOrg) return

    try {
      setError('')
      const response = await fetch(`/api/github/sync-repositories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          integration_id: integrationId,
          organization_id: currentOrg.organization.id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync repositories')
      }

      // Reload organization data to show updated repositories
      await loadOrganizationData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync repositories')
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="h-4 w-4 text-yellow-600" />
      case 'admin': return <Shield className="h-4 w-4 text-blue-600" />
      default: return <User className="h-4 w-4 text-gray-600" />
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'default'
      case 'admin': return 'secondary'
      default: return 'outline'
    }
  }

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
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
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
              <CardTitle className="text-sm font-medium">Team Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{members.length}</div>
              <p className="text-xs text-muted-foreground">
                Active members in organization
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
                {githubIntegrations.length > 0 ? 'Connected' : 'Not Connected'}
              </div>
              <p className="text-xs text-muted-foreground">
                Integration status
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="team" className="space-y-6">
          <TabsList>
            <TabsTrigger value="team">Team Members</TabsTrigger>
            <TabsTrigger value="github">GitHub Integration</TabsTrigger>
            <TabsTrigger value="repositories">Repositories</TabsTrigger>
          </TabsList>

          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Team Members</CardTitle>
                    <CardDescription>
                      Manage your organization's team members and their roles
                    </CardDescription>
                  </div>
                  <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite Member
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Invite Team Member</DialogTitle>
                        <DialogDescription>
                          Add a new member to your organization by phone number
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
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          {member.user.full_name?.charAt(0) || member.user.email.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{member.user.full_name || 'Unknown'}</p>
                          <p className="text-sm text-gray-600">{member.user.email}</p>
                          {member.user.phone_number && (
                            <p className="text-sm text-gray-500 flex items-center">
                              <Phone className="h-3 w-3 mr-1" />
                              {member.user.phone_number}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={getRoleBadgeVariant(member.role)} className="flex items-center gap-1">
                          {getRoleIcon(member.role)}
                          {member.role}
                        </Badge>
                        {member.joined_at ? (
                          <span className="text-sm text-green-600">Active</span>
                        ) : (
                          <span className="text-sm text-yellow-600">Pending</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {members.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No team members yet. Invite someone to get started!
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
                {githubIntegrations.length > 0 ? (
                  <div className="space-y-4">
                    {githubIntegrations.map((integration) => (
                      <div key={integration.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <Github className="h-8 w-8" />
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="font-medium">@{integration.github_username}</p>
                              <Badge variant={integration.is_active ? "default" : "secondary"}>
                                {integration.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600">
                              Connected {new Date(integration.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => syncRepositories(integration.id)}
                          >
                            Sync Repos
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => disconnectGitHub(integration.id)}
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
                      Connect your GitHub account to sync repositories and manage team access
                    </p>
                    <Button onClick={connectGitHub} disabled={githubConnecting}>
                      {githubConnecting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Github className="h-4 w-4 mr-2" />
                          Connect GitHub
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="repositories" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Repositories</CardTitle>
                <CardDescription>
                  Manage GitHub repositories and team member access
                </CardDescription>
              </CardHeader>
              <CardContent>
                {repositories.length > 0 ? (
                  <div className="space-y-4">
                    {repositories.map((repo) => (
                      <div key={repo.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <GitBranch className="h-6 w-6 text-gray-600" />
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="font-medium">{repo.name}</p>
                              {repo.private && (
                                <Badge variant="secondary" className="text-xs">Private</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{repo.description || 'No description'}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm" asChild>
                            <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View on GitHub
                            </a>
                          </Button>
                          <Button variant="outline" size="sm">
                            Manage Access
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {githubIntegrations.length > 0
                      ? "No repositories synced yet. Click 'Sync Repos' in the GitHub Integration tab."
                      : "Connect GitHub first to see your repositories."
                    }
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
} 