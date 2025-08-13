import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// When env vars are not provided, export a safe fallback client that allows the UI to render
// and surfaces clear errors only when privileged actions are attempted.
function createFallbackClient(): SupabaseClient<any, any, any> {
  const notConfigured = () => {
    throw new Error(
      'Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'
    );
  };

  // Minimal surface used across the app
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fallback: any = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      // onAuthStateChange returns an object with a subscription that has an unsubscribe()
      onAuthStateChange: (_cb: unknown) => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async () => notConfigured(),
      signUp: async () => notConfigured(),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: async () => notConfigured(),
      insert: async () => notConfigured(),
      update: async () => notConfigured(),
      eq: () => ({ select: async () => notConfigured(), limit: () => notConfigured() }),
    }),
    storage: {
      from: () => ({
        upload: async () => notConfigured(),
        createSignedUrl: async () => notConfigured(),
      }),
    },
  };

  return fallback as SupabaseClient<any, any, any>;
}

export const supabase: SupabaseClient<any, any, any> =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createFallbackClient();