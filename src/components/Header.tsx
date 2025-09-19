import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Header() {
  const navigate = useNavigate();
  const { user, userType, loading: authLoading, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error signing out', err);
    }
  };

  return (
    <header className="bg-blue-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-3 hover:text-green-400">
            <span className="text-xl font-bold tracking-wide">Check</span>
            <span className="text-xl font-bold tracking-wide text-green-400">IN</span>
            <span className="text-xl font-medium">Verify</span>
          </Link>

          <nav className="flex items-center space-x-6">
            {!authLoading && (
              user && userType === 'admin' ? (
                <>
                  <Link
                    to="/admin/dashboard"
                    className="text-white hover:text-yellow-400 font-medium transition-colors"
                  >
                    Dashboard
                  </Link>
                  
                  <Link
                    to="/admin/submissions"
                    className="text-white hover:text-yellow-400 font-medium transition-colors"
                  >
                    Submissions
                  </Link>

                  <button
                    onClick={handleSignOut}
                    className="flex items-center space-x-1 hover:text-yellow-400 transition-colors"
                  >
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <Link
                  to="/admin/login"
                  className="bg-yellow-500 hover:bg-yellow-600 text-blue-900 px-4 py-2 rounded-lg font-medium transition-colors shadow-lg"
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
