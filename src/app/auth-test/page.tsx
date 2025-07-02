'use client'

import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function AuthTestPage() {
  const { 
    user, 
    userProfile, 
    organizationMemberships,
    primaryOrganization,
    organizations,
    session, 
    loading, 
    error, 
    isAuthenticated, 
    hasProfile,
    hasOrganizations,
    isOrgAdmin,
    isOrgOwner,
    signOut,
    refreshOrganizationMemberships
  } = useAuth()

  const handleSignOut = async () => {
    await signOut()
  }

  const handleRefreshMemberships = async () => {
    await refreshOrganizationMemberships()
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle>Authentication Debug</CardTitle>
          <CardDescription>
            Complete authentication state including user profile and organization memberships
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <h3 className="font-semibold text-sm">Loading</h3>
              <p className="text-xs">{loading ? '⏳ Loading...' : '✅ Ready'}</p>
            </div>

            <div className="text-center">
              <h3 className="font-semibold text-sm">Authentication</h3>
              <p className="text-xs">{isAuthenticated ? '✅ Signed In' : '❌ Not Signed In'}</p>
            </div>

            <div className="text-center">
              <h3 className="font-semibold text-sm">Profile</h3>
              <p className="text-xs">{hasProfile ? '✅ Loaded' : '❌ Missing'}</p>
            </div>

            <div className="text-center">
              <h3 className="font-semibold text-sm">Organizations</h3>
              <p className="text-xs">{hasOrganizations ? `✅ ${organizationMemberships?.length} orgs` : '❌ None'}</p>
            </div>
          </div>

          {/* Role Badges */}
          {hasOrganizations && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                👤 Member of {organizationMemberships?.length} org{organizationMemberships?.length !== 1 ? 's' : ''}
              </Badge>
              {isOrgAdmin && <Badge variant="secondary">🛡️ Admin</Badge>}
              {isOrgOwner && <Badge variant="default">👑 Owner</Badge>}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <h3 className="font-semibold text-red-800">Error:</h3>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Primary Organization */}
          {primaryOrganization && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
              <h3 className="font-semibold text-blue-800 mb-2">Primary Organization</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                <div><strong>Name:</strong> {primaryOrganization.organization.name}</div>
                <div><strong>Slug:</strong> {primaryOrganization.organization.slug}</div>
                <div><strong>Role:</strong> <Badge variant="outline">{primaryOrganization.role}</Badge></div>
              </div>
            </div>
          )}

          {/* Data Sections */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Auth User</h3>
                <Badge variant="outline" className="text-xs">Supabase Auth</Badge>
              </div>
              <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-80">
                {user ? JSON.stringify(user, null, 2) : 'null'}
              </pre>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">User Profile</h3>
                <Badge variant="outline" className="text-xs">public.users</Badge>
              </div>
              <pre className="bg-blue-50 p-3 rounded text-xs overflow-auto max-h-80">
                {userProfile ? JSON.stringify(userProfile, null, 2) : 'null'}
              </pre>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Organization Memberships</h3>
                <div className="flex gap-1">
                  <Badge variant="outline" className="text-xs">public.organization_clients</Badge>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 px-2 text-xs"
                    onClick={handleRefreshMemberships}
                    disabled={!isAuthenticated}
                  >
                    🔄
                  </Button>
                </div>
              </div>
              <pre className="bg-green-50 p-3 rounded text-xs overflow-auto max-h-80">
                {organizationMemberships ? JSON.stringify(organizationMemberships, null, 2) : 'null'}
              </pre>
            </div>
          </div>

          {/* Organizations List */}
          {organizations.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Organizations Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {organizations.map((org, index) => {
                  const membership = organizationMemberships?.find(m => m.organization_id === org.id)
                  return (
                    <div key={org.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-medium truncate">{org.name}</h4>
                        <Badge variant="outline" className="text-xs">{membership?.role}</Badge>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">/{org.slug}</p>
                      {org.description && (
                        <p className="text-xs text-gray-500 truncate">{org.description}</p>
                      )}
                      {membership?.joined_at && (
                        <p className="text-xs text-gray-400 mt-1">
                          Joined: {new Date(membership.joined_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Session Data */}
          <div>
            <h3 className="font-semibold mb-2">Session</h3>
            <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40">
              {session ? JSON.stringify(session, null, 2) : 'null'}
            </pre>
          </div>

          {/* Actions */}
          {isAuthenticated && (
            <div className="pt-4 border-t flex gap-2">
              <Button onClick={handleSignOut} variant="outline">
                Sign Out
              </Button>
              <Button onClick={handleRefreshMemberships} variant="secondary" size="sm">
                Refresh Memberships
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 