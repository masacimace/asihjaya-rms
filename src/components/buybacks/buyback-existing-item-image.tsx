"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";

import { ImageLightbox } from "@/components/media/image-lightbox";

function getImageUrl(imageKey: string | null) {
  if (!imageKey) return null;
  const segments = imageKey.replaceAll("\\", "/").replace(/^\/+/, "").split("/");
  if (segments.length !== 5 || segments[0] !== "organizations") return null;
  return `/media/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

export function BuybackExistingItemImage({
  imageKey,
  alt,
}: {
  imageKey: string | null;
  alt: string;
}) {
  const [hasError, setHasError] = useState(false);
  const imageUrl = getImageUrl(imageKey);

  if (!imageUrl || hasError) {
    return (
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--border)] bg-neutral-100 text-neutral-400 sm:size-[72px]">
        <ImageIcon className="size-6" />
      </div>
    );
  }

  return (
    <ImageLightbox
      src={imageUrl}
      alt={alt}
      caption={alt}
      triggerClassName="size-16 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-neutral-100 sm:size-[72px]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setHasError(true)}
        className="size-full object-cover"
      />
    </ImageLightbox>
  );
}
