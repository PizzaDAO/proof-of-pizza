"use client";

import { useCallback, useState } from "react";
import { useImageUpload } from "@/hooks/useImageUpload";

interface ImageUploadProps {
  type: "pizza" | "receipt";
  label: string;
  onUploadComplete: (url: string) => void;
  onClear?: () => void;
  className?: string;
}

export function ImageUpload({
  type,
  label,
  onUploadComplete,
  onClear,
  className = "",
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const { isUploading, progress, error, publicUrl, upload, reset } = useImageUpload({
    type,
    onSuccess: onUploadComplete,
  });

  const handleClear = useCallback(() => {
    setPreview(null);
    reset();
    onClear?.();
  }, [reset, onClear]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Upload
      await upload(file);
    },
    [upload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-lg p-6 transition-colors
          ${isDragOver ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"}
          ${preview || publicUrl ? "bg-gray-50" : "bg-white"}
        `}
      >
        {preview || publicUrl ? (
          <div className="relative">
            <img
              src={preview || publicUrl || ""}
              alt={`${type} preview`}
              className="w-full h-48 object-cover rounded-lg"
            />
            {isUploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                <div className="text-white text-center">
                  <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span>{progress}%</span>
                </div>
              </div>
            )}
            {publicUrl && !isUploading && (
              <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs">
                Uploaded
              </div>
            )}
            {!isUploading && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute top-2 left-2 w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="mt-4">
              <label className="cursor-pointer">
                <span className="text-red-600 hover:text-red-500 font-medium">
                  Upload a file
                </span>
                <input
                  type="file"
                  className="sr-only"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleInputChange}
                  disabled={isUploading}
                />
              </label>
              <span className="text-gray-500"> or drag and drop</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">PNG, JPG, WebP up to 10MB</p>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
