import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client that can read cookies
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
    // For server components
    const cookieStore = cookies();
    return createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    });
  }
}

// Auth helpers
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
  async createOrganization(name: string, slug: string, userId?: string) {
    let ownerId = userId;
    
    if (!ownerId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      ownerId = user.id;
    }

    const { data, error } = await supabase.rpc('create_organization_with_owner', {
      org_name: name,
      org_slug: slug,
      owner_user_id: ownerId
    });

    return { data, error };
  },

  async getUserOrganizations() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: new Error('User not authenticated') };

    const { data, error } = await supabase
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

  async getOrganizationMembers(organizationId: string) {
    const { data, error } = await supabase
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

  async inviteUserByPhone(organizationId: string, phoneNumber: string, role: 'member' | 'admin' = 'member') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.rpc('invite_user_to_organization', {
      org_id: organizationId,
      phone: phoneNumber,
      inviter_user_id: user.id,
      member_role: role
    });

    return { data, error };
  },

  async updateMemberRole(memberId: string, role: 'member' | 'admin') {
    const { data, error } = await supabase
      .from('organization_members')
      .update({ role })
      .eq('id', memberId)
      .select();

    return { data, error };
  },

  async removeMember(memberId: string) {
    const { data, error } = await supabase
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
    const { data, error } = await supabase
      .from('github_integrations')
      .upsert({
        organization_id: organizationId,
        ...githubData
      })
      .select();

    return { data, error };
  },

  async getOrganizationGitHubIntegrations(organizationId: string) {
    const { data, error } = await supabase
      .from('github_integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    return { data, error };
  },

  async saveRepositories(integrationId: string, repositories: any[]) {
    const repoData = repositories.map(repo => ({
      github_integration_id: integrationId,
      github_repo_id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      private: repo.private,
      html_url: repo.html_url
    }));

    const { data, error } = await supabase
      .from('github_repositories')
      .upsert(repoData, { 
        onConflict: 'github_integration_id,github_repo_id',
        ignoreDuplicates: false 
      })
      .select();

    return { data, error };
  },

  async getOrganizationRepositories(organizationId: string) {
    const { data, error } = await supabase
      .from('github_repositories')
      .select(`
        *,
        github_integration:github_integrations!inner(
          organization_id,
          github_username
        )
      `)
      .eq('github_integration.organization_id', organizationId)
      .eq('is_active', true);

    return { data, error };
  },

  async assignUserToRepository(repositoryId: string, userId: string, role: string = 'developer') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('user_repository_assignments')
      .upsert({
        user_id: userId,
        repository_id: repositoryId,
        assigned_by: user.id,
        role
      })
      .select();

    return { data, error };
  },

  async getUserRepositoryAssignments(userId: string) {
    const { data, error } = await supabase
      .from('user_repository_assignments')
      .select(`
        *,
        repository:github_repositories(
          id,
          name,
          full_name,
          description,
          html_url,
          github_integration:github_integrations(
            github_username,
            organization_id
          )
        )
      `)
      .eq('user_id', userId);

    return { data, error };
  }
};

// Phone verification helpers
export const phoneHelpers = {
  async sendVerificationCode(phoneNumber: string) {
    // This would integrate with your SMS service (Telnyx/Twilio)
    // For now, we'll generate a code and store it in the database
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('users')
      .update({
        phone_verification_code: code,
        phone_verification_expires_at: expiresAt.toISOString()
      })
      .eq('id', user.id);

    if (error) return { success: false, error };

    // TODO: Send SMS with code using your SMS service
    console.log(`Verification code for ${phoneNumber}: ${code}`);
    
    return { success: true, code }; // Remove code from response in production
  },

  async verifyPhoneNumber(code: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('phone_verification_code, phone_verification_expires_at')
      .eq('id', user.id)
      .single();

    if (fetchError || !userData) {
      return { success: false, error: 'User data not found' };
    }

    const now = new Date();
    const expiresAt = new Date(userData.phone_verification_expires_at);

    if (now > expiresAt) {
      return { success: false, error: 'Verification code expired' };
    }

    if (userData.phone_verification_code !== code) {
      return { success: false, error: 'Invalid verification code' };
    }

    // Mark phone as verified
    const { error: updateError } = await supabase
      .from('users')
      .update({
        phone_verified: true,
        phone_verification_code: null,
        phone_verification_expires_at: null
      })
      .eq('id', user.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  }
};

export default supabase;
