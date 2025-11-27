import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const cleanEnvVar = (value: string | undefined) => {
  if (!value) return undefined;
  let cleaned = value.trim();
  // Remove surrounding quotes if present
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned;
};

const supabaseUrl = cleanEnvVar(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = cleanEnvVar(import.meta.env.VITE_SUPABASE_ANON_KEY);

// When env vars are not provided, export a safe fallback client that allows the UI to render
// and surfaces clear errors only when privileged actions are attempted.
function createFallbackClient(): SupabaseClient {
  const notConfigured = () => {
    throw new Error(
      'Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'
    );
  };

  // Minimal surface used across the app
  const fallback: Record<string, unknown> = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      // onAuthStateChange returns an object with a subscription that has an unsubscribe()
      onAuthStateChange: (callback: unknown) => {
        void callback;
        return { data: { subscription: { unsubscribe: () => { } } } };
      },
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

  return fallback as unknown as SupabaseClient;
}

export const supabase: SupabaseClient =
  supabaseUrl && supabaseAnonKey
    ? (() => {
      console.log('Supabase Config Status: Valid');
      console.log('Supabase URL:', supabaseUrl);
      // Log first few chars to verify no quotes/whitespace issues
      console.log('Supabase Key Start:', supabaseAnonKey.substring(0, 5) + '...');
      return createClient(supabaseUrl, supabaseAnonKey);
    })()
    : createFallbackClient();
