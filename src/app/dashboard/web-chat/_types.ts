export interface Member {
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
  
  export interface Repository {
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