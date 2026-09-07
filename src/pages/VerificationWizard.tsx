import React, { useState, useRef } from 'react';
import SignaturePad from 'signature_pad';
import { supabase } from '../lib/supabase';
import { WizardProgress } from '../components/verify/WizardProgress';
import { GuestInfoStep } from '../components/verify/GuestInfoStep';
import { DocumentUploadStep } from '../components/verify/DocumentUploadStep';
import { AgreementStep } from '../components/verify/AgreementStep';
import { ConfirmationStep } from '../components/verify/ConfirmationStep';
import type { UploadedFile } from '../components/verify/FileUploadArea';
import { AlertCircle } from 'lucide-react';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  checkInDate: string;
  checkOutDate: string;
  reservationAmount: string;
  bookingPlatform: string;
}

const STEPS = ['Guest Info', 'Documents', 'Agreement', 'Complete'];

export function VerificationWizard() {
  const signaturePadRef = useRef<SignaturePad | null>(null);

  const [currentStep, setCurrentStep] = useState(1);
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
  const [confirmationNumber, setConfirmationNumber] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = (file: File, type: 'id' | 'credit_card') => {
    const maxSize = 5 * 1024 * 1024;
    const allowedTypes = ['image/jpeg', 'image/png'];

    if (!allowedTypes.includes(file.type)) {
      setError('Unsupported file format. Please upload a JPG or PNG image.');
      return;
    }

    if (file.size > maxSize) {
      setError('File size exceeds the 5 MB limit.');
      return;
    }

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
    setError('');
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

    return filePath;
  };

  const generateConfirmationNumber = (): string => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `HLA${timestamp}${random}`;
  };

  const handleSubmit = async () => {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      setError('Digital signature is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [idDocumentPath, creditCardPath] = await Promise.all([
        uploadFile(idDocument!.file, 'id-documents'),
        uploadFile(creditCard!.file, 'credit-cards'),
      ]);

      const signatureDataURL = signaturePadRef.current!.toDataURL();
      const confNum = generateConfirmationNumber();

      const reservationId = crypto.randomUUID();

      const { error: reservationError } = await supabase
        .from('reservations')
        .insert([
          {
            id: reservationId,
            confirmation_number: confNum,
            guest_name: `${formData.firstName} ${formData.lastName}`,
            guest_email: formData.email.trim(),
            check_in_date: formData.checkInDate,
            check_out_date: formData.checkOutDate,
            total_amount: parseFloat(formData.reservationAmount),
            booking_platform: formData.bookingPlatform,
            status: 'pending',
          },
        ]);

      if (reservationError) throw reservationError;

      const { error: verificationError } = await supabase
        .from('verification_documents')
        .insert([
          {
            reservation_id: reservationId,
            id_document_name: idDocument!.name,
            id_document_path: idDocumentPath,
            credit_card_name: creditCard!.name,
            credit_card_path: creditCardPath,
            status: 'pending',
          },
        ]);

      if (verificationError) throw verificationError;

      const { error: signatureError } = await supabase
        .from('digital_signatures')
        .insert([
          {
            reservation_id: reservationId,
            signature_data: signatureDataURL,
            form_data: {
              ...formData,
              reservationAmount: parseFloat(formData.reservationAmount),
            },
          },
        ]);

      if (signatureError) throw signatureError;

      setConfirmationNumber(confNum);
      setCurrentStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Submission error:', err);
      setError(err.message || 'An error occurred during submission');
    } finally {
      setLoading(false);
    }
  };

  const goToStep = (step: number) => {
    setError('');
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-hostla-light">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/check-in-verify-logo.png"
            alt="Host LA Guest Verification"
            className="h-20 w-auto mx-auto drop-shadow-lg"
          />
        </div>

        {/* Title */}
        {currentStep < 4 && (
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-heading font-bold text-gray-900 mb-3">
              Guest Verification
            </h1>
            <p className="text-lg text-gray-600">
              Complete your verification for a smooth check-in experience
            </p>
          </div>
        )}

        {/* Progress Bar */}
        {currentStep < 4 && (
          <div className="mb-10">
            <WizardProgress currentStep={currentStep} steps={STEPS} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-xl mb-8 shadow-sm">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-6 w-6 flex-shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Step Content */}
        {currentStep < 4 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 lg:p-12">
            {currentStep === 1 && (
              <GuestInfoStep
                formData={formData}
                onChange={handleInputChange}
                onNext={() => goToStep(2)}
              />
            )}

            {currentStep === 2 && (
              <DocumentUploadStep
                idDocument={idDocument}
                creditCard={creditCard}
                onIdUpload={(file) => handleFileUpload(file, 'id')}
                onCardUpload={(file) => handleFileUpload(file, 'credit_card')}
                onNext={() => goToStep(3)}
                onBack={() => goToStep(1)}
              />
            )}

            {currentStep === 3 && (
              <AgreementStep
                formData={formData}
                onSubmit={handleSubmit}
                onBack={() => goToStep(2)}
                loading={loading}
                signaturePadRef={signaturePadRef}
              />
            )}
          </div>
        )}

        {currentStep === 4 && (
          <ConfirmationStep
            guestName={`${formData.firstName} ${formData.lastName}`}
            confirmationNumber={confirmationNumber}
          />
        )}

        {/* Security Footer */}
        {currentStep < 4 && (
          <div className="text-center mt-8">
            <p className="text-xs text-gray-500">
              <a href="/privacy.html" target="_blank" className="text-hostla-primary hover:text-hostla-secondary transition-colors">Privacy Policy</a>
              <span className="mx-2">·</span>
              <a href="/terms.html" target="_blank" className="text-hostla-primary hover:text-hostla-secondary transition-colors">Terms of Service</a>
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Your ID and card images are encrypted in transit and stored securely.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
