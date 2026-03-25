import React from 'react';
import { CheckCircle } from 'lucide-react';

interface ConfirmationStepProps {
  guestName: string;
  confirmationNumber: string;
}

export function ConfirmationStep({
  guestName,
  confirmationNumber,
}: ConfirmationStepProps) {
  return (
    <div className="text-center py-8">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="h-10 w-10 text-green-600" />
      </div>

      <h2 className="text-3xl font-heading font-bold text-gray-900 mb-4">
        Verification Submitted Successfully!
      </h2>

      <p className="text-lg text-gray-600 mb-6 max-w-lg mx-auto">
        Thank you, {guestName}. Your documents and payment consent have been
        submitted for review. You will receive a confirmation email once your
        verification is complete.
      </p>

      <div className="inline-block bg-gray-50 border border-gray-200 rounded-xl px-8 py-4 mb-8">
        <p className="text-sm text-gray-500 mb-1">Confirmation Number</p>
        <p className="text-2xl font-heading font-bold text-hostla-dark tracking-wider">
          {confirmationNumber}
        </p>
      </div>

      <div>
        <button
          onClick={() => (window.location.href = '/')}
          className="bg-hostla-primary hover:bg-hostla-secondary text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
        >
          Return to Home
        </button>
      </div>
    </div>
  );
}
