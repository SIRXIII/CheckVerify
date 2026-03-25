import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Header() {
  const navigate = useNavigate();
  const { user, userType, loading: authLoading, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (err) {
      console.error('Error signing out', err);
    }
  };

  return (
    <header className="bg-hostla-dark text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-3 hover:text-hostla-primary">
            <div className="relative">
              <Shield className="h-7 w-7 text-hostla-primary" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border border-hostla-dark"></div>
            </div>
            <span className="text-xl font-heading font-bold tracking-wide">Check</span>
            <span className="text-xl font-heading font-bold tracking-wide text-hostla-primary">IN</span>
            <span className="text-xl font-heading font-medium">Verify</span>
          </Link>

          <nav className="flex items-center space-x-6">
            {!authLoading && (
              user && userType === 'admin' ? (
                <>
                  <Link
                    to="/admin/dashboard"
                    className="text-white hover:text-hostla-primary font-medium transition-colors"
                  >
                    Dashboard
                  </Link>

                  <Link
                    to="/admin/submissions"
                    className="text-white hover:text-hostla-primary font-medium transition-colors"
                  >
                    Submissions
                  </Link>

                  <button
                    onClick={handleSignOut}
                    className="flex items-center space-x-1 hover:text-hostla-primary transition-colors"
                  >
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <Link
                  to="/admin/login"
                  className="bg-hostla-primary hover:bg-hostla-secondary text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg"
                >
                  Admin Login
                </Link>
              )
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
