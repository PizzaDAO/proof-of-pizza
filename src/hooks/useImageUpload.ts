"use client";

import { useState, useCallback } from "react";

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  publicUrl: string | null;
}

interface UseImageUploadOptions {
  type: "pizza" | "receipt";
  onSuccess?: (url: string) => void;
  onError?: (error: string) => void;
}

export function useImageUpload({ type, onSuccess, onError }: UseImageUploadOptions) {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    publicUrl: null,
  });

  const upload = useCallback(
    async (file: File) => {
      setState({ isUploading: true, progress: 0, error: null, publicUrl: null });

      try {
        // Get presigned URL
        const presignResponse = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            type,
          }),
        });

        if (!presignResponse.ok) {
          throw new Error("Failed to get upload URL");
        }

        const { uploadUrl, publicUrl } = await presignResponse.json();

        // Upload to R2 with progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              setState((prev) => ({ ...prev, progress }));
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          });

          xhr.addEventListener("error", () => {
            reject(new Error("Upload failed"));
          });

          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.send(file);
        });

        setState({
          isUploading: false,
          progress: 100,
          error: null,
          publicUrl,
        });

        onSuccess?.(publicUrl);
        return publicUrl;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";
        setState({
          isUploading: false,
          progress: 0,
          error: errorMessage,
          publicUrl: null,
        });
        onError?.(errorMessage);
        throw error;
      }
    },
    [type, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setState({
      isUploading: false,
      progress: 0,
      error: null,
      publicUrl: null,
    });
  }, []);

  return {
    ...state,
    upload,
    reset,
  };
}
