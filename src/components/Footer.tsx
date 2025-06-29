import React from 'react';
import { Shield } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gray-800 text-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <Shield className="h-6 w-6 text-yellow-400" />
            <span className="text-lg font-semibold">Check-in Verification</span>
          </div>
          <div className="text-sm text-gray-300">
            © 2025 Host LA. All rights reserved. Secure • Compliant • Trusted
          </div>
        </div>
      </div>
    </footer>
  );
}