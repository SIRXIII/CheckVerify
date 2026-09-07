import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Membership } from '../types/database';

const ACTIVE_ORG_KEY = 'cv.activeOrg';
const PENDING_ORG_KEY = 'cv.pendingOrg';
const PENDING_INVITE_KEY = 'cv.pendingInvite';

interface AuthContextType {
  user: User | null;
  userType: 'traveler' | 'admin' | null;
  loading: boolean;
  orgs: Membership[];
  activeOrg: Membership | null;
  setActiveOrg: (orgId: string) => void;
  isPlatformAdmin: boolean;
  refreshMemberships: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
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
  const [orgs, setOrgs] = useState<Membership[]>([]);
  const [activeOrg, setActiveOrgState] = useState<Membership | null>(null);

  // TODO: derive from a real platform-admin flag once that concept exists server-side.
  const isPlatformAdmin = false;

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserType(session.user.id);
        refreshMemberships();
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
          refreshMemberships();
        } else {
          setUserType(null);
          setOrgs([]);
          setActiveOrgState(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUserType = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_type')
        .eq('id', userId)
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setUserType(data[0].user_type);
      } else {
        setUserType(null);
      }
    } catch (error) {
      console.error('Error fetching user type:', error);
      setUserType(null);
      // If we can't fetch the profile, we should probably sign out or clear the user to avoid mixed state
      // But for now, just clearing userType is safer to avoid loops
    } finally {
      setLoading(false);
    }
  };

  const applyActiveOrg = (memberships: Membership[]) => {
    const storedId = localStorage.getItem(ACTIVE_ORG_KEY);
    const stillValid = memberships.find((m) => m.org_id === storedId);
    if (stillValid) {
      setActiveOrgState(stillValid);
    } else if (memberships.length > 0) {
      setActiveOrgState(memberships[0]);
      localStorage.setItem(ACTIVE_ORG_KEY, memberships[0].org_id);
    } else {
      setActiveOrgState(null);
    }
  };

  const refreshMemberships = async () => {
    try {
      const { data, error } = await supabase.rpc('my_memberships');
      if (error) throw error;
      let memberships = (data as Membership[]) || [];

      // A user arriving via an invite link accepts it as soon as they have a session.
      const pendingInvite = localStorage.getItem(PENDING_INVITE_KEY);
      if (pendingInvite) {
        try {
          await supabase.rpc('accept_invite', { p_token: pendingInvite });
          localStorage.removeItem(PENDING_INVITE_KEY);
          const refetch = await supabase.rpc('my_memberships');
          memberships = (refetch.data as Membership[]) || memberships;
        } catch (err) {
          console.error('Error accepting pending invite:', err);
        }
      }

      // A user who signed up before confirming their email creates their org on first login.
      const pendingOrgRaw = localStorage.getItem(PENDING_ORG_KEY);
      if (memberships.length === 0 && pendingOrgRaw) {
        try {
          const pendingOrg = JSON.parse(pendingOrgRaw) as { name: string; slug: string };
          await supabase.rpc('create_organization', { p_name: pendingOrg.name, p_slug: pendingOrg.slug });
          localStorage.removeItem(PENDING_ORG_KEY);
          const refetch = await supabase.rpc('my_memberships');
          memberships = (refetch.data as Membership[]) || memberships;
        } catch (err) {
          console.error('Error creating pending organization:', err);
        }
      }

      setOrgs(memberships);
      applyActiveOrg(memberships);
    } catch (error) {
      console.error('Error fetching memberships:', error);
      setOrgs([]);
      setActiveOrgState(null);
    }
  };

  const setActiveOrg = (orgId: string) => {
    const found = orgs.find((o) => o.org_id === orgId);
    if (!found) return;
    setActiveOrgState(found);
    localStorage.setItem(ACTIVE_ORG_KEY, orgId);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
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
            user_type: 'traveler',
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
    orgs,
    activeOrg,
    setActiveOrg,
    isPlatformAdmin,
    refreshMemberships,
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
