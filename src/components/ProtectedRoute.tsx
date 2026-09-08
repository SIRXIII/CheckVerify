import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';
import { roleAtLeast, type Role } from '../lib/roles';

interface ProtectedRouteProps {
  children: React.ReactNode;
  userType?: 'traveler' | 'admin';
  minRole?: Role;
}

export function ProtectedRoute({ children, userType, minRole }: ProtectedRouteProps) {
  const { user, userType: currentUserType, loading, membershipsLoading, activeOrg } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace state={{ error: 'Please log in to access the dashboard.' }} />;
  }

  if (userType === 'admin') {
    if (!(currentUserType === 'admin' || activeOrg != null)) {
      return <Navigate to="/admin/login" replace state={{ error: 'Access denied. You must be an admin to view this page.' }} />;
    }
  } else if (userType && currentUserType !== userType) {
    return <Navigate to="/admin/login" replace state={{ error: 'Access denied. You must be an admin to view this page.' }} />;
  }

  if (minRole) {
    if (loading || membershipsLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner />
        </div>
      );
    }
    if (!(activeOrg && roleAtLeast(activeOrg.role, minRole))) {
      return <div className="p-8 text-red-600">You are not authorized to view this page.</div>;
    }
  }

  return <>{children}</>;
}
