import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// When env vars are not provided, export a safe fallback client that allows the UI to render
// and surfaces clear errors only when privileged actions are attempted.
function createFallbackClient(): SupabaseClient<unknown, unknown, unknown> {
  const notConfigured = () => {
    throw new Error(
      'Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'
    );
  };

  // Minimal surface used across the app
  const fallback = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      // onAuthStateChange returns an object with a subscription that has an unsubscribe()
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
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
  } as unknown as SupabaseClient<unknown, unknown, unknown>;

  return fallback;
}

export const supabase: SupabaseClient<unknown, unknown, unknown> =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createFallbackClient();