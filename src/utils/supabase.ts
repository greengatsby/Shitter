import { createClient } from '@supabase/supabase-js';
import { ROLES } from './constants';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Client-side Supabase client (can be used in client components)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth helpers (client-side compatible)
export const authHelpers = {
  isOrgAdminOrOwner(role: string) {
    return role === ROLES.ORG_OWNER || role === ROLES.ORG_ADMIN;
  },

  async signUp(email: string, password: string, metadata: { full_name?: string; phone_number?: string; user_type?: 'org-client' | 'org-admin' } = {}) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          ...metadata,
          user_type: metadata.user_type || 'org-admin' // Default to org-client if not specified
        }
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
    try {
      // Use server-side API to ensure proper cookie handling
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Sign in failed');
      }

      // Return data in the same format as Supabase client
      return {
        data: {
          user: result.user,
          session: result.session
        },
        error: null
      };
    } catch (error) {
      return {
        data: { user: null, session: null },
        error: error instanceof Error ? error : new Error('Sign in failed')
      };
    }
  },

  async signOut() {
    try {
      // Use server-side API to ensure proper cookie handling
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Sign out failed');
      }

      return { error: null };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error('Sign out failed')
      };
    }
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
      owner_auth_user_id: actualUserId
    });

    return { data, error };
  },

  async getUserOrganizations(supabaseClient?: any) {
    const client = supabaseClient || supabase;
    const { data: { user } } = await client.auth.getUser();
    if (!user) return { data: null, error: new Error('User not authenticated') };

    // DEPRECATED: Use getUserOrganizationsNew instead
    const { data, error } = await client
      .from('organization_clients')
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
    // DEPRECATED: Use getOrganizationClients instead
    console.warn('getOrganizationMembers is deprecated. Use getOrganizationClients instead.')
    const client = supabaseClient || supabase;
    const { data, error } = await client
      .from('organization_clients')
      .select(`
        id,
        role,
        phone,
        joined_at,
        invited_at,
        org_client_id,
        client_profile:organization_clients_profile(
          id,
          email,
          full_name,
          phone_number,
          avatar_url,
          auth_user_id
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
    // DEPRECATED: Use updateClientRole instead
    const client = supabaseClient || supabase;
    const { data, error } = await client
      .from('organization_clients')
      .update({ role })
      .eq('id', memberId)
      .select();

    return { data, error };
  },

  async removeMember(memberId: string, supabaseClient?: any) {
    // DEPRECATED: Use removeClient instead
    const client = supabaseClient || supabase;
    const { data, error } = await client
      .from('organization_clients')
      .delete()
      .eq('id', memberId);

    return { data, error };
  },

  // NEW CLIENT MANAGEMENT FUNCTIONS
  
  /**
   * Add a client to an organization by phone number
   * This creates a record in organization_clients with the phone number
   * The org_client_id will be null until they sign up
   */
  async handleAddClientToOrg(organizationId: string, phoneNumber: string, role: 'member' | 'admin' = 'member', supabaseClient?: any) {
    const client = supabaseClient || supabase;
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    try {
      // Only users from users table can invite clients
      // Check if inviter is an org admin user (through users table)
      const { data: orgAdminUser, error: orgAdminError } = await client
        .from('users')
        .select('role, organization_id')
        .eq('id', user.id)
        .eq('organization_id', organizationId)
        .single();

      if (orgAdminError || !orgAdminUser) {
        throw new Error('You are not a member of this organization');
      }

      // Check if they have permission to invite clients
      if (!authHelpers.isOrgAdminOrOwner(orgAdminUser.role)) {
        throw new Error('Insufficient permissions to invite clients');
      }

      // Check if a client with this phone number already exists in this organization
      const { data: existingClient, error: existingError } = await client
        .from('organization_clients')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('phone', phoneNumber)
        .single();

      if (existingClient) {
        throw new Error('A client with this phone number is already in this organization');
      }

      // Create the new organization client record
      // Note: invited_by will store the user.id (not a client profile id) since only users can invite
      const { data: newClient, error: clientError } = await client
        .from('organization_clients')
        .insert({
          organization_id: organizationId,
          phone: phoneNumber,
          role: role,
          invited_by: user.id, // Store the inviter's user ID
          invited_at: new Date().toISOString(),
          org_client_id: null // Will be set when they sign up
        })
        .select(`
          id,
          phone,
          role,
          invited_at,
          created_at,
          organization:organizations(name)
        `)
        .single();

      if (clientError) {
        throw new Error(`Failed to create client: ${clientError.message}`);
      }

      return { data: newClient, error: null };
    } catch (err) {
      console.error('Error adding client to organization:', err);
      return { data: null, error: err instanceof Error ? err : new Error('Unknown error') };
    }
  },

  /**
   * Get organization clients (updated for new table structure)
   */
  async getOrganizationClients(organizationId: string, supabaseClient?: any) {
    const client = supabaseClient || supabase;
    const { data, error } = await client
      .from('organization_clients')
      .select(`
        id,
        role,
        phone,
        joined_at,
        invited_at,
        created_at,
        org_client_id,
              client_profile:organization_clients_profile(
        id,
        email,
        full_name,
        phone_number,
        avatar_url,
        auth_user_id
      )
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    return { data, error };
  },

  /**
   * Update client role
   */
  async updateClientRole(clientId: string, role: 'member' | 'admin', supabaseClient?: any) {
    const client = supabaseClient || supabase;
    const { data, error } = await client
      .from('organization_clients')
      .update({ role })
      .eq('id', clientId)
      .select();

    return { data, error };
  },

  /**
   * Remove client from organization
   */
  async removeClient(clientId: string, supabaseClient?: any) {
    const client = supabaseClient || supabase;
    const { data, error } = await client
      .from('organization_clients')
      .delete()
      .eq('id', clientId);

    return { data, error };
  },

  /**
   * Get user's organizations for org admin users (direct relationship through users table)
   */
  async getOrganizationOrgAdminUser(supabaseClient?: any) {
    const client = supabaseClient || supabase;
    const { data: { user } } = await client.auth.getUser();
    if (!user) return { data: null, error: new Error('User not authenticated') };

    const { data, error } = await client
      .from('users')
      .select(`
        id,
        role,
        created_at,
        organization:organizations!users_organization_id_fkey(
          id,
          name,
          slug,
          description,
          created_at
        )
      `)
      .eq('id', user.id)
      .not('organization_id', 'is', null);

    if (error) {
      console.error('Error fetching org admin user organizations:', error);
      return { data: [], error: error };
    }

    // Transform the data to match the expected format
    if (data && data.length > 0) {
      const transformedData = data.map((item: any) => ({
        id: item.id,
        role: item.role, // 'org-owner' or 'org-admin'
        joined_at: item.created_at,
        organization: item.organization
      }));
      return { data: transformedData, error: null };
    }

    return { data: [], error: null };
  },

  /**
   * Get user's organizations for client users (through organization_clients system)
   */
  async getOrganizationClientUser(supabaseClient?: any) {
    const client = supabaseClient || supabase;
    const { data: { user } } = await client.auth.getUser();
    if (!user) return { data: null, error: new Error('User not authenticated') };

    // First get the user's client profile
    const { data: clientProfile, error: profileError } = await client
      .from('organization_clients_profile')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError) {
      return { data: [], error: null }; // User has no client profile yet
    }

    const { data, error } = await client
      .from('organization_clients')
      .select(`
        id,
        role,
        joined_at,
        phone,
        organization:organizations(
          id,
          name,
          slug,
          description,
          created_at
        )
      `)
      .eq('org_client_id', clientProfile.id);

    return { data, error };
  },

  /**
   * Get user's organizations (combined approach for both org admin and client users)
   * Prioritizes org admin users since they can perform administrative actions like inviting clients
   */
  async getUserOrganizationsCombined(supabaseClient?: any) {
    const client = supabaseClient || supabase;
    
    // First try to get organizations as an org admin user (can invite clients)
    const { data: adminOrgs, error: adminError } = await this.getOrganizationOrgAdminUser(client);
    
    if (adminOrgs && adminOrgs.length > 0) {
      return { data: adminOrgs, error: null };
    }
    
    // If no admin organizations found, try to get as a client user (limited permissions)
    const { data: clientOrgs, error: clientError } = await this.getOrganizationClientUser(client);
    
    if (clientOrgs && clientOrgs.length > 0) {
      return { data: clientOrgs, error: null };
    }
    
    // Return empty array if no organizations found in either system
    if (adminError && clientError) {
      console.error('Both admin and client organization lookups failed:', { adminError, clientError });
      return { data: [], error: clientError };
    }
    
    return { data: [], error: null };
  }
};

// GitHub integration helpers
export const githubHelpers = {
  // ===========================================
  // DATABASE OPERATIONS (Our Supabase Database)
  // ===========================================

  /**
   * Save GitHub App installation data to database
   */
  async saveInstallationToDatabase(organizationId: string | null, installationData: {
    installation_id: number;
    app_id: number;
    app_slug: string;
    account_id: number;
    account_login: string;
    account_type: string;
    account_avatar_url?: string;
    permissions?: any;
    events?: string[];
    repository_selection?: string;
    repositories_count?: number;
  }) {
    const { data, error } = await supabase
      .rpc('upsert_github_installation', {
        p_installation_id: installationData.installation_id,
        p_app_id: installationData.app_id,
        p_app_slug: installationData.app_slug,
        p_account_id: installationData.account_id,
        p_account_login: installationData.account_login,
        p_account_type: installationData.account_type,
        p_account_avatar_url: installationData.account_avatar_url,
        p_permissions: installationData.permissions || {},
        p_events: installationData.events || [],
        p_repository_selection: installationData.repository_selection || 'all',
        p_repositories_count: installationData.repositories_count || 0,
        p_organization_id: organizationId || null
      });

    return { data, error };
  },

  /**
   * Get GitHub App installations from database for an organization
   */
  async getInstallationsFromDatabase(organizationId: string) {
    const { data, error } = await supabase
      .from('github_app_installations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    return { data, error };
  },

  /**
   * Get specific GitHub App installation from database by ID
   */
  async getInstallationFromDatabase(installationId: number) {
    const { data, error } = await supabase
      .from('github_app_installations')
      .select('*')
      .eq('installation_id', installationId)
      .single();

    return { data, error };
  },

  /**
   * Suspend GitHub App installation in database
   */
  async suspendInstallationInDatabase(installationId: number, suspendedBy?: string) {
    const { data, error } = await supabase
      .from('github_app_installations')
      .update({ 
        is_active: false, 
        suspended_at: new Date().toISOString(),
        suspended_by: suspendedBy 
      })
      .eq('installation_id', installationId);

    return { data, error };
  },

  /**
   * Completely delete GitHub App installation from database
   * This will CASCADE DELETE all related repositories and assignments
   */
  async deleteInstallationFromDatabase(installationId: number) {
    console.log(`🗑️  Completely deleting installation ${installationId} from database`);
    
    try {
      // First get the installation to log what we're deleting
      const { data: installation } = await supabase
        .from('github_app_installations')
        .select('account_login, repositories_count')
        .eq('installation_id', installationId)
        .single();

      if (installation) {
        console.log(`📋 Deleting installation for ${installation.account_login} with ${installation.repositories_count} repositories`);
      }

      // Delete the installation - this will CASCADE DELETE all related:
      // - github_repositories (via FK constraint)
      // - user_repository_assignments (via FK from repositories)
      const { data, error } = await supabase
        .from('github_app_installations')
        .delete()
        .eq('installation_id', installationId);

      if (error) {
        console.error('❌ Error deleting installation:', error);
        return { data: null, error };
      }

      console.log(`✅ Successfully deleted installation ${installationId} and all related data`);
      return { data, error: null };
    } catch (err) {
      console.error('💥 Exception during installation deletion:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Link installation to organization in database
   */
  async linkInstallationToOrganizationInDatabase(installationId: number, organizationId: string) {
    // First, check if the installation exists and get its current organization_id
    const { data: installation, error: fetchError } = await supabase
      .from('github_app_installations')
      .select('organization_id')
      .eq('installation_id', installationId)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching installation:', fetchError);
      return { data: null, error: fetchError };
    }

    // Check if already linked to an organization (not null and not the string "null")
    if (installation?.organization_id && installation.organization_id !== 'null') {
      return { 
        data: null, 
        error: { 
          message: 'Installation is already linked to an organization',
          code: 'ALREADY_LINKED' 
        } 
      };
    }

    // Update the installation - this handles both NULL and string "null" cases
    const { data, error } = await supabase
      .from('github_app_installations')
      .update({ organization_id: organizationId })
      .eq('installation_id', installationId);

    return { data, error };
  },

  /**
   * Get pending installations from database (not linked to any organization)
   */
  async getPendingInstallationsFromDatabase() {
    // Query installations that are either NULL or the string "null" for organization_id
    const { data, error } = await supabase
      .from('github_app_installations')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    // Filter out installations that have a valid organization_id (not null and not "null")
    const pendingInstallations = data?.filter(installation => 
      !installation.organization_id || installation.organization_id === 'null'
    ) || [];

    return { data: pendingInstallations, error: null };
  },

  /**
   * Save repositories to database for an installation
   */
  async saveRepositoriesToDatabase(installationId: number, repositories: any[]) {
    console.log(`💾 Syncing ${repositories.length} repositories for installation ${installationId}`);
    
    try {
      // Step 1: Get existing repositories in database for this installation
      const { data: existingRepos, error: fetchError } = await supabase
        .from('github_repositories')
        .select('github_repo_id, id, full_name')
        .eq('installation_id', installationId);

      if (fetchError) {
        console.error('❌ Error fetching existing repositories:', fetchError);
        throw fetchError;
      }

      console.log(`📋 Found ${existingRepos?.length || 0} existing repositories in database`);

      // Step 2: Identify repositories to delete (exist in DB but not in GitHub)
      const currentGitHubRepoIds = new Set(repositories.map(repo => repo.id));
      const existingRepoIds = new Set(existingRepos?.map(repo => repo.github_repo_id) || []);
      
      const reposToDelete = existingRepos?.filter(repo => !currentGitHubRepoIds.has(repo.github_repo_id)) || [];
      
      console.log(`🗑️  Found ${reposToDelete.length} repositories to delete:`, reposToDelete.map(r => r.full_name));

      // Step 3: Delete repositories that no longer exist in GitHub
      if (reposToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('github_repositories')
          .delete()
          .eq('installation_id', installationId)
          .in('github_repo_id', reposToDelete.map(repo => repo.github_repo_id));

        if (deleteError) {
          console.error('❌ Error deleting repositories:', deleteError);
          throw deleteError;
        }

        console.log(`✅ Successfully deleted ${reposToDelete.length} repositories from database`);
      }

      // Step 4: Handle case where no repositories exist in GitHub (empty installation)
      if (!repositories || repositories.length === 0) {
        console.log('⚠️  No repositories in GitHub installation - sync completed');
        return { data: [], error: null };
      }

      // Step 5: Prepare repository data for database
      const repoData = repositories.map(repo => ({
        installation_id: installationId,
        github_repo_id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        private: repo.private,
        html_url: repo.html_url,
        language: repo.language,
        default_branch: repo.default_branch || 'main',
        clone_url: repo.clone_url,
        ssh_url: repo.ssh_url,
        size_kb: repo.size,
        archived: repo.archived || false,
        disabled: repo.disabled || false,
        pushed_at: repo.pushed_at,
        permissions: repo.permissions || {},
        is_active: true
      }));

      console.log(`📝 Prepared ${repoData.length} repositories for upsert`);

      // Step 6: Upsert current repositories
      const { data, error } = await supabase
        .from('github_repositories')
        .upsert(repoData, { 
          onConflict: 'installation_id,github_repo_id',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        console.error('❌ Database error upserting repositories:', error);
        throw error;
      }

      const newRepos = data?.filter(repo => !existingRepoIds.has(repo.github_repo_id)) || [];
      const updatedRepos = data?.filter(repo => existingRepoIds.has(repo.github_repo_id)) || [];

      console.log(`✅ Repository sync completed:`);
      console.log(`   - Added: ${newRepos.length} repositories`);
      console.log(`   - Updated: ${updatedRepos.length} repositories`);
      console.log(`   - Deleted: ${reposToDelete.length} repositories`);
      console.log(`   - Total: ${data?.length || 0} repositories in database`);

      return { data, error: null };
    } catch (err) {
      console.error('💥 Exception during repository sync:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Remove specific repositories from database for an installation
   */
  async removeRepositoriesFromDatabase(installationId: number, repositoriesToRemove: Array<{ id: number; name: string; full_name: string }>) {
    console.log(`🗑️  Removing ${repositoriesToRemove.length} repositories from installation ${installationId}`);
    
    try {
      const githubRepoIds = repositoriesToRemove.map(repo => repo.id);
      
      // Delete the repositories from the database
      const { data, error } = await supabase
        .from('github_repositories')
        .delete()
        .eq('installation_id', installationId)
        .in('github_repo_id', githubRepoIds)
        .select('id, full_name');

      if (error) {
        console.error('❌ Error removing repositories:', error);
        return { data: null, error };
      }

      console.log(`✅ Successfully removed ${data?.length || 0} repositories from database:`,
                  data?.map(r => r.full_name) || []);
      
      return { data, error: null };
    } catch (err) {
      console.error('💥 Exception during repository removal:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Get repositories from database for an organization
   */
  async getRepositoriesFromDatabase(organizationId: string) {
    console.log('🚀 Getting repositories from database for organization:', organizationId);
    
    // First, let's see what installations exist for this org
    const { data: installations } = await supabase
      .from('github_app_installations')
      .select('installation_id, account_login, organization_id, is_active')
      .eq('organization_id', organizationId);
    
    console.log('📋 Installations for org:', installations);
    
    // Then let's see all repositories regardless of installation
    const { data: allRepos } = await supabase
      .from('github_repositories')
      .select('installation_id, name, full_name, is_active');
    
    console.log('📦 All repositories in database:', allRepos);
    
    const { data, error } = await supabase
      .from('github_repositories')
      .select(`
        *,
        installation:github_app_installations!inner(
          organization_id,
          account_login,
          account_type,
          account_avatar_url,
          installation_id,
          is_active
        )
      `)
      .eq('installation.organization_id', organizationId)
      .eq('installation.is_active', true)
      .eq('is_active', true);

    if (error) {
      console.error('❌ Error fetching repositories from database:', error);
    }

    console.log('🔍 Found repositories in database after join:', data?.length || 0, data);
    return { data, error };
  },

  /**
   * Get repository from database by ID
   */
  async getRepositoryFromDatabase(repositoryId: string) {
    const { data, error } = await supabase
      .from('github_repositories')
      .select(`
        *,
        installation:github_app_installations(*)
      `)
      .eq('id', repositoryId)
      .single();

    return { data, error };
  },

  /**
   * Get repository from database by GitHub repo ID and installation
   */
  async getRepositoryFromDatabaseByGitHubId(githubRepoId: number, installationId: number) {
    const { data, error } = await supabase
      .from('github_repositories')
      .select('*')
      .eq('github_repo_id', githubRepoId)
      .eq('installation_id', installationId)
      .single();

    return { data, error };
  },

  // ===========================================
  // USER REPOSITORY ASSIGNMENTS (Database)
  // ===========================================

  /**
   * Assign user to repository in database
   */
  async assignUserToRepositoryInDatabase(repositoryId: string, userId: string, assignedBy: string, role: string = 'developer') {
    const { data, error } = await supabase
      .from('user_repository_assignments')
      .upsert({
        repository_id: repositoryId,
        user_id: userId,
        assigned_by: assignedBy,
        role: role,
        permissions: ['read', 'write'] // Default permissions
      }, {
        onConflict: 'user_id,repository_id',
        ignoreDuplicates: false
      })
      .select();

    return { data, error };
  },

  /**
   * Remove user from repository in database
   */
  async removeUserFromRepositoryInDatabase(repositoryId: string, userId: string) {
    const { data, error } = await supabase
      .from('user_repository_assignments')
      .delete()
      .eq('repository_id', repositoryId)
      .eq('user_id', userId);

    return { data, error };
  },

  /**
   * Get user repository assignments from database
   */
  async getUserRepositoryAssignmentsFromDatabase(userId: string) {
    const { data, error } = await supabase
      .from('user_repository_assignments')
      .select(`
        *,
        repository:github_repositories(
          *,
          installation:github_app_installations(
            account_login,
            organization_id,
            installation_id
          )
        )
      `)
      .eq('user_id', userId);

    return { data, error };
  },

  /**
   * Get repository assignments from database
   */
  async getRepositoryAssignmentsFromDatabase(repositoryId: string) {
    const { data, error } = await supabase
      .from('user_repository_assignments')
      .select(`
        *,
        user:users(
          id,
          email,
          full_name,
          phone_number,
          avatar_url
        ),
        assigned_by_user:users!assigned_by(
          id,
          email,
          full_name
        )
      `)
      .eq('repository_id', repositoryId);

    return { data, error };
  },

  // ===========================================
  // WEBHOOK LOGGING (Database)
  // ===========================================

  /**
   * Log webhook delivery to database
   */
  async logWebhookDeliveryToDatabase(webhookData: {
    delivery_id: string;
    event_type: string;
    action?: string;
    installation_id?: number;
    payload: any;
    headers?: any;
  }) {
    const { data, error } = await supabase
      .rpc('log_github_webhook', {
        p_delivery_id: webhookData.delivery_id,
        p_event_type: webhookData.event_type,
        p_action: webhookData.action,
        p_installation_id: webhookData.installation_id,
        p_payload: webhookData.payload,
        p_headers: webhookData.headers
      });

    return { data, error };
  },

  /**
   * Mark webhook as processed in database
   */
  async markWebhookProcessedInDatabase(deliveryId: string, errorMessage?: string) {
    const { data, error } = await supabase
      .from('github_webhook_deliveries')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        error_message: errorMessage
      })
      .eq('delivery_id', deliveryId);

    return { data, error };
  },

  /**
   * Get unprocessed webhooks from database
   */
  async getUnprocessedWebhooksFromDatabase(limit: number = 50) {
    const { data, error } = await supabase
      .from('github_webhook_deliveries')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(limit);

    return { data, error };
  },

  /**
   * Get webhook deliveries from database
   */
  async getWebhookDeliveriesFromDatabase(installationId?: number, eventType?: string, limit: number = 100) {
    let query = supabase
      .from('github_webhook_deliveries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (installationId) {
      query = query.eq('installation_id', installationId);
    }
    
    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    return query;
  },

  // ===========================================
  // DEPRECATED METHODS (For backward compatibility)
  // ===========================================

  /** @deprecated Use saveInstallationToDatabase instead */
  async saveGitHubInstallation(organizationId: string | null, installationData: any) {
    console.warn('⚠️  saveGitHubInstallation is deprecated. Use saveInstallationToDatabase instead.');
    return this.saveInstallationToDatabase(organizationId, installationData);
  },

  /** @deprecated Use getInstallationsFromDatabase instead */
  async getOrganizationGitHubInstallations(organizationId: string) {
    console.warn('⚠️  getOrganizationGitHubInstallations is deprecated. Use getInstallationsFromDatabase instead.');
    return this.getInstallationsFromDatabase(organizationId);
  },

  /** @deprecated Use getInstallationFromDatabase instead */
  async getGitHubInstallationById(installationId: number) {
    console.warn('⚠️  getGitHubInstallationById is deprecated. Use getInstallationFromDatabase instead.');
    return this.getInstallationFromDatabase(installationId);
  },

  /** @deprecated Use suspendInstallationInDatabase instead */
  async suspendGitHubInstallation(installationId: number, suspendedBy?: string) {
    console.warn('⚠️  suspendGitHubInstallation is deprecated. Use suspendInstallationInDatabase instead.');
    return this.suspendInstallationInDatabase(installationId, suspendedBy);
  },

  /** @deprecated Use linkInstallationToOrganizationInDatabase instead */
  async linkInstallationToOrganization(installationId: number, organizationId: string) {
    console.warn('⚠️  linkInstallationToOrganization is deprecated. Use linkInstallationToOrganizationInDatabase instead.');
    return this.linkInstallationToOrganizationInDatabase(installationId, organizationId);
  },

  /** @deprecated Use getPendingInstallationsFromDatabase instead */
  async getPendingInstallations() {
    console.warn('⚠️  getPendingInstallations is deprecated. Use getPendingInstallationsFromDatabase instead.');
    return this.getPendingInstallationsFromDatabase();
  },

  /** @deprecated Use saveRepositoriesToDatabase instead */
  async saveRepositoriesForInstallation(installationId: number, repositories: any[]) {
    console.warn('⚠️  saveRepositoriesForInstallation is deprecated. Use saveRepositoriesToDatabase instead.');
    return this.saveRepositoriesToDatabase(installationId, repositories);
  },

  /** @deprecated Use getRepositoriesFromDatabase instead */
  async getOrganizationRepositories(organizationId: string) {
    console.warn('⚠️  getOrganizationRepositories is deprecated. Use getRepositoriesFromDatabase instead.');
    return this.getRepositoriesFromDatabase(organizationId);
  },

  /** @deprecated Use getRepositoryFromDatabase instead */
  async getRepositoryById(repositoryId: string) {
    console.warn('⚠️  getRepositoryById is deprecated. Use getRepositoryFromDatabase instead.');
    return this.getRepositoryFromDatabase(repositoryId);
  },

  /** @deprecated Use getRepositoryFromDatabaseByGitHubId instead */
  async getRepositoryByGitHubId(githubRepoId: number, installationId: number) {
    console.warn('⚠️  getRepositoryByGitHubId is deprecated. Use getRepositoryFromDatabaseByGitHubId instead.');
    return this.getRepositoryFromDatabaseByGitHubId(githubRepoId, installationId);
  },

  /** @deprecated Use assignUserToRepositoryInDatabase instead */
  async assignUserToRepository(repositoryId: string, userId: string, assignedBy: string, role: string = 'developer') {
    console.warn('⚠️  assignUserToRepository is deprecated. Use assignUserToRepositoryInDatabase instead.');
    return this.assignUserToRepositoryInDatabase(repositoryId, userId, assignedBy, role);
  },

  /** @deprecated Use removeUserFromRepositoryInDatabase instead */
  async removeUserFromRepository(repositoryId: string, userId: string) {
    console.warn('⚠️  removeUserFromRepository is deprecated. Use removeUserFromRepositoryInDatabase instead.');
    return this.removeUserFromRepositoryInDatabase(repositoryId, userId);
  },

  /** @deprecated Use getUserRepositoryAssignmentsFromDatabase instead */
  async getUserRepositoryAssignments(userId: string) {
    console.warn('⚠️  getUserRepositoryAssignments is deprecated. Use getUserRepositoryAssignmentsFromDatabase instead.');
    return this.getUserRepositoryAssignmentsFromDatabase(userId);
  },

  /** @deprecated Use getRepositoryAssignmentsFromDatabase instead */
  async getRepositoryAssignments(repositoryId: string) {
    console.warn('⚠️  getRepositoryAssignments is deprecated. Use getRepositoryAssignmentsFromDatabase instead.');
    return this.getRepositoryAssignmentsFromDatabase(repositoryId);
  },

  /** @deprecated Use logWebhookDeliveryToDatabase instead */
  async logWebhookDelivery(webhookData: any) {
    console.warn('⚠️  logWebhookDelivery is deprecated. Use logWebhookDeliveryToDatabase instead.');
    return this.logWebhookDeliveryToDatabase(webhookData);
  },

  /** @deprecated Use markWebhookProcessedInDatabase instead */
  async markWebhookProcessed(deliveryId: string, errorMessage?: string) {
    console.warn('⚠️  markWebhookProcessed is deprecated. Use markWebhookProcessedInDatabase instead.');
    return this.markWebhookProcessedInDatabase(deliveryId, errorMessage);
  },

  /** @deprecated Use getUnprocessedWebhooksFromDatabase instead */
  async getUnprocessedWebhooks(limit: number = 50) {
    console.warn('⚠️  getUnprocessedWebhooks is deprecated. Use getUnprocessedWebhooksFromDatabase instead.');
    return this.getUnprocessedWebhooksFromDatabase(limit);
  },

  /** @deprecated Use getWebhookDeliveriesFromDatabase instead */
  async getWebhookDeliveries(installationId?: number, eventType?: string, limit: number = 100) {
    console.warn('⚠️  getWebhookDeliveries is deprecated. Use getWebhookDeliveriesFromDatabase instead.');
    return this.getWebhookDeliveriesFromDatabase(installationId, eventType, limit);
  },

  /** @deprecated Use removeRepositoriesFromDatabase instead */
  async removeRepositoriesForInstallation(installationId: number, repositories: any[]) {
    console.warn('⚠️  removeRepositoriesForInstallation is deprecated. Use removeRepositoriesFromDatabase instead.');
    return this.removeRepositoriesFromDatabase(installationId, repositories);
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
