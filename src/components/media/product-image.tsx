import { ImageIcon } from "lucide-react";

import { ImageLightbox } from "@/components/media/image-lightbox";
import { cn } from "@/lib/utils";

export function ProductImage({
  src,
  alt,
  className,
  fallbackClassName,
  badge,
}: {
  src: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  badge?: string;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          "relative overflow-hidden bg-neutral-100",
          className,
        )}
      >
        <div
          className={cn(
            "grid size-full place-items-center text-neutral-400",
            fallbackClassName,
          )}
        >
          <ImageIcon className="size-8" />
        </div>
      </div>
    );
  }

  return (
    <ImageLightbox
      src={src}
      alt={alt}
      caption={alt}
      triggerClassName={cn(
        "overflow-hidden bg-neutral-100",
        className,
      )}
    >
      {/* Foto disajikan melalui route media internal yang dilindungi sesi. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="size-full object-cover" />

      {badge ? (
        <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-neutral-700 shadow-sm backdrop-blur">
          {badge}
        </span>
      ) : null}
    </ImageLightbox>
  );
}
