import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Client-side Supabase client (can be used in client components)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client factory (for use in Server Components and API routes)
export function createServerSupabaseClient(request?: NextRequest) {
  if (request) {
    // For API routes with request object
    return createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          // We don't set cookies in API routes
        },
        remove(name: string, options: any) {
          // We don't remove cookies in API routes
        },
      },
    });
  } else {
    // For server components - this should be imported separately
    throw new Error('Use createServerSupabaseClientWithCookies for Server Components');
  }
}

// Auth helpers (client-side compatible)
export const authHelpers = {
  async signUp(email: string, password: string, metadata: { full_name?: string; phone_number?: string } = {}) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });
    
    if (data.user && !error) {
      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email: data.user.email!,
          full_name: metadata.full_name,
          phone_number: metadata.phone_number
        });
      
      if (profileError) {
        console.error('Error creating user profile:', profileError);
      }
    }
    
    return { data, error };
  },

  async signIn(email: string, password: string) {
    return await supabase.auth.signInWithPassword({ email, password });
  },

  async signOut() {
    return await supabase.auth.signOut();
  },

  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },

  async resetPassword(email: string) {
    return await supabase.auth.resetPasswordForEmail(email);
  }
};

// Organization management helpers
export const organizationHelpers = {
  async createOrganization(name: string, slug: string, userId?: string, supabaseClient?: any) {
    const client = supabaseClient || supabase;
    const { data: { user } } = await client.auth.getUser();
    if (!user && !userId) throw new Error('User not authenticated');

    const actualUserId = userId || user.id;

    const { data, error } = await client.rpc('create_organization_with_owner', {
      org_name: name,
      org_slug: slug,
      owner_user_id: actualUserId
    });

    return { data, error };
  },

  async getUserOrganizations(supabaseClient?: any) {
    const client = supabaseClient || supabase;
    const { data: { user } } = await client.auth.getUser();
    if (!user) return { data: null, error: new Error('User not authenticated') };

    const { data, error } = await client
      .from('organization_members')
      .select(`
        id,
        role,
        joined_at,
        organization:organizations(
          id,
          name,
          slug,
          description,
          created_at
        )
      `)
      .eq('user_id', user.id);

    return { data, error };
  },

  async getOrganizationMembers(organizationId: string, supabaseClient?: any) {
    const client = supabaseClient || supabase;
    const { data, error } = await client
      .from('organization_members')
      .select(`
        id,
        role,
        joined_at,
        invited_at,
        user:users(
          id,
          email,
          full_name,
          phone_number,
          avatar_url
        )
      `)
      .eq('organization_id', organizationId)
      .order('joined_at', { ascending: false });

    return { data, error };
  },

  async inviteUserByPhone(organizationId: string, phoneNumber: string, role: 'member' | 'admin' = 'member', supabaseClient?: any) {
    const client = supabaseClient || supabase;
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await client.rpc('invite_user_to_organization', {
      org_id: organizationId,
      phone: phoneNumber,
      inviter_user_id: user.id,
      member_role: role
    });

    return { data, error };
  },

  async updateMemberRole(memberId: string, role: 'member' | 'admin', supabaseClient?: any) {
    const client = supabaseClient || supabase;
    const { data, error } = await client
      .from('organization_members')
      .update({ role })
      .eq('id', memberId)
      .select();

    return { data, error };
  },

  async removeMember(memberId: string, supabaseClient?: any) {
    const client = supabaseClient || supabase;
    const { data, error } = await client
      .from('organization_members')
      .delete()
      .eq('id', memberId);

    return { data, error };
  }
};

// GitHub integration helpers
export const githubHelpers = {
  async saveGitHubIntegration(organizationId: string, githubData: {
    github_user_id: number;
    github_username: string;
    access_token: string;
  }) {
    // Get the current user's ID
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('github_integrations')
      .insert({
        organization_id: organizationId,
        user_id: user.id,
        github_user_id: githubData.github_user_id,
        github_username: githubData.github_username,
        access_token: githubData.access_token
      })
      .select()
      .single();

    return { data, error };
  },

  async getOrganizationGitHubIntegrations(organizationId: string) {
    const { data, error } = await supabase
      .from('github_integrations')
      .select('*')
      .eq('organization_id', organizationId);

    return { data, error };
  },

  async disconnectGitHubIntegration(integrationId: string) {
    const { data, error } = await supabase
      .from('github_integrations')
      .delete()
      .eq('id', integrationId);

    return { data, error };
  },

  async saveRepositories(integrationId: string, repositories: any[]) {
    // First, remove existing repositories for this integration
    await supabase
      .from('github_repositories')
      .delete()
      .eq('integration_id', integrationId);

    // Then insert new repositories
    const repositoryData = repositories.map(repo => ({
      integration_id: integrationId,
      github_repo_id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      html_url: repo.html_url,
      description: repo.description,
      language: repo.language,
      default_branch: repo.default_branch
    }));

    const { data, error } = await supabase
      .from('github_repositories')
      .insert(repositoryData)
      .select();

    return { data, error };
  },

  async getOrganizationRepositories(organizationId: string) {
    const { data, error } = await supabase
      .from('github_repositories')
      .select(`
        *,
        integration:github_integrations!inner(
          organization_id,
          github_username
        )
      `)
      .eq('integration.organization_id', organizationId);

    return { data, error };
  },

  async assignUserToRepository(repositoryId: string, userId: string, role: string = 'developer') {
    const { data, error } = await supabase
      .from('repository_assignments')
      .insert({
        repository_id: repositoryId,
        user_id: userId,
        role: role
      })
      .select()
      .single();

    if (error && error.code === '23505') { // Unique constraint violation
      // Update existing assignment
      const { data: updateData, error: updateError } = await supabase
        .from('repository_assignments')
        .update({ role })
        .eq('repository_id', repositoryId)
        .eq('user_id', userId)
        .select()
        .single();

      return { data: updateData, error: updateError };
    }

    return { data, error };
  },

  async getUserRepositoryAssignments(userId: string) {
    const { data, error } = await supabase
      .from('repository_assignments')
      .select(`
        *,
        repository:github_repositories(
          *,
          integration:github_integrations(
            github_username,
            organization_id
          )
        )
      `)
      .eq('user_id', userId);

    return { data, error };
  }
};

// SMS verification helpers
export const smsHelpers = {
  async sendVerificationCode(phoneNumber: string) {
    try {
      const response = await fetch('/api/sms/send-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error sending verification code:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async verifyPhoneNumber(code: string) {
    try {
      const response = await fetch('/api/sms/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify phone number');
      }

      // Update user profile with verified phone number
      if (data.phoneNumber) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('users')
            .update({ 
              phone_number: data.phoneNumber,
              phone_verified: true 
            })
            .eq('id', user.id);
        }
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error verifying phone number:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
};
