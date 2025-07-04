'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/context/useAuth'
import Link from 'next/link'

export default function AuthTestPage() {
  const { 
    user, 
    session, 
    signOut,
    isLoading
  } = useAuth()

  const handleSignOut = async () => {
    await signOut()
  }

  const handleSignIn = async () => {

  }

  const handleTestAuthRoutes = async () => {
    const response = await fetch('/api/auth/test-auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const data = await response.json()
    console.log(data)
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">

      <Button onClick={handleSignOut}>Sign Out</Button>
      <Button asChild>

      <Link href={'/auth/signin'}>Sign In</Link>
      </Button>

      <div>
        <p>Test auth in server routes</p>
        <Button onClick={handleTestAuthRoutes}>
          Test Auth Routes
        </Button>
      </div>

      <hr />

      <p>User: {user?.email}</p>
      <p>Session: {session?.user.id}</p>
      <p>Is Loading: {isLoading ? 'Yes' : 'No'}</p>

      <p>isAuthenticated: {user ? 'Yes' : 'No'}</p>

    </div>
  )
} 