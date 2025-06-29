import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, FileCheck, Upload, CreditCard } from 'lucide-react';

export function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          {/* Centered Logo */}
          <div className="text-center mb-12">
            <img 
              src="/Check-In Verify LOGO.png" 
              alt="Check-In Verify Logo" 
              className="h-32 w-auto mx-auto drop-shadow-2xl hover:scale-105 transition-transform duration-300"
            />
          </div>
          
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Secure Hotel
              <span className="block text-yellow-400">Check-in Verification</span>
            </h1>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Streamlined document verification for your hotel stay. 
              Upload your ID and payment information safely before check-in.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/verify"
                className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-blue-900 px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                Start Verification
              </Link>
              <Link
                to="/admin/login"
                className="border-2 border-white text-white hover:bg-white hover:text-blue-900 px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                Admin Access
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Simple & Secure Verification
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Complete your check-in verification in just a few steps
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center p-8 rounded-2xl bg-blue-50 hover:bg-blue-100 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-2">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Upload className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Upload ID</h3>
              <p className="text-gray-600">
                Securely upload your driver's license or passport for identity verification.
              </p>
            </div>

            <div className="text-center p-8 rounded-2xl bg-green-50 hover:bg-green-100 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-2">
              <div className="bg-gradient-to-br from-green-600 to-green-700 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <CreditCard className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Payment Info</h3>
              <p className="text-gray-600">
                Upload your credit card image and enter the reservation amount.
              </p>
            </div>

            <div className="text-center p-8 rounded-2xl bg-purple-50 hover:bg-purple-100 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-2">
              <div className="bg-gradient-to-br from-purple-600 to-purple-700 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <FileCheck className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Digital Signature</h3>
              <p className="text-gray-600">
                Sign digitally to consent for Host LA to process your payment.
              </p>
            </div>

            <div className="text-center p-8 rounded-2xl bg-yellow-50 hover:bg-yellow-100 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-2">
              <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Shield className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Secure & Encrypted</h3>
              <p className="text-gray-600">
                All data is encrypted and stored securely with enterprise-grade security.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gray-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready for a Smooth Check-in Experience?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Complete your verification now and skip the lines at check-in
          </p>
          <Link
            to="/verify"
            className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-blue-900 px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            Start Verification
          </Link>
        </div>
      </div>
    </div>
  );
}