import React, { useState } from 'react';
import { CheckCircle, AlertCircle, CreditCard, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  url?: string;
}

export function VerificationProcess() {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [idDocument, setIdDocument] = useState<UploadedFile | null>(null);
  const [creditCard, setCreditCard] = useState<UploadedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleFileUpload = (file: File, type: 'id' | 'credit_card') => {
    const uploadedFile: UploadedFile = {
      name: file.name,
      size: file.size,
      type: file.type,
    };

    if (type === 'id') {
      setIdDocument(uploadedFile);
    } else {
      setCreditCard(uploadedFile);
    }
  };

  const handleSubmitDocuments = async () => {
    if (!idDocument || !creditCard) {
      setError('Please upload both ID document and credit card');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // In a real implementation, you would upload files to Supabase Storage
      // and save the document information to the database
      const { error } = await supabase
        .from('verification_documents')
        .insert([
          {
            traveler_id: user?.id,
            id_document_name: idDocument.name,
            credit_card_name: creditCard.name,
            status: 'pending',
          },
        ]);

      if (error) throw error;

      setSuccess(true);
      setCurrentStep(3);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message || 'An error occurred during upload');
      } else {
        setError('An error occurred during upload');
      }
    } finally {
      setLoading(false);
    }
  };

  const FileUploadArea = ({ 
    onFileSelect, 
    accept, 
    title, 
    description, 
    icon: Icon,
    uploadedFile 
  }: {
    onFileSelect: (file: File) => void;
    accept: string;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    uploadedFile: UploadedFile | null;
  }) => (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-500 transition-colors">
      <div className="text-center">
        <Icon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-4">{description}</p>
        
        {uploadedFile ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-green-800">{uploadedFile.name}</span>
            </div>
            <p className="text-xs text-green-600 mt-1">
              {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        ) : (
          <label className="cursor-pointer">
            <span className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              Choose File
            </span>
            <input
              type="file"
              accept={accept}
              onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
              className="hidden"
            />
          </label>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Document Verification</h1>
        <p className="text-gray-600">Upload your identification and payment documents for verification</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className={`flex items-center space-x-2 ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}>
              1
            </div>
            <span className="font-medium">Upload Documents</span>
          </div>
          
          <div className={`flex-1 h-1 mx-4 ${currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
          
          <div className={`flex items-center space-x-2 ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}>
              2
            </div>
            <span className="font-medium">Review & Submit</span>
          </div>
          
          <div className={`flex-1 h-1 mx-4 ${currentStep >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
          
          <div className={`flex items-center space-x-2 ${currentStep >= 3 ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep >= 3 ? 'bg-green-600 text-white' : 'bg-gray-200'
            }`}>
              3
            </div>
            <span className="font-medium">Complete</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5" />
            <span>Documents uploaded successfully! They are now under review.</span>
          </div>
        </div>
      )}

      {currentStep === 1 && (
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Upload Required Documents</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <FileUploadArea
              onFileSelect={(file) => handleFileUpload(file, 'id')}
              accept="image/*,.pdf"
              title="Government ID"
              description="Upload a clear photo of your driver's license, passport, or government-issued ID"
              icon={User}
              uploadedFile={idDocument}
            />
            
            <FileUploadArea
              onFileSelect={(file) => handleFileUpload(file, 'credit_card')}
              accept="image/*,.pdf"
              title="Credit Card"
              description="Upload a photo of the credit card used for booking (cover CVV for security)"
              icon={CreditCard}
              uploadedFile={creditCard}
            />
          </div>

          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Security Notice:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>All documents are encrypted and stored securely</li>
                  <li>Cover or blur the CVV number on your credit card</li>
                  <li>Ensure all text is clearly readable</li>
                  <li>Accepted formats: JPG, PNG, PDF (max 10MB)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={() => setCurrentStep(2)}
              disabled={!idDocument || !creditCard}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Continue to Review
            </button>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Review Your Documents</h2>
          
          <div className="space-y-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-2">
                <User className="h-5 w-5 text-blue-600" />
                <h3 className="font-medium text-gray-900">Government ID</h3>
              </div>
              <p className="text-sm text-gray-600">File: {idDocument?.name}</p>
              <p className="text-sm text-gray-600">Size: {idDocument && (idDocument.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <h3 className="font-medium text-gray-900">Credit Card</h3>
              </div>
              <p className="text-sm text-gray-600">File: {creditCard?.name}</p>
              <p className="text-sm text-gray-600">Size: {creditCard && (creditCard.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>

          <div className="mt-8 flex justify-between">
            <button
              onClick={() => setCurrentStep(1)}
              className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Back to Upload
            </button>
            <button
              onClick={handleSubmitDocuments}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Documents'}
            </button>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Documents Submitted Successfully!</h2>
          <p className="text-gray-600 mb-6">
            Your documents have been uploaded and are now under review. 
            You'll receive an email notification once the verification is complete.
          </p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => window.location.href = '/traveler-dashboard'}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}