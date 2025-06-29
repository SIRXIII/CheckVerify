import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, LogOut, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Header() {
  const { user, userType, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="bg-blue-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <Shield className="h-8 w-8 text-yellow-400" />
            <span className="text-xl font-bold">Check-in Verification</span>
          </Link>

          <nav className="flex items-center space-x-6">
            {user && userType === 'admin' ? (
              <>
                <Link
                  to="/admin/dashboard"
                  className="flex items-center space-x-1 hover:text-yellow-400 transition-colors"
                >
                  <User className="h-4 w-4" />
                  <span>Dashboard</span>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center space-x-1 hover:text-yellow-400 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <Link
                to="/admin/login"
                className="bg-yellow-500 hover:bg-yellow-600 text-blue-900 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Admin Login
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}