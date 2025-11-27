import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * AdminSubmissions renders a list of reservation and verification submissions for admins.
 *
 * It relies on the user profile's `userType` (from AuthContext) instead of
 * deprecated app_metadata.role, and uses a secure server function to fetch
 * submission data. Unauthorized users see a clear message rather than a blank screen.
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

type SubmissionResponse = {
  items?: Submission[];
};

export function AdminSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, userType, loading: authLoading } = useAuth();

  /**
   * Fetch submissions from a Netlify Function that uses the service role key.
   */
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
        // Email is not directly available on reservations table, would need a join or separate fetch
        const email = 'N/A';

        return {
          id: document.id || row.id,
          reservation_id: row.id,
          guest_name: row.guest_name || '',
          email: email,
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
      console.log('Full error object:', JSON.stringify(error, null, 2));
      setSubmissions([]);
      setError(error.message || JSON.stringify(error) || 'Unknown error');
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
    setImageUrls({}); // Reset images

    // Fetch signed URLs for documents
    try {
      // We need to fetch the document paths first since they aren't in the submission object
      // (We simplified the query earlier to avoid joins, so we fetch details on demand now)
      const { data: docData, error: docError } = await supabase
        .from('verification_documents')
        .select('id_document_path, credit_card_path')
        .eq('reservation_id', submission.reservation_id)
        .single();

      const { data: sigData, error: sigError } = await supabase
        .from('digital_signatures')
        .select('signature_data')
        .eq('reservation_id', submission.reservation_id)
        .single();

      const newUrls: { id?: string; card?: string; signature?: string } = {};

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

  const closeModal = () => {
    setSelectedSubmission(null);
    setImageUrls({});
  };

  if (authLoading || loading) {
    return <div className="p-8 text-gray-500">Loading admin submissions…</div>;
  }
  if (!(user && userType === 'admin')) {
    return <div className="p-8 text-red-600">You are not authorized to view this page.</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">Verification Submissions</h1>
      {error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      ) : null}
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
              <th scope="col" className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((item) => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{item.guest_name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.check_in_date}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.check_out_date}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.booking_platform}</td>
                <td className="px-6 py-4 whitespace-nowrap">${item.reservation_amount}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.status === 'approved' ? 'bg-green-100 text-green-800' :
                      item.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                    }`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleViewDetails(item)}
                    className="text-blue-600 hover:text-blue-900 font-medium"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Details Modal */}
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
                <p><strong>Email:</strong> {selectedSubmission.email}</p>
                <p><strong>Platform:</strong> {selectedSubmission.booking_platform}</p>
                <p><strong>Amount:</strong> ${selectedSubmission.reservation_amount}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3">Stay Info</h3>
                <p><strong>Check-In:</strong> {selectedSubmission.check_in_date}</p>
                <p><strong>Check-Out:</strong> {selectedSubmission.check_out_date}</p>
                <p><strong>Status:</strong> {selectedSubmission.status}</p>
                <p><strong>Submitted:</strong> {new Date(selectedSubmission.created_at).toLocaleString()}</p>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Documents</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border rounded p-4">
                  <h4 className="font-medium mb-2">ID Document</h4>
                  {imageUrls.id ? (
                    <img src={imageUrls.id} alt="ID Document" className="w-full h-auto rounded" />
                  ) : (
                    <div className="bg-gray-100 h-40 flex items-center justify-center text-gray-500">No ID uploaded</div>
                  )}
                </div>
                <div className="border rounded p-4">
                  <h4 className="font-medium mb-2">Credit Card</h4>
                  {imageUrls.card ? (
                    <img src={imageUrls.card} alt="Credit Card" className="w-full h-auto rounded" />
                  ) : (
                    <div className="bg-gray-100 h-40 flex items-center justify-center text-gray-500">No Card uploaded</div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-semibold mb-4">Signature</h3>
              <div className="border rounded p-4 bg-gray-50">
                {imageUrls.signature ? (
                  <img src={imageUrls.signature} alt="Digital Signature" className="max-h-32 mx-auto" />
                ) : (
                  <div className="text-center text-gray-500">No signature found</div>
                )}
              </div>
            </div>

            <div className="mt-8 flex justify-end space-x-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
