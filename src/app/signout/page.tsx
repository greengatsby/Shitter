"use client"
import { Button } from "@/components/ui/button"
import { supabase } from "@/utils/supabase"

export default function SignOutPage() {
  return (
    <div>
      <h1>Sign Out</h1>
      <Button onClick={async () => {
        await supabase.auth.signOut()
        window.location.href = '/auth/signin'
      }}>
        Sign Out
      </Button>
    </div>
  )
}