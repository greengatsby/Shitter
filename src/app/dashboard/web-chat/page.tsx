"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  MessageSquare,
  Users,
  Shield,
  Crown,
  User,
  Loader2,
  ArrowLeft,
  Phone,
  Mail,
  GitBranch,
  Github,
  Settings
} from "lucide-react"
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/useAuth'
import WebChat from '@/app/dashboard/_components/WebChat'
import { toast } from 'sonner'
import { OrgClient, Repository as RepoType } from './_types'
import { ROLES } from '@/utils/constants'

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

// Using OrgClient interface from _types.ts

interface Repository {
  id: string
  name: string
  full_name: string
  description: string | null
  private: boolean
  html_url: string
  language: string | null
  default_branch: string
  installation: {
    account_login: string
    account_type: string
    account_avatar_url: string | null
    installation_id: number
    organization_id: string
    is_active: boolean
  }
}

export default function WebChatPage() {
  const router = useRouter()
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [members, setMembers] = useState<OrgClient[]>([])
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [selectedMember, setSelectedMember] = useState<string>('')
  const [selectedRepository, setSelectedRepository] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [showWebChat, setShowWebChat] = useState(false)
  const [omitGitWorkflow, setOmitGitWorkflow] = useState(false)
  const [cloningInProgress, setCloningInProgress] = useState(false)
  const [repositoriesLoading, setRepositoriesLoading] = useState(false)
  const [membersLoading, setMembersLoading] = useState(false)
  const [projectPath, setProjectPath] = useState<string>('')
  const { currentUserData, isLoading} = useAuth()

  useEffect(() => {
    const initializePage = async () => {
      try {
        setLoading(true)

        // console.log('user', user, 'session', session)
        // if ( !isLoading && (!user || !session) ) {
        //   router.push('/auth/signin')
        //   return
        // }

        // Load organizations to get current org and user role
        await loadOrganizations()
        
      } catch (err) {
        console.error('❌ Page initialization error:', err)
        setError(err instanceof Error ? err.message : 'Failed to initialize page')
      } finally {
        setLoading(false)
      }
    }

    initializePage()
  }, [router])

  useEffect(() => {
    if (currentOrg && isAdmin) {
      loadMembers()
    }
  }, [currentOrg, isAdmin])

  useEffect(() => {
    if (selectedMember) {
      loadRepositoriesForMember(selectedMember)
    } else {
      setRepositories([])
    }
    // Clear selected repository when member changes
    setSelectedRepository('')
  }, [selectedMember])

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
      
      if (orgs && orgs.length > 0) {
        const org = orgs[0]
        setCurrentOrg(org)
        
        // Check if user is admin or owner
        const adminRoles = [ROLES.ORG_ADMIN, ROLES.ORG_OWNER]
        const userIsAdmin = adminRoles.includes(org.role)
        setIsAdmin(userIsAdmin)
        
        console.log(`🎯 Set current org to: ${org.organization.name}, role: ${org.role}, isAdmin: ${userIsAdmin}`)
      }
    } catch (err) {
      console.error('❌ Error loading organizations:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const loadMembers = async () => {
    if (!currentOrg) return

    try {
      setMembersLoading(true)
      setError('')
      console.log(`👥 Loading members for organization: ${currentOrg.organization.name}`)
      const response = await fetch(`/api/organizations/${currentOrg.organization.id}/members`)
      
      if (!response.ok) {
        throw new Error('Failed to load members')
      }

      const data = await response.json()
      const activeMembers = (data.clients || []).filter((member: OrgClient) => member.joined_at) // Only show active members
      setMembers(activeMembers)
      console.log(`✅ Loaded ${activeMembers.length} active clients`)
      
    } catch (err) {
      console.error('❌ Error loading members:', err)
      setError(err instanceof Error ? err.message : 'Failed to load clients')
    } finally {
      setMembersLoading(false)
    }
  }

  const loadRepositoriesForMember = async (memberId: string) => {
    if (!currentOrg) return

    try {
      setRepositoriesLoading(true)
      setError('')
      
      // Find the member to get their phone number
      const member = members.find(m => m.id === memberId)
      if (!member) {
        throw new Error('Member not found')
      }
      
      // Get phone from direct phone field or client_profile phone_number
      const memberPhone = member.phone || member.client_profile?.phone_number
      if (!memberPhone) {
        throw new Error('Member does not have a phone number')
      }
      
      const phoneNumber = encodeURIComponent(memberPhone)
      console.log(`📦 Loading repositories for member: ${member.client_profile?.full_name || member.client_profile?.email || 'Unknown'} (phone: ${memberPhone})`)
      
      const response = await fetch(`/api/github/repositories/assignments/phone/${phoneNumber}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load member repositories')
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      setRepositories(data.repositories || [])
      console.log(`✅ Loaded ${data.repositories?.length || 0} repositories for member`)
      
    } catch (err) {
      console.error('❌ Error loading member repositories:', err)
      setError(err instanceof Error ? err.message : 'Failed to load member repositories')
    } finally {
      setRepositoriesLoading(false)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="h-4 w-4 text-yellow-600" />
      case 'admin': return <Shield className="h-4 w-4 text-blue-600" />
      default: return <User className="h-4 w-4 text-gray-600" />
    }
  }

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" => {
    switch (role) {
      case 'owner': return 'default'
      case 'admin': return 'secondary'
      default: return 'outline'
    }
  }

  const handleStartChat = async () => {
    if (!selectedMember) {
      setError('Please select a team member to start a chat.')
      return
    }
    
    if (repositories.length === 0) {
      setError('No repositories available for this member.')
      return
    }
    
    const member = members.find(m => m.id === selectedMember)
    
    if (!member || !currentOrg) {
      setError('Unable to find selected member or organization.')
      return
    }

    // Check if member has a phone number
    const memberPhone = member.phone || member.client_profile?.phone_number
    if (!memberPhone) {
      setError('Selected member does not have a phone number. Phone number is required for web chat.')
      return
    }

    try {
      setCloningInProgress(true)
      setError('')

      if (selectedRepository) {
        // Single repository selected
        const repository = repositories.find(r => r.id === selectedRepository)
        if (!repository) {
          setError('Unable to find selected repository.')
          return
        }

        console.log(`🚀 Starting chat with: ${member.client_profile?.full_name || member.client_profile?.email || 'Unknown'} for repository: ${repository.full_name}`)
        
        // Clone single repository
        const cloneResponse = await fetch('/api/clone-repository', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            repositoryId: repository.id,
            orgId: currentOrg.organization.id,
            memberPhoneNumber: memberPhone,
            branch: undefined // Use default branch
          }),
        });

        const cloneResult = await cloneResponse.json();

        if (!cloneResponse.ok || !cloneResult.success) {
          throw new Error(cloneResult.error || 'Failed to clone repository')
        }

        console.log(`✅ Repository cloned successfully to: ${cloneResult.repositoryPath}`)
        setProjectPath(cloneResult.relativeProjectPath)
      } else {
        // No repository selected - clone all repositories
        console.log(`🚀 Starting chat with: ${member.client_profile?.full_name || member.client_profile?.email || 'Unknown'} for all repositories (${repositories.length} repos)`)
        
        // Clone all repositories individually
        let baseProjectPath = '';
        let successCount = 0;
        const errors: string[] = [];

        for (const repository of repositories) {
          try {
            console.log(`📦 Cloning repository: ${repository.full_name}`)
            
            const cloneResponse = await fetch('/api/clone-repository', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                repositoryId: repository.id,
                orgId: currentOrg.organization.id,
                memberPhoneNumber: memberPhone,
                branch: undefined // Use default branch
              }),
            });

            const cloneResult = await cloneResponse.json();

            if (!cloneResponse.ok || !cloneResult.success) {
              throw new Error(cloneResult.error || `Failed to clone ${repository.name}`)
            }

            successCount++;
            
            // Use the base path (without the specific repo name) for the workspace
            if (!baseProjectPath && cloneResult.relativeProjectPath) {
              // Extract base path by removing the last segment (repo name)
              const pathParts = cloneResult.relativeProjectPath.split('/');
              baseProjectPath = pathParts.slice(0, -1).join('/');
            }
            
            console.log(`✅ Repository ${repository.name} cloned successfully`)
            
          } catch (repositoryError) {
            const errorMsg = repositoryError instanceof Error ? repositoryError.message : `Failed to clone ${repository.name}`
            errors.push(errorMsg)
            console.error(`❌ Error cloning ${repository.name}:`, repositoryError)
          }
        }

        if (successCount === 0) {
          throw new Error(`Failed to clone any repositories:\n${errors.join('\n')}`)
        }

        if (errors.length > 0) {
          console.warn(`⚠️ Some repositories failed to clone: ${errors.length}/${repositories.length}`)
        }

        // Set the base project path for the workspace
        setProjectPath(baseProjectPath || `${currentOrg.organization.id}/${memberPhone}`)
        
        console.log(`✅ Cloned ${successCount}/${repositories.length} repositories successfully`)
      }

      // Show the chat interface once cloning is complete
      setShowWebChat(true)
      
    } catch (err) {
      console.error('❌ Error starting chat:', err)
      setError(err instanceof Error ? err.message : 'Failed to start chat')
    } finally {
      setCloningInProgress(false)
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
              You need to be part of an organization to access web chat.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => router.push('/dashboard')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isAdmin && currentUserData?.isOrgMember) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>
              Web chat for organization members is coming soon. Stay tuned!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!currentUserData?.isOrgAdmin && !currentUserData?.isOrgOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              This page is only available to organization administrators.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show WebChat component when both member and repository are selected
  if (showWebChat) {
    const selectedMemberData = members.find(m => m.id === selectedMember)
    const selectedRepositoryData = repositories.find(r => r.id === selectedRepository)
    
    return (
      <div className="min-h-screen">
        <div className="border-b bg-white">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowWebChat(false)}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Selection
                </Button>
                <MessageSquare className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold">Web Chat</h1>
                  <p className="text-gray-600">
                    {selectedMemberData?.client_profile?.full_name || selectedMemberData?.client_profile?.email} • {selectedRepositoryData?.full_name || `All repositories (${repositories.length})`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  <Github className="h-3 w-3 mr-1" />
                  {selectedRepositoryData?.name || `${repositories.length} repos`}
                </Badge>
                <Badge variant={getRoleBadgeVariant(currentOrg.role)} className="flex items-center gap-1">
                  {getRoleIcon(currentOrg.role)}
                  {currentOrg.role}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        {selectedMemberData && (
          <WebChat 
            orgClient={selectedMemberData} 
            repository={selectedRepositoryData} // Now optional - undefined when multiple repos
            projectPath={projectPath}
            omitDevToMainPushFlow={omitGitWorkflow}
          />
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => router.push('/dashboard')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <MessageSquare className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold">Web Chat</h1>
                <p className="text-gray-600">{currentOrg.organization.name}</p>
              </div>
            </div>
            <Badge variant={getRoleBadgeVariant(currentOrg.role)} className="flex items-center gap-1">
              {getRoleIcon(currentOrg.role)}
              {currentOrg.role}
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Team Member Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Select Team Member
              </CardTitle>
              <CardDescription>
                Choose a team member to start a web chat session with.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
                  <p className="text-gray-600">Loading clients...</p>
                </div>
              ) : members.length > 0 ? (
                <RadioGroup value={selectedMember} onValueChange={setSelectedMember}>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {members.map((member) => (
                      <div key={member.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                        <RadioGroupItem value={member.id} id={member.id} />
                        <Label htmlFor={member.id} className="flex-1 cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm">
                                {member.client_profile?.full_name?.charAt(0) || member.client_profile?.email?.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{member.client_profile?.full_name || 'Unknown'}</p>
                                <p className="text-sm text-gray-600">{member.client_profile?.email || 'No email'}</p>
                                <p className="text-sm text-gray-500 flex items-center">
                                  <Phone className="h-3 w-3 mr-1" />
                                  {member.phone || member.client_profile?.phone_number || 'No phone'}
                                </p>
                              </div>
                            </div>
                            <Badge variant={getRoleBadgeVariant(member.role)} className="flex items-center gap-1 text-xs">
                              {getRoleIcon(member.role)}
                              {member.role}
                            </Badge>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Active Clients</h3>
                  <p>No active clients found in this organization.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Repository Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5" />
                    Select Repository
                  </CardTitle>
                  <CardDescription>
                    {selectedMember 
                      ? "Choose a specific repository (optional) or leave unselected to clone all repositories."
                      : "Select a team member first to see their assigned repositories."
                    }
                  </CardDescription>
                </div>
                {selectedRepository && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedRepository('')
                      toast.success('Repository selection cleared - will clone all repositories')
                    }}
                    className="shrink-0"
                  >
                    Clear Selection
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {selectedMember && (
                <div className="mb-4 space-y-3">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-blue-800">
                      <User className="h-4 w-4" />
                      <span className="font-medium">
                        Showing repositories for: {members.find(m => m.id === selectedMember)?.client_profile?.full_name || members.find(m => m.id === selectedMember)?.client_profile?.email}
                      </span>
                    </div>
                  </div>
                  {repositories.length > 0 && !selectedRepository && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-sm text-green-800">
                        <strong>💡 No repository selected:</strong> All {repositories.length} repositories will be cloned to the workspace
                      </div>
                    </div>
                  )}
                </div>
              )}
              {repositoriesLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
                  <p className="text-gray-600">Loading repositories...</p>
                </div>
              ) : repositories.length > 0 ? (
                <RadioGroup value={selectedRepository} onValueChange={setSelectedRepository}>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {repositories.map((repo) => (
                      <div key={repo.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                        <RadioGroupItem value={repo.id} id={`repo-${repo.id}`} />
                        <Label htmlFor={`repo-${repo.id}`} className="flex-1 cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <Github className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{repo.name}</p>
                                <p className="text-xs text-gray-600">{repo.full_name}</p>
                                {repo.description && (
                                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{repo.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {repo.language && (
                                <Badge variant="outline" className="text-xs">
                                  {repo.language}
                                </Badge>
                              )}
                              <Badge variant={repo.private ? "destructive" : "secondary"} className="text-xs">
                                {repo.private ? "Private" : "Public"}
                              </Badge>
                            </div>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <GitBranch className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {selectedMember ? "No Assigned Repositories" : "No Repositories"}
                  </h3>
                  <p>
                    {selectedMember 
                      ? "The selected member has no repositories assigned to them."
                      : "Select a team member to see their assigned repositories."
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Settings and Action */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Chat Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Git Workflow Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Git Workflow</h4>
                  <p className="text-sm text-gray-600">
                    Automatically commit to dev branch and ask for production deployment
                  </p>
                </div>
                <Switch
                  checked={!omitGitWorkflow}
                  onCheckedChange={(checked) => setOmitGitWorkflow(!checked)}
                />
              </div>

              {/* Start Chat Button */}
              <div className="flex justify-center pt-2">
                <Button 
                  onClick={handleStartChat} 
                  disabled={!selectedMember || repositories.length === 0 || cloningInProgress}
                  className="min-w-48"
                  size="lg"
                >
                  {cloningInProgress ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Preparing Repository...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Start Web Chat Session
                    </>
                  )}
                </Button>
              </div>
              
              {(!selectedMember || repositories.length === 0) && !cloningInProgress && (
                <p className="text-center text-sm text-gray-500">
                  {!selectedMember 
                    ? "Please select a team member to continue"
                    : "No repositories available for the selected member"
                  }
                </p>
              )}
              
              {cloningInProgress && (
                <p className="text-center text-sm text-blue-600">
                  Setting up workspace with structure: {currentOrg?.organization.id}/{(() => {
                    const selectedMemberData = members.find(m => m.id === selectedMember)
                    return selectedMemberData?.phone || selectedMemberData?.client_profile?.phone_number || 'unknown'
                  })()}{selectedRepository ? `/${repositories.find(r => r.id === selectedRepository)?.name}` : ` (${repositories.length} repositories)`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* System Info for Admins */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Organization:</strong> {currentOrg.organization.name}
              </div>
              <div>
                <strong>Your Role:</strong> {currentOrg.role}
              </div>
              <div>
                <strong>Active Clients:</strong> {members.length}
              </div>
              <div>
                <strong>Repositories:</strong> {repositories.length}
              </div>
              <div>
                <strong>Status:</strong> <span className="text-green-600">Admin Access Granted</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
