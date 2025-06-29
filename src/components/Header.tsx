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
          <Link to="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity group">
            <div className="relative">
              <Shield className="h-9 w-9 text-blue-300 group-hover:text-blue-200 transition-colors" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-blue-900"></div>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xl font-bold tracking-wide">Check <span className="text-green-400">IN</span></span>
              <span className="text-sm font-medium text-blue-200 -mt-1">Verify</span>
            </div>
          </Link>

          <nav className="flex items-center space-x-6">
            {user && userType === 'admin' ? (
              <>
                <Link
                  to="/admin/dashboard"
                  className="flex items-center space-x-1 hover:text-green-400 transition-colors"
                >
                  <User className="h-4 w-4" />
                  <span>Dashboard</span>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center space-x-1 hover:text-green-400 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <Link
                to="/admin/login"
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg"
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