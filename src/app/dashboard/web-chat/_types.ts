export interface OrgClient {
    id: string
    role: string
    joined_at: string
    invited_at: string | null
    phone: string | null
    org_client_id: string | null
    client_profile?: {
      id: string
      email: string
      full_name: string | null
      phone_number: string | null
      avatar_url: string | null
      auth_user_id: string
    }
    invited_by_profile?: {
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