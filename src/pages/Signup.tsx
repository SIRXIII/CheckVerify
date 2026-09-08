import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function Signup() {
  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [hasPendingInvite] = useState(() => Boolean(localStorage.getItem('cv.pendingInvite')));

  const { refreshMemberships } = useAuth();
  const navigate = useNavigate();

  const handleNameChange = (value: string) => {
    setCompanyName(value);
    if (!slugEdited) {
      setSlug(slugify(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugEdited(true);
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!hasPendingInvite && !/^[a-z0-9-]{3,40}$/.test(slug)) {
      setError('URL slug must be 3-40 characters, using only lowercase letters, numbers, and hyphens.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;

      if (data.session) {
        if (!hasPendingInvite) {
          const { error: orgError } = await supabase.rpc('create_organization', {
            p_name: companyName,
            p_slug: slug,
          });
          if (orgError) throw orgError;
        }

        await refreshMemberships();
        navigate('/admin/properties'); // org-scoped landing; legacy /admin/dashboard is Host LA (platform-admin) only in Phase 1
      } else {
        if (!hasPendingInvite) {
          localStorage.setItem('cv.pendingOrg', JSON.stringify({ name: companyName, slug }));
        }
        setPendingConfirmation(true);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (pendingConfirmation) {
    return (
      <div className="min-h-screen bg-hostla-dark flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <h2 className="text-2xl font-heading font-semibold text-gray-900 mb-4">
              Check your email
            </h2>
            <p className="text-gray-600">
              Check your email to confirm, then sign in; your organization will be created on first login.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hostla-dark flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <img
              src="/check-in-verify-logo.png"
              alt="Host LA Logo"
              className="h-20 w-auto mx-auto mb-6 drop-shadow-lg"
            />
            <h2 className="text-2xl font-heading font-semibold text-gray-900 mb-2">
              Create an organization
            </h2>
            <p className="text-gray-600">
              Set up your Check-In Verify account
            </p>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {!hasPendingInvite && (
              <>
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name
                  </label>
                  <input
                    id="companyName"
                    type="text"
                    value={companyName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-hostla-primary focus:border-transparent transition-all duration-200"
                    placeholder="Acme Hospitality"
                  />
                </div>

                <div>
                  <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-2">
                    URL Slug
                  </label>
                  <input
                    id="slug"
                    type="text"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    required
                    pattern="[a-z0-9-]{3,40}"
                    title="3-40 characters: lowercase letters, numbers, and hyphens only."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-hostla-primary focus:border-transparent transition-all duration-200"
                    placeholder="acme-hospitality"
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-hostla-primary focus:border-transparent transition-all duration-200"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-hostla-primary focus:border-transparent transition-all duration-200"
                placeholder="Create a password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-hostla-primary hover:bg-hostla-secondary text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              {loading ? 'Processing...' : 'Create Organization'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/admin/login" className="text-sm text-gray-500 hover:text-hostla-primary transition-colors">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
