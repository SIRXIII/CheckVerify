import React, { useState, useEffect } from 'react';
import { Search, Filter, Eye, CheckCircle, XCircle, Clock, Users, FileText, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface VerificationSubmission {
  id: string;
  first_name: string;
  last_name: string;
  check_in_date: string;
  check_out_date: string;
  reservation_amount: number;
  id_document_name: string;
  credit_card_name: string;
  status: 'pending' | 'verified' | 'rejected';
  created_at: string;
  signature_data?: string;
}

export function AdminDashboard() {
  const [submissions, setSubmissions] = useState<VerificationSubmission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<VerificationSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<VerificationSubmission | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    verified: 0,
    rejected: 0,
  });

  useEffect(() => {
    fetchSubmissions();
  }, []);

  useEffect(() => {
    filterSubmissions();
  }, [submissions, searchTerm, statusFilter]);

  const fetchSubmissions = async () => {
    try {
      // Fetch verification documents with signature data
      const { data: verificationData, error: verificationError } = await supabase
        .from('verification_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (verificationError) throw verificationError;

      // Fetch digital signatures
      const { data: signatureData, error: signatureError } = await supabase
        .from('digital_signatures')
        .select('*')
        .order('created_at', { ascending: false });

      if (signatureError) throw signatureError;

      // Combine the data (in a real app, you'd have proper foreign key relationships)
      const combinedData: VerificationSubmission[] = (verificationData || []).map((verification, index) => {
        const signature = signatureData?.[index];
        const formData = signature?.form_data || {};
        
        return {
          id: verification.id,
          first_name: formData.firstName || 'N/A',
          last_name: formData.lastName || 'N/A',
          check_in_date: formData.checkInDate || '',
          check_out_date: formData.checkOutDate || '',
          reservation_amount: formData.reservationAmount || 0,
          id_document_name: verification.id_document_name || '',
          credit_card_name: verification.credit_card_name || '',
          status: verification.status,
          created_at: verification.created_at,
          signature_data: signature?.signature_data,
        };
      });
      
      setSubmissions(combinedData);
      
      // Calculate stats
      const statsData = {
        total: combinedData.length,
        pending: combinedData.filter(s => s.status === 'pending').length,
        verified: combinedData.filter(s => s.status === 'verified').length,
        rejected: combinedData.filter(s => s.status === 'rejected').length,
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
          submission.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          submission.last_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((submission) => submission.status === statusFilter);
    }

    setFilteredSubmissions(filtered);
  };

  const updateSubmissionStatus = async (id: string, status: 'verified' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('verification_documents')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      
      // Refresh data
      fetchSubmissions();
    } catch (error) {
      console.error('Error updating submission:', error);
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
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Review and manage verification submissions</p>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Submissions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Review</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Verified</p>
              <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Rejected</p>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm mb-6">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by guest name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submissions Table */}
        <div className="overflow-x-auto">
          {filteredSubmissions.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No submissions found</h3>
              <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Guest Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dates
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Documents
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSubmissions.map((submission) => (
                  <tr key={submission.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {submission.first_name} {submission.last_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {submission.check_in_date && submission.check_out_date ? (
                          <>
                            {new Date(submission.check_in_date).toLocaleDateString()} - 
                            {new Date(submission.check_out_date).toLocaleDateString()}
                          </>
                        ) : (
                          'N/A'
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ${submission.reservation_amount || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs text-gray-600">
                        <div>ID: {submission.id_document_name || 'Not uploaded'}</div>
                        <div>Card: {submission.credit_card_name || 'Not uploaded'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(submission.status)}`}>
                        {getStatusIcon(submission.status)}
                        <span className="capitalize">{submission.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(submission.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => setSelectedSubmission(submission)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {submission.status === 'pending' && (
                          <>
                            <button
                              onClick={() => updateSubmissionStatus(submission.id, 'verified')}
                              className="text-green-600 hover:text-green-900"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => updateSubmissionStatus(submission.id, 'rejected')}
                              className="text-red-600 hover:text-red-900"
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
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">
                  Submission Details
                </h3>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Guest Name</label>
                  <p className="text-gray-900">{selectedSubmission.first_name} {selectedSubmission.last_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Reservation Amount</label>
                  <p className="text-gray-900">${selectedSubmission.reservation_amount}</p>
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
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Documents</label>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">ID: {selectedSubmission.id_document_name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Credit Card: {selectedSubmission.credit_card_name}</span>
                  </div>
                </div>
              </div>

              {selectedSubmission.signature_data && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Digital Signature</label>
                  <div className="mt-2 border border-gray-200 rounded-lg p-4">
                    <img 
                      src={selectedSubmission.signature_data} 
                      alt="Digital Signature" 
                      className="max-w-full h-auto"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                {selectedSubmission.status === 'pending' && (
                  <>
                    <button
                      onClick={() => {
                        updateSubmissionStatus(selectedSubmission.id, 'rejected');
                        setSelectedSubmission(null);
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => {
                        updateSubmissionStatus(selectedSubmission.id, 'verified');
                        setSelectedSubmission(null);
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      Verify
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}