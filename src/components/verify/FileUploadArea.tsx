import React from 'react';
import { CheckCircle } from 'lucide-react';

export interface UploadedFile {
  name: string;
  size: number;
  type: string;
  file: File;
}

interface FileUploadAreaProps {
  onFileSelect: (file: File) => void;
  accept: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  uploadedFile: UploadedFile | null;
}

export function FileUploadArea({
  onFileSelect,
  accept,
  title,
  description,
  icon: Icon,
  uploadedFile,
}: FileUploadAreaProps) {
  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-hostla-primary transition-colors">
      <div className="text-center">
        <Icon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-4">{description}</p>

        {uploadedFile ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-green-800">
                {uploadedFile.name}
              </span>
            </div>
            <p className="text-xs text-green-600 mt-1">
              {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        ) : (
          <div>
            <label className="cursor-pointer">
              <span className="bg-hostla-primary hover:bg-hostla-secondary text-white px-4 py-2 rounded-lg font-medium transition-colors inline-block">
                Choose File
              </span>
              <input
                type="file"
                accept={accept}
                onChange={(e) =>
                  e.target.files?.[0] && onFileSelect(e.target.files[0])
                }
                className="hidden"
              />
            </label>
            <small className="block mt-2 text-gray-500 text-xs">
              JPG/PNG, max 5 MB
            </small>
          </div>
        )}
      </div>
    </div>
  );
}
