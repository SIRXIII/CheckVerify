import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, FileText, Clock, CheckCircle, XCircle, Calendar, TrendingUp, Shield, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DashboardStats {
  totalSubmissions: number;
  pendingReview: number;
  verifiedToday: number;
  rejectedToday: number;
  recentSubmissions: Array<{
    id: string;
    guest_name: string;
    status: string;
    created_at: string;
  }>;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalSubmissions: 0,
    pendingReview: 0,
    verifiedToday: 0,
    rejectedToday: 0,
    recentSubmissions: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // Fetch verification documents with digital signatures
      const { data: verificationData, error } = await supabase
        .from('verification_documents')
        .select(`
          *,
          digital_signatures (
            form_data
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const today = new Date().toDateString();
      const submissions = verificationData || [];

      // Transform data to get guest names
      const transformedSubmissions = submissions.map((verification) => {
        const signature = verification.digital_signatures?.[0];
        const formData = signature?.form_data || {};
        
        return {
          id: verification.id,
          guest_name: `${formData.firstName || ''} ${formData.lastName || ''}`.trim() || 'N/A',
          status: verification.status,
          created_at: verification.created_at,
        };
      });

      const dashboardStats: DashboardStats = {
        totalSubmissions: submissions.length,
        pendingReview: submissions.filter(s => s.status === 'pending').length,
        verifiedToday: submissions.filter(s => 
          s.status === 'verified' && 
          new Date(s.created_at).toDateString() === today
        ).length,
        rejectedToday: submissions.filter(s => 
          s.status === 'rejected' && 
          new Date(s.created_at).toDateString() === today
        ).length,
        recentSubmissions: transformedSubmissions.slice(0, 5),
      };

      setStats(dashboardStats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'text-green-600 bg-green-100';
      case 'rejected':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-sm">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 w-12 h-12 rounded-xl flex items-center justify-center shadow-lg">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600">Overview of verification submissions and system activity</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Submissions</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalSubmissions}</p>
              <p className="text-xs text-gray-400 mt-1">All time</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Pending Review</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.pendingReview}</p>
              <p className="text-xs text-gray-400 mt-1">Awaiting action</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Verified Today</p>
              <p className="text-3xl font-bold text-green-600">{stats.verifiedToday}</p>
              <p className="text-xs text-gray-400 mt-1">Approved submissions</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Rejected Today</p>
              <p className="text-3xl font-bold text-red-600">{stats.rejectedToday}</p>
              <p className="text-xs text-gray-400 mt-1">Declined submissions</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Link
          to="/admin/submissions"
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white p-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold mb-2">Review Submissions</h3>
              <p className="text-blue-100 mb-4">
                View and manage all guest verification submissions
              </p>
              <div className="flex items-center space-x-2 text-blue-200">
                <span className="text-sm">View all submissions</span>
                <Eye className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
            <div className="bg-blue-500 bg-opacity-50 p-4 rounded-lg">
              <FileText className="h-10 w-10 text-white" />
            </div>
          </div>
        </Link>

        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold mb-2">System Status</h3>
              <p className="text-green-100 mb-4">
                All systems operational and secure
              </p>
              <div className="flex items-center space-x-2 text-green-200">
                <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                <span className="text-sm">Online</span>
              </div>
            </div>
            <div className="bg-green-500 bg-opacity-50 p-4 rounded-lg">
              <TrendingUp className="h-10 w-10 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Recent Submissions</h2>
            <Link
              to="/admin/submissions"
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              View all →
            </Link>
          </div>
        </div>

        {stats.recentSubmissions.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No recent submissions</h3>
            <p className="text-gray-500">New submissions will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {stats.recentSubmissions.map((submission) => (
              <div key={submission.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{submission.guest_name}</h3>
                      <p className="text-sm text-gray-500">
                        Submitted {new Date(submission.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(submission.status)}`}>
                      {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                    </span>
                    <Link
                      to="/admin/submissions"
                      className="text-blue-600 hover:text-blue-700 p-1 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}