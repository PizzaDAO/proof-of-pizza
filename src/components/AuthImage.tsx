"use client";

import { useEffect, useState } from "react";

// Images are served only to admins (session cookie). Fetch as a blob so a 401
// can be handled and the object URL dropped on logout.
const cache = new Map<string, Promise<string>>();

export function clearAuthImageCache() {
  for (const p of cache.values()) {
    p.then((u) => URL.revokeObjectURL(u)).catch(() => {});
  }
  cache.clear();
}

function loadBlobUrl(src: string): Promise<string> {
  let p = cache.get(src);
  if (!p) {
    p = fetch(src, { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) throw new Error(`Image request failed (${res.status})`);
        return res.blob();
      })
      .then((blob) => URL.createObjectURL(blob));
    p.catch(() => cache.delete(src));
    cache.set(src, p);
  }
  return p;
}

export function AuthImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [blobUrl, setBlobUrl] = useState<{ src: string; url: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadBlobUrl(src)
      .then((u) => {
        if (!cancelled) setBlobUrl({ src, url: u });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!blobUrl || blobUrl.src !== src) {
    return (
      <div
        className={`${className ?? ""} bg-gray-200 min-w-[200px] min-h-[200px]`}
        aria-label={alt}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={blobUrl.url} alt={alt} className={className} />;
}
