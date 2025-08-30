import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Eye, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * AdminSubmissions renders a list of reservation and verification submissions for admins.
 *
 * It relies on the user profile's `userType` (from AuthContext) instead of
 * deprecated app_metadata.role, and uses a secure server function to fetch
 * submission data. Unauthorized users see a clear message rather than a blank screen.
 */
export function AdminSubmissions() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, userType, loading: authLoading } = useAuth();

  /**
   * Fetch submissions from a Netlify Function that uses the service role key.
   */
  const fetchSubmissions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error('Missing access token');
      }
      const params = new URLSearchParams({ page: '1', pageSize: '50', q: '', status: 'all', date: '' });
      const res = await fetch(`/api/admin/submissions?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch submissions. Status ${res.status}`);
      }
      const result = await res.json();
      setSubmissions(result.items);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (user && userType === 'admin') {
      fetchSubmissions();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userType, authLoading]);

  if (authLoading || loading) {
    return <div className="p-8 text-gray-500">Loading admin submissions…</div>;
  }
  if (!(user && userType === 'admin')) {
    return <div className="p-8 text-red-600">You are not authorized to view this page.</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">Verification Submissions</h1>
      {submissions.length === 0 ? (
        <div>No submissions found.</div>
      ) : (
        <table className="min-w-full text-left text-sm text-gray-500">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3">Guest Name</th>
              <th scope="col" className="px-6 py-3">Email</th>
              <th scope="col" className="px-6 py-3">Check-In</th>
              <th scope="col" className="px-6 py-3">Check-Out</th>
              <th scope="col" className="px-6 py-3">Platform</th>
              <th scope="col" className="px-6 py-3">Amount</th>
              <th scope="col" className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="px-6 py-4 whitespace-nowrap">{item.guest_name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.check_in_date}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.check_out_date}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.booking_platform}</td>
                <td className="px-6 py-4 whitespace-nowrap">${item.reservation_amount}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
