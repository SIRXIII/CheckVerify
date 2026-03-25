import React from 'react';
import { User, CreditCard, ShieldCheck } from 'lucide-react';
import { FileUploadArea } from './FileUploadArea';
import type { UploadedFile } from './FileUploadArea';

interface DocumentUploadStepProps {
  idDocument: UploadedFile | null;
  creditCard: UploadedFile | null;
  onIdUpload: (file: File) => void;
  onCardUpload: (file: File) => void;
  onNext: () => void;
  onBack: () => void;
}

export function DocumentUploadStep({
  idDocument,
  creditCard,
  onIdUpload,
  onCardUpload,
  onNext,
  onBack,
}: DocumentUploadStepProps) {
  const bothUploaded = idDocument !== null && creditCard !== null;

  return (
    <div>
      <h2 className="text-2xl font-heading font-semibold text-gray-900 mb-8 flex items-center space-x-3">
        <div className="bg-hostla-light p-2 rounded-lg">
          <ShieldCheck className="h-6 w-6 text-hostla-primary" />
        </div>
        <span>Document Upload</span>
      </h2>

      <div className="grid md:grid-cols-2 gap-8">
        <FileUploadArea
          onFileSelect={onIdUpload}
          accept="image/*,.pdf"
          title="Cardholder's / Booker's ID"
          description="Upload your driver's license or passport (upload both, if different)"
          icon={User}
          uploadedFile={idDocument}
        />

        <FileUploadArea
          onFileSelect={onCardUpload}
          accept="image/*,.pdf"
          title="Credit Card"
          description="The credit card must match the card submitted on the booking website"
          icon={CreditCard}
          uploadedFile={creditCard}
        />
      </div>

      {/* Security Notice */}
      <div className="mt-8 bg-hostla-light border border-hostla-primary/20 rounded-xl p-4 flex items-start space-x-3">
        <ShieldCheck className="h-5 w-5 text-hostla-primary mt-0.5 flex-shrink-0" />
        <p className="text-sm text-gray-700">
          Your documents are encrypted in transit and stored securely. We only use
          them for identity verification purposes and never share them with third
          parties.
        </p>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-10">
        <button
          type="button"
          onClick={onBack}
          className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-3 rounded-xl font-semibold text-lg transition-all duration-200"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!bothUploaded}
          className="bg-hostla-primary hover:bg-hostla-secondary text-white px-8 py-3 rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
