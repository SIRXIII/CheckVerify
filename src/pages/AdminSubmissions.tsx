import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * AdminSubmissions renders a list of reservation and verification submissions for admins.
 */
type Submission = {
  id: string;
  reservation_id: string;
  guest_name: string;
  email: string;
  check_in_date: string;
  check_out_date: string;
  booking_platform: string;
  reservation_amount: number;
  status: string;
  created_at: string;
};

export function AdminSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, userType, loading: authLoading } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchSubmissions = async () => {
    try {
      setError(null);
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          verification_documents ( id, status, created_at )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const items = (data || []).map((row: any) => {
        const document = row.verification_documents?.[0] || {};
        return {
          id: document.id || row.id,
          reservation_id: row.id,
          guest_name: row.guest_name || '',
          email: 'N/A',
          check_in_date: row.check_in_date || '',
          check_out_date: row.check_out_date || '',
          booking_platform: row.booking_platform || '',
          reservation_amount: row.total_amount || 0,
          status: document.status || 'pending',
          created_at: document.created_at || row.created_at || '',
        };
      });

      setSubmissions(items);
    } catch (error: any) {
      console.error('Error fetching submissions:', error);
      setError(error.message || 'Unknown error');
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
  }, [user, userType, authLoading]);

  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [imageUrls, setImageUrls] = useState<{ id?: string; card?: string; signature?: string }>({});

  const handleViewDetails = async (submission: Submission) => {
    setSelectedSubmission(submission);
    setImageUrls({});
    try {
      const { data: docData } = await supabase
        .from('verification_documents')
        .select('id_document_path, credit_card_path')
        .eq('reservation_id', submission.reservation_id)
        .single();

      const { data: sigData } = await supabase
        .from('digital_signatures')
        .select('signature_data')
        .eq('reservation_id', submission.reservation_id)
        .single();

      const newUrls: any = {};
      if (docData) {
        if (docData.id_document_path) {
          const { data } = await supabase.storage.from('documents').createSignedUrl(docData.id_document_path, 3600);
          if (data) newUrls.id = data.signedUrl;
        }
        if (docData.credit_card_path) {
          const { data } = await supabase.storage.from('documents').createSignedUrl(docData.credit_card_path, 3600);
          if (data) newUrls.card = data.signedUrl;
        }
      }
      if (sigData?.signature_data) {
        newUrls.signature = sigData.signature_data;
      }
      setImageUrls(newUrls);
    } catch (err) {
      console.error('Error fetching details:', err);
    }
  };

  const handleUpdateStatus = async (status: 'approved' | 'rejected') => {
    if (!selectedSubmission || isUpdating) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('verification_documents')
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id
        })
        .eq('reservation_id', selectedSubmission.reservation_id);

      if (error) throw error;

      // Update local state
      setSubmissions(prev => prev.map(s =>
        s.reservation_id === selectedSubmission.reservation_id ? { ...s, status } : s
      ));

      setSelectedSubmission(prev => prev ? { ...prev, status } : null);
    } catch (err: any) {
      console.error('Error updating status:', err);
      alert('Failed to update status: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUpdating(false);
    }
  };

  const closeModal = () => {
    setSelectedSubmission(null);
    setImageUrls({});
  };

  if (authLoading || loading) {
    return <div className="p-8 text-gray-500">Loading admin submissions...</div>;
  }

  if (!(user && userType === 'admin')) {
    return <div className="p-8 text-red-600">You are not authorized to view this page.</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">Verification Submissions</h1>
      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      )}

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full text-left text-sm text-gray-500">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-700">
            <tr>
              <th className="px-6 py-3">Guest Name</th>
              <th className="px-6 py-3">Check-In</th>
              <th className="px-6 py-3">Check-Out</th>
              <th className="px-6 py-3">Platform</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((item) => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{item.guest_name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.check_in_date}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.check_out_date}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.booking_platform}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    item.status === 'approved' ? 'bg-green-100 text-green-800' :
                    item.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button onClick={() => handleViewDetails(item)} className="text-hostla-primary hover:text-hostla-secondary">
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Submission Details</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700 text-xl">&times;</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <h3 className="text-lg font-semibold mb-3">Guest Info</h3>
                <p><strong>Name:</strong> {selectedSubmission.guest_name}</p>
                <p><strong>Platform:</strong> {selectedSubmission.booking_platform}</p>
                <p><strong>Amount:</strong> ${selectedSubmission.reservation_amount}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3">Stay Info</h3>
                <p><strong>Check-In:</strong> {selectedSubmission.check_in_date}</p>
                <p><strong>Check-Out:</strong> {selectedSubmission.check_out_date}</p>
                <p><strong>Status:</strong> {selectedSubmission.status}</p>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Documents</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border rounded p-4 text-center">
                  <h4 className="font-medium mb-2">ID Document</h4>
                  {imageUrls.id ? <img src={imageUrls.id} alt="ID" className="max-w-full rounded mx-auto" /> : <div className="h-40 bg-gray-100 flex items-center justify-center">No ID</div>}
                </div>
                <div className="border rounded p-4 text-center">
                  <h4 className="font-medium mb-2">Credit Card</h4>
                  {imageUrls.card ? <img src={imageUrls.card} alt="Card" className="max-w-full rounded mx-auto" /> : <div className="h-40 bg-gray-100 flex items-center justify-center">No Card</div>}
                </div>
              </div>
            </div>

            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-semibold mb-4">Signature</h3>
              <div className="border rounded p-4 bg-gray-50 text-center">
                {imageUrls.signature ? <img src={imageUrls.signature} alt="Signature" className="max-h-32 mx-auto" /> : <div>No signature</div>}
              </div>
            </div>

            <div className="mt-8 flex justify-end space-x-3 border-t pt-6">
              <button onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
                Close
              </button>
              {selectedSubmission.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleUpdateStatus('rejected')}
                    disabled={isUpdating}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('approved')}
                    disabled={isUpdating}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
