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
    (item: UploadItem) => {
      const formData = new FormData();
      formData.append("file", item.file);
      formData.append("type", type);

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
          try {
            const response = JSON.parse(xhr.responseText);
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      isUploading: false,
                      progress: 100,
                      publicUrl: response.publicUrl,
                      error: null,
                    }
                  : i
              )
            );
          } catch {
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      isUploading: false,
                      progress: 0,
                      error: "Invalid response from server",
                    }
                  : i
              )
            );
          }
        } else {
          let errorMsg = `Upload failed with status ${xhr.status}`;
          try {
            const error = JSON.parse(xhr.responseText);
            errorMsg = error.error || errorMsg;
          } catch {
            // keep default error message
          }
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, isUploading: false, progress: 0, error: errorMsg }
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

      xhr.open("POST", "/api/upload");
      xhr.send(formData);
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
