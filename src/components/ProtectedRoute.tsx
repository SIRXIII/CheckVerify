import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  userType?: 'traveler' | 'admin';
}

export function ProtectedRoute({ children, userType }: ProtectedRouteProps) {
  const { user, userType: currentUserType, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (userType && currentUserType !== userType) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}