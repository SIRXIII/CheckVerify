import React from 'react';
import { Shield } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gray-800 text-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-3 mb-4 md:mb-0">
            <div className="relative">
              <Shield className="h-7 w-7 text-gray-400" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border border-gray-800"></div>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-bold tracking-wide">Check <span className="text-green-400">IN</span></span>
              <span className="text-sm font-medium text-gray-400 -mt-1">Verify</span>
            </div>
          </div>
          <div className="text-sm text-gray-300">
            © 2025 Host LA. All rights reserved. Secure • Compliant • Trusted
          </div>
        </div>
      </div>
    </footer>
  );
}