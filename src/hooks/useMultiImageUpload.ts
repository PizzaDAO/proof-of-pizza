"use client";

import { useState, useCallback, useRef } from "react";

export interface UploadItem {
  id: string;
  file: File;
  preview: string; // data URL for local preview
  publicUrl: string | null;
  isUploading: boolean;
  progress: number;
  error: string | null;
}

interface UseMultiImageUploadOptions {
  type: "pizza" | "receipt";
}

export function useMultiImageUpload({ type }: UseMultiImageUploadOptions) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const nextId = useRef(0);

  const uploadFile = useCallback(
    async (item: UploadItem) => {
      try {
        // Step 1: Get a presigned URL from our API (small JSON request, no file data)
        const presignRes = await fetch("/api/upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: item.file.name,
            fileType: item.file.type,
            fileSize: item.file.size,
            type,
          }),
        });

        if (!presignRes.ok) {
          const err = await presignRes.json().catch(() => ({}));
          throw new Error(
            err.error || `Failed to get upload URL (${presignRes.status})`
          );
        }

        const { presignedUrl, publicUrl } = await presignRes.json();

        // Step 2: Upload directly to R2 using the presigned URL (bypasses Vercel 4.5MB limit)
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setItems((prev) =>
              prev.map((i) => (i.id === item.id ? { ...i, progress } : i))
            );
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      isUploading: false,
                      progress: 100,
                      publicUrl,
                      error: null,
                    }
                  : i
              )
            );
          } else {
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      isUploading: false,
                      progress: 0,
                      error: `Upload failed with status ${xhr.status}`,
                    }
                  : i
              )
            );
          }
        });

        xhr.addEventListener("error", () => {
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    isUploading: false,
                    progress: 0,
                    error: "Upload failed - network error",
                  }
                : i
            )
          );
        });

        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader("Content-Type", item.file.type);
        xhr.send(item.file);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Upload failed";
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, isUploading: false, progress: 0, error: errorMsg }
              : i
          )
        );
      }
    },
    [type]
  );

  const addFiles = useCallback(
    (files: File[]) => {
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

      const newItems: UploadItem[] = imageFiles.map((file) => {
        const id = `upload-${nextId.current++}`;
        return {
          id,
          file,
          preview: URL.createObjectURL(file),
          publicUrl: null,
          isUploading: true,
          progress: 0,
          error: null,
        };
      });

      setItems((prev) => [...prev, ...newItems]);

      // Start uploading each file independently
      newItems.forEach((item) => uploadFile(item));
    },
    [uploadFile]
  );

  const removeFile = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.preview) {
        URL.revokeObjectURL(item.preview);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const reset = useCallback(() => {
    setItems((prev) => {
      prev.forEach((item) => {
        if (item.preview) URL.revokeObjectURL(item.preview);
      });
      return [];
    });
  }, []);

  const completedUrls = items
    .filter((i) => i.publicUrl !== null)
    .map((i) => i.publicUrl as string);

  const isAnyUploading = items.some((i) => i.isUploading);

  return {
    items,
    addFiles,
    removeFile,
    isAnyUploading,
    completedUrls,
    reset,
  };
}
