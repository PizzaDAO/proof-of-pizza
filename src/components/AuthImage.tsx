"use client";

import { useEffect, useState } from "react";

// Images are served only to admins via an Authorization header, which <img src>
// can't send, so fetch as a blob and display an object URL.
const cache = new Map<string, Promise<string>>();

function loadBlobUrl(src: string): Promise<string> {
  let p = cache.get(src);
  if (!p) {
    const token = localStorage.getItem("admin_token") || "";
    p = fetch(src, { headers: { Authorization: `Bearer ${token}` } })
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
    return <div className={`${className ?? ""} bg-gray-200`} aria-label={alt} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={blobUrl.url} alt={alt} className={className} />;
}
