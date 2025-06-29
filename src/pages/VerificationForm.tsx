import React, { useState, useRef, useEffect } from 'react';
import { Upload, CheckCircle, AlertCircle, User, CreditCard, DollarSign, FileText } from 'lucide-react';
import SignaturePad from 'signature_pad';
import { supabase } from '../lib/supabase';

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  file: File;
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  checkInDate: string;
  checkOutDate: string;
  reservationAmount: string;
  bookingPlatform: string;
}

export function VerificationForm() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    checkInDate: '',
    checkOutDate: '',
    reservationAmount: '',
    bookingPlatform: 'Booking.com',
  });
  
  const [idDocument, setIdDocument] = useState<UploadedFile | null>(null);
  const [creditCard, setCreditCard] = useState<UploadedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    initializeSignaturePad();
  }, []);

  const initializeSignaturePad = () => {
    if (canvasRef.current) {
      signaturePadRef.current = new SignaturePad(canvasRef.current, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)',
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileUpload = (file: File, type: 'id' | 'credit_card') => {
    const uploadedFile: UploadedFile = {
      name: file.name,
      size: file.size,
      type: file.type,
      file: file,
    };

    if (type === 'id') {
      setIdDocument(uploadedFile);
    } else {
      setCreditCard(uploadedFile);
    }
  };

  const clearSignature = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
    }
  };

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) {
      throw new Error(`Failed to upload ${folder}: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const generateConfirmationNumber = (): string => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `HLA${timestamp}${random}`;
  };

  const validateForm = () => {
    if (!formData.firstName.trim()) return 'First name is required';
    if (!formData.lastName.trim()) return 'Last name is required';
    if (!formData.email.trim()) return 'Email is required';
    if (!formData.checkInDate) return 'Check-in date is required';
    if (!formData.checkOutDate) return 'Check-out date is required';
    if (!formData.reservationAmount.trim()) return 'Reservation amount is required';
    if (!idDocument) return 'Cardholder\'s ID is required';
    if (!creditCard) return 'Credit card image is required';
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) return 'Digital signature is required';
    if (!agreed) return 'You must agree to the payment processing consent';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Upload files to Supabase Storage
      const [idDocumentUrl, creditCardUrl] = await Promise.all([
        uploadFile(idDocument!.file, 'id-documents'),
        uploadFile(creditCard!.file, 'credit-cards')
      ]);

      const signatureDataURL = signaturePadRef.current!.toDataURL();
      const confirmationNumber = generateConfirmationNumber();

      // Create reservation record
      const { data: reservationData, error: reservationError } = await supabase
        .from('reservations')
        .insert([
          {
            confirmation_number: confirmationNumber,
            guest_name: `${formData.firstName} ${formData.lastName}`,
            check_in_date: formData.checkInDate,
            check_out_date: formData.checkOutDate,
            total_amount: parseFloat(formData.reservationAmount),
            booking_platform: formData.bookingPlatform,
            status: 'pending',
          },
        ])
        .select()
        .single();

      if (reservationError) throw reservationError;

      // Create verification document record
      const { error: verificationError } = await supabase
        .from('verification_documents')
        .insert([
          {
            reservation_id: reservationData.id,
            id_document_name: idDocument!.name,
            id_document_url: idDocumentUrl,
            credit_card_name: creditCard!.name,
            credit_card_url: creditCardUrl,
            status: 'pending',
          },
        ]);

      if (verificationError) throw verificationError;

      // Create digital signature record
      const { error: signatureError } = await supabase
        .from('digital_signatures')
        .insert([
          {
            reservation_id: reservationData.id,
            signature_data: signatureDataURL,
            form_data: {
              ...formData,
              reservationAmount: parseFloat(formData.reservationAmount),
            },
          },
        ]);

      if (signatureError) throw signatureError;

      setSuccess(true);
    } catch (error: any) {
      console.error('Submission error:', error);
      setError(error.message || 'An error occurred during submission');
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

  if (success) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Verification Submitted Successfully!</h2>
          <p className="text-gray-600 mb-6">
            Your documents and payment consent have been submitted for review. 
            You'll receive confirmation once your verification is complete.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Hotel Check-in Verification</h1>
        <p className="text-gray-600">Complete your verification to streamline your check-in process</p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-8">
        {/* Guest Information */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
            <User className="h-6 w-6 text-blue-600" />
            <span>Guest Information</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name *
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your first name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name *
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your last name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your email address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Booking Platform *
              </label>
              <select
                name="bookingPlatform"
                value={formData.bookingPlatform}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Booking.com">Booking.com</option>
                <option value="Expedia">Expedia</option>
                <option value="Hotels.com">Hotels.com</option>
                <option value="Airbnb">Airbnb</option>
                <option value="Direct">Direct Booking</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Check-in Date *
              </label>
              <input
                type="date"
                name="checkInDate"
                value={formData.checkInDate}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Check-out Date *
              </label>
              <input
                type="date"
                name="checkOutDate"
                value={formData.checkOutDate}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Document Upload */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
            <Upload className="h-6 w-6 text-blue-600" />
            <span>Document Upload</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <FileUploadArea
              onFileSelect={(file) => handleFileUpload(file, 'id')}
              accept="image/*,.pdf"
              title="Cardholder's ID"
              description="Upload your driver's license or passport"
              icon={User}
              uploadedFile={idDocument}
            />
            
            <FileUploadArea
              onFileSelect={(file) => handleFileUpload(file, 'credit_card')}
              accept="image/*,.pdf"
              title="Credit Card"
              description="Credit Card must match the reservation (cover CVV)"
              icon={CreditCard}
              uploadedFile={creditCard}
            />
          </div>
        </div>

        {/* Payment Information */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
            <DollarSign className="h-6 w-6 text-blue-600" />
            <span>Payment Information</span>
          </h2>
          <div className="max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reservation Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                name="reservationAmount"
                value={formData.reservationAmount}
                onChange={handleInputChange}
                step="0.01"
                min="0"
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Digital Signature */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
            <FileText className="h-6 w-6 text-blue-600" />
            <span>Digital Signature</span>
          </h2>
          
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <div className="space-y-4 text-sm text-gray-700">
              <p>
                I hereby authorize the charges already made by <strong>HOST LA PR</strong> for my reservation (via Booking / Expedia).
              </p>
              
              <p>I understand and agree to the policies stipulated on the website upon booking – they are as follows:</p>
              
              <div className="space-y-3 ml-4">
                <div className="flex items-start space-x-3">
                  <span className="font-semibold text-gray-900 min-w-[20px]">1.</span>
                  <span>The <u>total rental amount</u> includes all applicable taxes and fees.</span>
                </div>
                
                <div className="flex items-start space-x-3">
                  <span className="font-semibold text-gray-900 min-w-[20px]">2.</span>
                  <span>Any additional charges incurred during the rental period (e.g., damages, extra services) will be charged to the above credit card.</span>
                </div>
                
                <div className="flex items-start space-x-3">
                  <span className="font-semibold text-gray-900 min-w-[20px]">3.</span>
                  <span>Cancellations made within 30 days from the check-in date are NON-refundable.</span>
                </div>
                
                <div className="flex items-start space-x-3">
                  <span className="font-semibold text-gray-900 min-w-[20px]">4.</span>
                  <span>NO-SHOWS are also NON-refundable. Date changes will be handled on a case by case basis at the discretion of management, depending on availability.</span>
                </div>
                
                <div className="flex items-start space-x-3">
                  <span className="font-semibold text-gray-900 min-w-[20px]">5.</span>
                  <span>I am responsible for any damages to the property during the rental period and authorize the above credit card to be charged for any necessary repairs or replacements.</span>
                </div>
                
                <div className="flex items-start space-x-3">
                  <span className="font-semibold text-gray-900 min-w-[20px]">6.</span>
                  <span>Eligible refunds will be made to the original form of payment, absolutely no exceptions.</span>
                </div>
                
                <div className="flex items-start space-x-3">
                  <span className="font-semibold text-gray-900 min-w-[20px]">7.</span>
                  <span><strong>IMPORTANT: Signature on this form must match the signature of the cardholder's ID.</strong></span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-300">
                <p className="font-semibold text-gray-900 mb-4">Please Sign and Date</p>
                <p className="mb-4">
                  <strong>Return the completed and signed form to the following:</strong><br />
                  HOST L.A.<br />
                  Business: 323-673-4171 / 424-666-8823<br />
                  Email: hostla2@icloud.com<br />
                  Los Angeles, CA
                </p>
              </div>
            </div>
          </div>

          <div className="border-2 border-gray-300 rounded-lg p-4">
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              className="w-full h-32 border border-gray-200 rounded"
            />
            <div className="flex justify-between items-center mt-3">
              <p className="text-sm text-gray-500">Sign above to consent</p>
              <button
                onClick={clearSignature}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Clear Signature
              </button>
            </div>
          </div>
        </div>

        {/* Consent Checkbox */}
        <div className="mb-8">
          <label className="flex items-start space-x-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              I hereby consent to Host LA processing my payment and confirm that all information provided is accurate. 
              I understand that this digital signature has the same legal effect as a handwritten signature and matches my cardholder's ID.
            </span>
          </label>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Verification'}
          </button>
        </div>
      </div>
    </div>
  );
}