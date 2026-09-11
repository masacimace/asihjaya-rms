"use client";

import { Gem } from "lucide-react";
import { useState } from "react";

import { ImageLightbox } from "@/components/media/image-lightbox";
import type { PosAvailableItem } from "@/features/pos/contracts";
import {
  getPosItemBackground,
  getPosItemImageUrl,
} from "@/features/pos/catalog-state";
import { cn } from "@/lib/utils";

type PosItemImageProps = {
  item: PosAvailableItem;
  alt: string;
  className?: string;
  iconClassName?: string;
  showCatalogBadge?: boolean;
};

export function PosItemImage({
  item,
  alt,
  className,
  iconClassName,
  showCatalogBadge = false,
}: PosItemImageProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const imageUrl = getPosItemImageUrl(item);
  const shouldShowImage = Boolean(imageUrl) && !hasImageError;
  const usesCatalogPhoto = false;

  if (!shouldShowImage || !imageUrl) {
    return (
      <div
        className={cn(
          "relative overflow-hidden",
          getPosItemBackground(item),
          className,
        )}
      >
        <div className="grid size-full place-items-center">
          <Gem
            className={cn(
              "text-[var(--accent)] transition-transform group-hover:scale-105",
              iconClassName,
            )}
            strokeWidth={1.25}
          />
        </div>
      </div>
    );
  }

  return (
    <ImageLightbox
      src={imageUrl}
      alt={alt}
      caption={alt}
      triggerClassName={cn("overflow-hidden bg-neutral-100", className)}
    >
      {/* Foto produk disajikan melalui route media internal yang dilindungi sesi. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setHasImageError(true)}
        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
      />

      {showCatalogBadge && usesCatalogPhoto ? (
        <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-medium text-neutral-600 backdrop-blur">
          Foto katalog
        </span>
      ) : null}
    </ImageLightbox>
  );
}
