import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // console.log("[SupabaseClient] Initializing: NEXT_PUBLIC_SUPABASE_URL exists:", !!supabaseUrl);
  // console.log("[SupabaseClient] Initializing: NEXT_PUBLIC_SUPABASE_ANON_KEY exists:", !!supabaseAnonKey);
  // You can uncomment the lines below to log the actual values, 
  // but be careful if these logs could ever be exposed publicly.
  // console.log("[SupabaseClient] URL:", supabaseUrl);
  // console.log("[SupabaseClient] Key:", supabaseAnonKey);

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[SupabaseClient] CRITICAL: Supabase URL or Anon Key is missing. Client will not function correctly.");
    // Optionally, you could throw an error here to make the problem more obvious
    // throw new Error("Supabase URL or Anon Key is missing.");
  }

//   return createBrowserClient<Database>(
  return createBrowserClient(
    supabaseUrl!,
    supabaseAnonKey!
  )
}
