"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { AuthContextType } from "./types";
import { DatabaseError } from "@/utils/errors";
import { ROLES } from "@/utils/constants";

// If AuthContextType is not in ../types/auth, or doesn't include fullName, define/update it here.
// For this example, I'll assume it needs fullName:
interface ExtendedAuthContextType extends AuthContextType {
  fullName: string | null;
  currentUserData: {
    isOrgOwner: boolean;
    isOrgMember: boolean;
    isOrgAdmin: boolean;
  }
}

// Create context with default values - uses the imported AuthContextType
const AuthContext = createContext<ExtendedAuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  profileComplete: false,
  signOut: async () => { },
  organizationId: null,
  currentUserData: {
    isOrgOwner: false,
    isOrgMember: false,
    isOrgAdmin: false,
  },
  fullName: null,
});

// Simple AuthProvider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const [error, setError] = useState<DatabaseError | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const initialLoadComplete = useRef(false);
  const [currentUserData, setCurrentUserData] = useState<any | null>(null);

  // Create the client once per hook instance
  const supabase = useRef(createClient()).current;

  const fetchUserProfile = async (userId: string): Promise<boolean> => {
    try {
      const { data, error: fetchError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (fetchError) {
        setProfileComplete(false);
        setOrganizationId(null);
        setFullName(null);
        return false;
      }

      console.log({data})

      const newProfileComplete = !!data?.profile_complete && !!data?.full_name;
      const newOrganizationId = data?.organization_id || null;
      const newFullName = data?.full_name || null;

      setProfileComplete(newProfileComplete);
      setOrganizationId(newOrganizationId);
      setFullName(newFullName);
      setCurrentUserData({
        isOrgOwner: data?.role === ROLES.ORG_OWNER,
        isOrgAdmin: data?.role === ROLES.ORG_ADMIN,
        isOrgMember: data?.role === ROLES.ORG_MEMBER,
      });

      return true;
    } catch (err) {
      setProfileComplete(false);
      setOrganizationId(null);
      setFullName(null);
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;
    initialLoadComplete.current = false;

    const performAuthSetup = async () => {
      if (!isMounted) return;
      setIsLoading(true);

      try {
        // Use getUser() for better security instead of getSession()
        const {
          data: { user: authenticatedUser },
          error: userError,
        } = await supabase.auth.getUser();

        if (!isMounted) {
          return;
        }

        if (!userError && authenticatedUser) {
          // If we have an authenticated user, get the session for the session state
          const { data: { session } } = await supabase.auth.getSession();

          setUser(authenticatedUser);
          setSession(session);
          currentUserIdRef.current = authenticatedUser.id;
        } else {
          setUser(null);
          setSession(null);
          currentUserIdRef.current = null;
          setProfileComplete(false);
          setOrganizationId(null);
          setFullName(null);
        }
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setUser(null);
        setSession(null);
        currentUserIdRef.current = null;
        setProfileComplete(false);
        setOrganizationId(null);
        setFullName(null);
      } finally {
        if (isMounted) {
          if (!currentUserIdRef.current) {
            setIsLoading(false);
          }
          initialLoadComplete.current = true;
        }
      }
    };

    performAuthSetup();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) {
        return;
      }

      const newUserId = newSession?.user?.id || null;
      const previousUserId = currentUserIdRef.current;

      setSession(newSession);

      let userChanged = false;
      if (newUserId !== previousUserId) {
        userChanged = true;
        setUser(newSession?.user ?? null);
        currentUserIdRef.current = newUserId;
        if (!newUserId) {
          setFullName(null);
          setProfileComplete(false);
          setOrganizationId(null);
        } else {
          // Force immediate profile fetch for new user to get fresh data
          fetchUserProfile(newUserId);
        }
      }

      if (userChanged) {
        if (!initialLoadComplete.current) {
          setIsLoading(true);
        }
      } else if (newUserId && event === "USER_UPDATED") {
        setUser(prevUser => newSession?.user ? { ...newSession.user } : null);
        if (initialLoadComplete.current) {
          setIsLoading(true);
        }
      } else if (newUserId && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
      }

      if (!initialLoadComplete.current && !newUserId) {
        setIsLoading(false);
      }

      if (initialLoadComplete.current && event === 'SIGNED_OUT') {
        setIsLoading(false);
      }

    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;

    const attemptFetchProfile = async (userIdToFetch: string) => {
      if (!isMounted) return;

      setIsLoading(true);

      await fetchUserProfile(userIdToFetch);

      if (isMounted) {
        setIsLoading(false);
      }
    };

    const currentUserId = user?.id;

    if (currentUserId) {
      if (initialLoadComplete.current) {
        attemptFetchProfile(currentUserId);
      } else {
      }
    } else {
      if (initialLoadComplete.current) {
        setProfileComplete(false);
        setOrganizationId(null);
        setFullName(null);
        setIsLoading(false);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [user, supabase]);

  const incrementXP = async (amount: number) => {
    if (!user) return;
    try {
      const { error } = await supabase.rpc("increment_user_xp", {
        user_id: user.id,
        xp_amount: amount,
      });

      if (error) {
        throw new DatabaseError("Failed to increment XP: " + error.message);
      }
    } catch (err) {
      console.error("Error incrementing XP:", err);
      if (err instanceof DatabaseError) {
        setError(err);
      } else {
        setError(new DatabaseError("Failed to increment XP"));
      }
      throw err;
    }
  };

  const signOut = async () => {
    console.log("Signing out");
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[Auth] Error signing out:", error);
      throw error;
    }
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        profileComplete,
        signOut,
        organizationId,
        fullName,
        currentUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context as ExtendedAuthContextType;
}
