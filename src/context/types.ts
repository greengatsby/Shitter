import { User, Session } from '@supabase/supabase-js';


export interface AuthContextType {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    profileComplete: boolean;
    signOut: () => Promise<void>;
    organizationId: string | null;
  } 