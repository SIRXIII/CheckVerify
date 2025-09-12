import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  userType: 'traveler' | 'admin' | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userType: 'traveler' | 'admin') => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<'traveler' | 'admin' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserType(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchUserType(session.user.id);
        } else {
          setUserType(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserType = async (userId: string) => {
    try {
      // Primary path: use supabase-js which attaches the user's access token
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_type')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setUserType(data.user_type as 'traveler' | 'admin');
        return;
      }

      // If the select failed (often due to auth headers being stripped in some environments),
      // try a direct REST request with explicit Authorization + apikey headers.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;

      if (accessToken && supabaseUrl && supabaseAnonKey) {
        const url = `${supabaseUrl}/rest/v1/user_profiles?select=user_type&id=eq.${userId}&limit=1`;
        const res = await fetch(url, {
          headers: {
            Accept: 'application/json',
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
          },
          credentials: 'omit',
        });

        if (res.ok) {
          const rows = (await res.json()) as Array<{ user_type: 'traveler' | 'admin' }>;
          setUserType(rows?.[0]?.user_type ?? null);
          return;
        } else {
          const errText = await res.text().catch(() => '');
          console.error('Error fetching user type (REST fallback):', res.status, errText);
        }
      }

      // If we reach here, we couldn't determine the user type
      setUserType(null);
    } catch (error) {
      console.error('Error fetching user type:', error);
      setUserType(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, userType: 'traveler' | 'admin') => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;

    if (data.user) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert([
          {
            id: data.user.id,
            email: data.user.email,
            user_type: userType,
          },
        ]);
      if (profileError) throw profileError;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = {
    user,
    userType,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
