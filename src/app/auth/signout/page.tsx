'use client'

import { useEffect } from 'react'
import { useAuth } from '@/context/useAuth'
import { useRouter } from 'next/navigation'

export default function SignOutPage() {
  const { signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const performSignOut = async () => {
      try {
        await signOut()
        router.push('/auth/signin') // Redirect to sign in page after signing out
      } catch (error) {
        console.error('Error signing out:', error)
        // Still redirect to sign in even if there's an error
        router.push('/auth/signin')
      }
    }

    performSignOut()
  }, [signOut, router])

  return (
    <div className="container mx-auto p-4 flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Signing out...</h1>
        <p className="text-gray-600">Please wait while we sign you out.</p>
      </div>
    </div>
  )
}
