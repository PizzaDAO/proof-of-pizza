"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMultiImageUpload, UploadItem } from "@/hooks/useMultiImageUpload";

const MAX_PHOTOS = 10;

interface MultiImageUploadProps {
  type: "pizza" | "receipt";
  label: string;
  onUrlsChange: (urls: string[]) => void;
  onClear?: () => void;
  className?: string;
}

export function MultiImageUpload({
  type,
  label,
  onUrlsChange,
  onClear,
  className = "",
}: MultiImageUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const { items, addFiles, removeFile, isAnyUploading, completedUrls, reset } =
    useMultiImageUpload({ type });

  // Keep a stable ref to onUrlsChange to avoid re-triggering the effect
  const onUrlsChangeRef = useRef(onUrlsChange);
  onUrlsChangeRef.current = onUrlsChange;

  // Notify parent whenever completedUrls changes
  const prevUrlsRef = useRef<string>("");
  useEffect(() => {
    const serialized = completedUrls.join("|");
    if (serialized !== prevUrlsRef.current) {
      prevUrlsRef.current = serialized;
      onUrlsChangeRef.current(completedUrls);
    }
  }, [completedUrls]);

  const handleAddFiles = useCallback(
    (files: File[]) => {
      const remaining = MAX_PHOTOS - items.length;
      if (remaining <= 0) return;
      addFiles(files.slice(0, remaining));
    },
    [addFiles, items.length]
  );

  const handleRemoveFile = useCallback(
    (id: string) => {
      removeFile(id);
    },
    [removeFile]
  );

  const handleClear = useCallback(() => {
    reset();
    onUrlsChangeRef.current([]);
    onClear?.();
  }, [reset, onClear]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      handleAddFiles(files);
    },
    [handleAddFiles]
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
      const files = Array.from(e.target.files || []);
      handleAddFiles(files);
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [handleAddFiles]
  );

  const canAddMore = items.length < MAX_PHOTOS;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        {items.length > 0 && (
          <span className="text-xs text-gray-500">
            {items.length} of {MAX_PHOTOS} photos
          </span>
        )}
      </div>

      {/* Drop zone - visible until max reached */}
      {canAddMore && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            relative border-2 border-dashed rounded-lg p-6 transition-colors
            ${isDragOver ? "border-orange-500 bg-orange-50" : "border-gray-300 hover:border-gray-400"}
            bg-white
          `}
        >
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
                <span className="text-orange-600 hover:text-orange-500 font-medium">
                  Upload files
                </span>
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleInputChange}
                  disabled={isAnyUploading}
                />
              </label>
              <span className="text-gray-500"> or drag and drop</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              PNG, JPG, WebP up to 10MB each. Max {MAX_PHOTOS} photos.
            </p>
          </div>
        </div>
      )}

      {/* Thumbnail grid */}
      {items.length > 0 && (
        <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {items.map((item) => (
            <ThumbnailItem
              key={item.id}
              item={item}
              onRemove={() => handleRemoveFile(item.id)}
            />
          ))}
        </div>
      )}

      {/* Clear all button */}
      {items.length > 1 && !isAnyUploading && (
        <button
          type="button"
          onClick={handleClear}
          className="mt-2 text-xs text-gray-500 hover:text-red-600 transition-colors"
        >
          Remove all
        </button>
      )}
    </div>
  );
}

function ThumbnailItem({
  item,
  onRemove,
}: {
  item: UploadItem;
  onRemove: () => void;
}) {
  return (
    <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group">
      <img
        src={item.preview}
        alt="Upload preview"
        className="w-full h-full object-cover"
      />

      {/* Upload progress overlay */}
      {item.isUploading && (
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mb-1" />
          <span className="text-white text-xs">{item.progress}%</span>
        </div>
      )}

      {/* Success indicator */}
      {item.publicUrl && !item.isUploading && (
        <div className="absolute top-1 right-1 bg-green-500 text-white w-5 h-5 rounded-full flex items-center justify-center">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Error indicator */}
      {item.error && (
        <div className="absolute inset-0 bg-red-500/70 flex items-center justify-center p-1">
          <span className="text-white text-xs text-center leading-tight">
            {item.error.length > 30 ? "Upload failed" : item.error}
          </span>
        </div>
      )}

      {/* Remove button */}
      {!item.isUploading && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 left-1 w-5 h-5 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
