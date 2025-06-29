import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Eye, CheckCircle, XCircle, Clock, Users, FileText, Calendar, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface GuestSubmission {
  id: string;
  reservation_id: string;
  guest_name: string;
  email: string;
  check_in_date: string;
  check_out_date: string;
  reservation_amount: number;
  booking_platform: string;
  id_document_name: string;
  id_document_url: string;
  credit_card_name: string;
  credit_card_url: string;
  signature_data: string;
  status: 'pending' | 'verified' | 'rejected';
  created_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

export function AdminSubmissions() {
  const [submissions, setSubmissions] = useState<GuestSubmission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<GuestSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<GuestSubmission | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    verified: 0,
    rejected: 0,
    today: 0,
  });

  useEffect(() => {
    fetchSubmissions();
  }, []);

  useEffect(() => {
    filterSubmissions();
  }, [submissions, searchTerm, statusFilter, dateFilter]);

  const fetchSubmissions = async () => {
    try {
      // Fetch reservations with related verification documents and digital signatures
      const { data: reservationsData, error: reservationsError } = await supabase
        .from('reservations')
        .select(`
          *,
          verification_documents (
            id,
            id_document_name,
            id_document_url,
            credit_card_name,
            credit_card_url,
            status,
            reviewed_by,
            reviewed_at,
            created_at
          ),
          digital_signatures (
            signature_data,
            form_data
          )
        `)
        .order('created_at', { ascending: false });

      if (reservationsError) throw reservationsError;

      // Transform the data to match our interface
      const transformedData: GuestSubmission[] = (reservationsData || [])
        .filter(reservation => reservation.verification_documents && reservation.verification_documents.length > 0)
        .map((reservation) => {
          const verification = reservation.verification_documents[0];
          const signature = reservation.digital_signatures?.[0];
          const formData = signature?.form_data || {};
          
          return {
            id: verification.id,
            reservation_id: reservation.id,
            guest_name: reservation.guest_name,
            email: formData.email || 'N/A',
            check_in_date: reservation.check_in_date || '',
            check_out_date: reservation.check_out_date || '',
            reservation_amount: reservation.total_amount || 0,
            booking_platform: reservation.booking_platform || 'N/A',
            id_document_name: verification.id_document_name || '',
            id_document_url: verification.id_document_url || '',
            credit_card_name: verification.credit_card_name || '',
            credit_card_url: verification.credit_card_url || '',
            signature_data: signature?.signature_data || '',
            status: verification.status,
            created_at: verification.created_at,
            reviewed_by: verification.reviewed_by,
            reviewed_at: verification.reviewed_at,
          };
        });
      
      setSubmissions(transformedData);
      
      // Calculate stats
      const today = new Date().toDateString();
      const statsData = {
        total: transformedData.length,
        pending: transformedData.filter(s => s.status === 'pending').length,
        verified: transformedData.filter(s => s.status === 'verified').length,
        rejected: transformedData.filter(s => s.status === 'rejected').length,
        today: transformedData.filter(s => new Date(s.created_at).toDateString() === today).length,
      };
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterSubmissions = () => {
    let filtered = submissions;

    if (searchTerm) {
      filtered = filtered.filter(
        (submission) =>
          submission.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          submission.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((submission) => submission.status === statusFilter);
    }

    if (dateFilter) {
      filtered = filtered.filter((submission) => 
        submission.created_at.startsWith(dateFilter)
      );
    }

    setFilteredSubmissions(filtered);
  };

  const updateSubmissionStatus = async (id: string, status: 'verified' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('verification_documents')
        .update({ 
          status,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      // Refresh data
      fetchSubmissions();
    } catch (error) {
      console.error('Error updating submission:', error);
    }
  };

  const handleSecureDownload = async (documentUrl: string, documentName: string) => {
    try {
      // Create a temporary link to download the file
      const link = document.createElement('a');
      link.href = documentUrl;
      link.download = documentName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading document:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
          <div className="grid md:grid-cols-5 gap-6 mb-8">
            {[1, 2, 3, 4, 5].map((i) => (
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
            <h1 className="text-3xl font-bold text-gray-900">Guest Submissions</h1>
            <p className="text-gray-600">Review and manage verification submissions</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Submissions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Pending Review</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Verified</p>
              <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Rejected</p>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Today</p>
              <p className="text-2xl font-bold text-blue-600">{stats.today}</p>
            </div>
            <Calendar className="h-8 w-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by guest name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-gray-400" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submissions Table */}
        <div className="overflow-x-auto">
          {filteredSubmissions.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No submissions found</h3>
              <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Guest Information
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stay Details
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Documents
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSubmissions.map((submission) => (
                  <tr key={submission.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{submission.guest_name}</div>
                        <div className="text-sm text-gray-500">{submission.email}</div>
                        <div className="text-xs text-gray-400">{submission.booking_platform}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {submission.check_in_date && submission.check_out_date ? (
                          <>
                            <div className="text-gray-900 font-medium">
                              {new Date(submission.check_in_date).toLocaleDateString()} - 
                              {new Date(submission.check_out_date).toLocaleDateString()}
                            </div>
                            <div className="text-gray-500">${submission.reservation_amount}</div>
                          </>
                        ) : (
                          <span className="text-gray-400">No dates provided</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-blue-500" />
                          <span className="text-xs text-gray-600">
                            {submission.id_document_name ? (
                              <button
                                onClick={() => handleSecureDownload(submission.id_document_url, submission.id_document_name)}
                                className="text-blue-600 hover:text-blue-800 underline"
                              >
                                ID: {submission.id_document_name}
                              </button>
                            ) : (
                              'ID: Not uploaded'
                            )}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-green-500" />
                          <span className="text-xs text-gray-600">
                            {submission.credit_card_name ? (
                              <button
                                onClick={() => handleSecureDownload(submission.credit_card_url, submission.credit_card_name)}
                                className="text-blue-600 hover:text-blue-800 underline"
                              >
                                Card: {submission.credit_card_name}
                              </button>
                            ) : (
                              'Card: Not uploaded'
                            )}
                          </span>
                        </div>
                        {submission.signature_data && (
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4 text-purple-500" />
                            <span className="text-xs text-gray-600">Signature: Available</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(submission.status)}`}>
                        {getStatusIcon(submission.status)}
                        <span className="capitalize">{submission.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {new Date(submission.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(submission.created_at).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => setSelectedSubmission(submission)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded-lg hover:bg-blue-50 transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {submission.status === 'pending' && (
                          <>
                            <button
                              onClick={() => updateSubmissionStatus(submission.id, 'verified')}
                              className="text-green-600 hover:text-green-900 p-1 rounded-lg hover:bg-green-50 transition-colors"
                              title="Verify"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => updateSubmissionStatus(submission.id, 'rejected')}
                              className="text-red-600 hover:text-red-900 p-1 rounded-lg hover:bg-red-50 transition-colors"
                              title="Reject"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Submission Detail Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900">
                  Submission Details - {selectedSubmission.guest_name}
                </h3>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-8">
              {/* Guest Information */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Guest Information</h4>
                <div className="grid md:grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Name</label>
                    <p className="text-gray-900 font-medium">{selectedSubmission.guest_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-gray-900">{selectedSubmission.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Booking Platform</label>
                    <p className="text-gray-900">{selectedSubmission.booking_platform}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Check-in Date</label>
                    <p className="text-gray-900">
                      {selectedSubmission.check_in_date ? 
                        new Date(selectedSubmission.check_in_date).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Check-out Date</label>
                    <p className="text-gray-900">
                      {selectedSubmission.check_out_date ? 
                        new Date(selectedSubmission.check_out_date).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Reservation Amount</label>
                    <p className="text-gray-900 font-semibold">${selectedSubmission.reservation_amount}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedSubmission.status)}`}>
                      {getStatusIcon(selectedSubmission.status)}
                      <span className="capitalize">{selectedSubmission.status}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Documents</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <FileText className="h-5 w-5 text-blue-500" />
                      <h5 className="font-medium text-gray-900">Cardholder's ID</h5>
                    </div>
                    {selectedSubmission.id_document_name ? (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">{selectedSubmission.id_document_name}</p>
                        <button
                          onClick={() => handleSecureDownload(selectedSubmission.id_document_url, selectedSubmission.id_document_name)}
                          className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download</span>
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">Not uploaded</p>
                    )}
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <FileText className="h-5 w-5 text-green-500" />
                      <h5 className="font-medium text-gray-900">Credit Card</h5>
                    </div>
                    {selectedSubmission.credit_card_name ? (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">{selectedSubmission.credit_card_name}</p>
                        <button
                          onClick={() => handleSecureDownload(selectedSubmission.credit_card_url, selectedSubmission.credit_card_name)}
                          className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download</span>
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">Not uploaded</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Digital Signature */}
              {selectedSubmission.signature_data && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Digital Signature</h4>
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <img 
                      src={selectedSubmission.signature_data} 
                      alt="Digital Signature" 
                      className="max-w-full h-auto border border-gray-300 rounded bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                {selectedSubmission.status === 'pending' && (
                  <>
                    <button
                      onClick={() => {
                        updateSubmissionStatus(selectedSubmission.id, 'rejected');
                        setSelectedSubmission(null);
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => {
                        updateSubmissionStatus(selectedSubmission.id, 'verified');
                        setSelectedSubmission(null);
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Verify</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}