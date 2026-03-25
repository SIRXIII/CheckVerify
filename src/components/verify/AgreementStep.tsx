import React, { useEffect, useRef, useState } from 'react';
import { FileText, PenTool } from 'lucide-react';
import SignaturePad from 'signature_pad';
import {
  rentalAgreementSections,
  interpolateAgreement,
} from '../../data/rentalAgreement';

interface AgreementStepProps {
  formData: {
    firstName: string;
    lastName: string;
    email: string;
    checkInDate: string;
    checkOutDate: string;
    reservationAmount: string;
    bookingPlatform: string;
  };
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
  signaturePadRef: React.MutableRefObject<SignaturePad | null>;
}

export function AgreementStep({
  formData,
  onSubmit,
  onBack,
  loading,
  signaturePadRef,
}: AgreementStepProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(ratio, ratio);
    }

    const pad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 50)',
      minWidth: 1,
      maxWidth: 2.5,
    });
    pad.clear();
    signaturePadRef.current = pad;

    return () => {
      pad.off();
    };
  }, [signaturePadRef]);

  const clearSignature = () => {
    signaturePadRef.current?.clear();
  };

  const guestName = `${formData.firstName} ${formData.lastName}`.trim();
  const totalFormatted = formData.reservationAmount
    ? `$${Number(formData.reservationAmount).toFixed(2)}`
    : '$0.00';
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const sections = interpolateAgreement(rentalAgreementSections, {
    guestName: guestName || '_______________',
    checkInDate: formData.checkInDate || '_______________',
    checkOutDate: formData.checkOutDate || '_______________',
    totalAmount: totalFormatted,
  });

  return (
    <div>
      <h2 className="text-2xl font-heading font-semibold text-gray-900 mb-6 flex items-center space-x-3">
        <div className="bg-hostla-light p-2 rounded-lg">
          <FileText className="h-6 w-6 text-hostla-primary" />
        </div>
        <span>Review & Sign Agreement</span>
      </h2>

      <p className="text-sm text-gray-500 mb-6">
        Please review the rental agreement below. Scroll through the entire document, then sign at the bottom.
      </p>

      {/* Document-style contract */}
      <div className="border border-gray-300 rounded-xl shadow-sm bg-white mb-8">
        {/* Document header */}
        <div className="border-b border-gray-200 px-8 py-5 bg-gray-50 rounded-t-xl">
          <h3 className="text-xl font-heading font-bold text-gray-900 text-center">
            RENTAL AGREEMENT
          </h3>
          <p className="text-sm text-gray-500 text-center mt-1">
            HOST LA PR &mdash; Short-Term Vacation Rental
          </p>
        </div>

        {/* Scrollable contract body */}
        <div className="max-h-[28rem] overflow-y-auto px-8 py-6">
          {/* Preamble */}
          <p className="text-sm text-gray-700 mb-6 leading-relaxed">
            This Rental Agreement (&ldquo;Agreement&rdquo;) is entered into on{' '}
            <span className="font-semibold">{today}</span> between HOST LA PR
            (&ldquo;Host&rdquo;) and{' '}
            <span className="font-semibold">{guestName || '_______________'}</span>{' '}
            (&ldquo;Guest&rdquo;) for the reservation period of{' '}
            <span className="font-semibold">{formData.checkInDate || '_______________'}</span>{' '}
            to{' '}
            <span className="font-semibold">{formData.checkOutDate || '_______________'}</span>,
            with a total amount of{' '}
            <span className="font-semibold">{totalFormatted}</span>.
          </p>

          <hr className="my-5 border-gray-200" />

          {/* Clauses */}
          <div className="space-y-5 text-sm text-gray-700 leading-relaxed">
            {sections.map((section, index) => (
              <div key={index}>
                <p className="font-semibold text-gray-900 mb-1">
                  {index + 1}. {section.title}
                </p>
                <p>{section.body}</p>
              </div>
            ))}
          </div>

          <hr className="my-6 border-gray-200" />

          {/* Signature block - DocuSign style */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <div className="flex items-center space-x-2 mb-4">
              <PenTool className="h-5 w-5 text-hostla-primary" />
              <p className="text-sm font-semibold text-gray-900">Sign Here</p>
            </div>

            <div className="border-2 border-hostla-primary/30 rounded-lg bg-white relative">
              <canvas
                ref={canvasRef}
                className="w-full h-32 cursor-crosshair touch-none rounded-lg"
              />
              <div className="absolute bottom-2 left-4 right-4 border-b border-gray-300"></div>
            </div>

            <div className="flex justify-between items-center mt-3">
              <p className="text-xs text-gray-400">Draw your signature above the line</p>
              <button
                type="button"
                onClick={clearSignature}
                className="text-hostla-primary hover:text-hostla-secondary text-xs font-medium px-3 py-1 rounded hover:bg-hostla-light transition-colors"
              >
                Clear
              </button>
            </div>

            {/* Printed name and date */}
            <div className="grid grid-cols-2 gap-6 mt-5 pt-4 border-t border-gray-200">
              <div>
                <p className="text-xs text-gray-400 mb-1">Printed Name</p>
                <p className="text-sm font-medium text-gray-900 border-b border-gray-300 pb-1">
                  {guestName || '_______________'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Date Signed</p>
                <p className="text-sm font-medium text-gray-900 border-b border-gray-300 pb-1">
                  {today}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Consent Checkbox */}
      <label className="flex items-start space-x-4 p-5 bg-hostla-light rounded-xl border border-hostla-primary/20 cursor-pointer mb-8">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-5 w-5 text-hostla-primary border-gray-300 rounded focus:ring-hostla-primary"
        />
        <span className="text-sm text-gray-700 leading-relaxed">
          I have read and agree to the terms of this Rental Agreement. I confirm that all
          information provided is accurate and that this digital signature has the same
          legal effect as a handwritten signature.
        </span>
      </label>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-3 rounded-xl font-semibold text-lg transition-all duration-200 disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || !agreed}
          className="bg-hostla-primary hover:bg-hostla-secondary text-white px-8 py-3 rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Submitting...' : 'Complete & Sign'}
        </button>
      </div>
    </div>
  );
}
