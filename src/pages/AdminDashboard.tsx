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
      // Fetch reservations with related verification documents
      const { data: reservationsData, error } = await supabase
        .from('reservations')
        .select(`
          *,
          verification_documents (
            id,
            status,
            created_at
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const today = new Date().toDateString();
      
      // Filter only reservations that have verification documents
      const submissionsWithVerification = (reservationsData || [])
        .filter(reservation => reservation.verification_documents && reservation.verification_documents.length > 0)
        .map(reservation => ({
          id: reservation.verification_documents[0].id,
          guest_name: reservation.guest_name,
          status: reservation.verification_documents[0].status,
          created_at: reservation.verification_documents[0].created_at,
        }));

      const dashboardStats: DashboardStats = {
        totalSubmissions: submissionsWithVerification.length,
        pendingReview: submissionsWithVerification.filter(s => s.status === 'pending').length,
        verifiedToday: submissionsWithVerification.filter(s => 
          s.status === 'verified' && 
          new Date(s.created_at).toDateString() === today
        ).length,
        rejectedToday: submissionsWithVerification.filter(s => 
          s.status === 'rejected' && 
          new Date(s.created_at).toDateString() === today
        ).length,
        recentSubmissions: submissionsWithVerification.slice(0, 5),
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Centered Logo */}
        <div className="text-center mb-12">
          <img 
            src="/Check-In Verify LOGO.png" 
            alt="Check-In Verify Logo" 
            className="h-20 w-auto mx-auto drop-shadow-lg"
          />
        </div>

        <div className="mb-12">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Admin Dashboard</h1>
            <p className="text-xl text-gray-600">Overview of verification submissions and system activity</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Submissions</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalSubmissions}</p>
                <p className="text-xs text-gray-400 mt-1">All time</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-xl">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Pending Review</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.pendingReview}</p>
                <p className="text-xs text-gray-400 mt-1">Awaiting action</p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-xl">
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Verified Today</p>
                <p className="text-3xl font-bold text-green-600">{stats.verifiedToday}</p>
                <p className="text-xs text-gray-400 mt-1">Approved submissions</p>
              </div>
              <div className="bg-green-100 p-3 rounded-xl">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Rejected Today</p>
                <p className="text-3xl font-bold text-red-600">{stats.rejectedToday}</p>
                <p className="text-xs text-gray-400 mt-1">Declined submissions</p>
              </div>
              <div className="bg-red-100 p-3 rounded-xl">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Link
            to="/admin/submissions"
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white p-8 rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl group transform hover:-translate-y-1"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-semibold mb-3">Review Submissions</h3>
                <p className="text-blue-100 mb-6 text-lg">
                  View and manage all guest verification submissions
                </p>
                <div className="flex items-center space-x-2 text-blue-200">
                  <span className="text-sm">View all submissions</span>
                  <Eye className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
              <div className="bg-blue-500 bg-opacity-50 p-4 rounded-xl">
                <FileText className="h-12 w-12 text-white" />
              </div>
            </div>
          </Link>

          <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-8 rounded-2xl shadow-lg transform hover:-translate-y-1 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-semibold mb-3">System Status</h3>
                <p className="text-green-100 mb-6 text-lg">
                  All systems operational and secure
                </p>
                <div className="flex items-center space-x-2 text-green-200">
                  <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                  <span className="text-sm">Online</span>
                </div>
              </div>
              <div className="bg-green-500 bg-opacity-50 p-4 rounded-xl">
                <TrendingUp className="h-12 w-12 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Submissions */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="p-8 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-gray-900">Recent Submissions</h2>
              <Link
                to="/admin/submissions"
                className="text-blue-600 hover:text-blue-700 font-medium text-sm px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
              >
                View all →
              </Link>
            </div>
          </div>

          {stats.recentSubmissions.length === 0 ? (
            <div className="p-12 text-center">
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
                      <div className="bg-blue-100 p-3 rounded-xl">
                        <Users className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 text-lg">{submission.guest_name}</h3>
                        <p className="text-sm text-gray-500">
                          Submitted {new Date(submission.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(submission.status)}`}>
                        {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                      </span>
                      <Link
                        to="/admin/submissions"
                        className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <Eye className="h-5 w-5" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}