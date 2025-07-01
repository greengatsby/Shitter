"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import {
  MessageSquare,
  Users,
  Shield,
  Crown,
  User,
  Loader2,
  ArrowLeft,
  Phone,
  Mail
} from "lucide-react"
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'

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
  invited_at: string | null
  user: {
    id: string
    email: string
    full_name: string | null
    phone_number: string | null
    avatar_url: string | null
  }
  invited_by_user?: {
    id: string
    email: string
    full_name: string | null
  }
}

export default function WebChatPage() {
  const router = useRouter()
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMember, setSelectedMember] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const initializePage = async () => {
      try {
        setLoading(true)
        
        // Check authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          router.push('/auth/signin')
          return
        }

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
        const adminRoles = ['admin', 'owner']
        const userIsAdmin = adminRoles.includes(org.role)
        setIsAdmin(userIsAdmin)
        
        if (!userIsAdmin) {
          setError('Access denied. This page is only available to organization administrators.')
        }
        
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
      console.log(`👥 Loading members for organization: ${currentOrg.organization.name}`)
      const response = await fetch(`/api/organizations/${currentOrg.organization.id}/members`)
      
      if (!response.ok) {
        throw new Error('Failed to load members')
      }

      const data = await response.json()
      const activeMembers = (data.members || []).filter((member: Member) => member.joined_at) // Only show active members
      setMembers(activeMembers)
      console.log(`✅ Loaded ${activeMembers.length} active members`)
      
    } catch (err) {
      console.error('❌ Error loading members:', err)
      setError(err instanceof Error ? err.message : 'Failed to load team members')
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

  const handleStartChat = () => {
    if (!selectedMember) {
      setError('Please select a team member to start a chat.')
      return
    }
    
    const member = members.find(m => m.id === selectedMember)
    if (member) {
      console.log(`🚀 Starting chat with: ${member.user.full_name || member.user.email}`)
      // TODO: Implement chat functionality
      setError('') // Clear any previous errors
      alert(`Chat functionality coming soon! Selected: ${member.user.full_name || member.user.email}`)
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

  if (!isAdmin) {
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
            {members.length > 0 ? (
              <div className="space-y-6">
                <RadioGroup value={selectedMember} onValueChange={setSelectedMember}>
                  <div className="space-y-3">
                    {members.map((member) => (
                      <div key={member.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                        <RadioGroupItem value={member.id} id={member.id} />
                        <Label htmlFor={member.id} className="flex-1 cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                                {member.user.full_name?.charAt(0) || member.user.email.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium">{member.user.full_name || 'Unknown'}</p>
                                <p className="text-sm text-gray-600 flex items-center">
                                  <Mail className="h-3 w-3 mr-1" />
                                  {member.user.email}
                                </p>
                                {member.user.phone_number && (
                                  <p className="text-sm text-gray-500 flex items-center">
                                    <Phone className="h-3 w-3 mr-1" />
                                    {member.user.phone_number}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Badge variant={getRoleBadgeVariant(member.role)} className="flex items-center gap-1">
                              {getRoleIcon(member.role)}
                              {member.role}
                            </Badge>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>

                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleStartChat} 
                    disabled={!selectedMember}
                    className="min-w-32"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Start Chat
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Active Members</h3>
                <p>No active team members found in this organization.</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => router.push('/dashboard')}
                >
                  Go to Dashboard
                </Button>
              </div>
            )}
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
                <strong>Active Members:</strong> {members.length}
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
