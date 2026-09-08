import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading, refreshMemberships } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (authLoading || !token) return;

    if (!user) {
      localStorage.setItem('cv.pendingInvite', token);
      return;
    }

    const accept = async () => {
      setAccepting(true);
      setError(null);
      try {
        const { data, error } = await supabase.rpc('accept_invite', { p_token: token });
        if (error) throw error;
        if (data) localStorage.setItem('cv.activeOrg', data as string);
        await refreshMemberships();
        navigate('/admin/properties'); // org-scoped landing; legacy /admin/dashboard is Host LA (platform-admin) only in Phase 1
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to accept invite');
      } finally {
        setAccepting(false);
      }
    };

    accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, token]);

  if (authLoading || accepting) {
    return <div className="p-8 text-gray-500 text-center">Processing invite...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-hostla-dark flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <h2 className="text-2xl font-heading font-semibold text-gray-900 mb-4">
              You&apos;ve been invited
            </h2>
            <p className="text-gray-600 mb-6">
              Sign in or create an account to accept this invitation.
            </p>
            <div className="space-y-3">
              <Link
                to="/admin/login"
                className="block w-full bg-hostla-primary hover:bg-hostla-secondary text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="block w-full text-sm text-gray-500 hover:text-hostla-primary transition-colors"
              >
                Create an account
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-md mx-auto text-center">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      )}
    </div>
  );
}
