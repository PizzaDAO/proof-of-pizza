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
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", type);

        // Upload through our API with progress tracking
        const publicUrl = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              setState((prev) => ({ ...prev, progress }));
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText);
                resolve(response.publicUrl);
              } catch {
                reject(new Error("Invalid response from server"));
              }
            } else {
              try {
                const error = JSON.parse(xhr.responseText);
                reject(new Error(error.error || `Upload failed with status ${xhr.status}`));
              } catch {
                reject(new Error(`Upload failed with status ${xhr.status}`));
              }
            }
          });

          xhr.addEventListener("error", () => {
            reject(new Error("Upload failed - network error"));
          });

          xhr.open("POST", "/api/upload");
          xhr.send(formData);
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
