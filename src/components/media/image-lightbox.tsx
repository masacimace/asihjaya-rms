"use client";

import { Maximize2, X } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type ImageLightboxProps = {
  src: string;
  alt: string;
  children: ReactNode;
  triggerClassName?: string;
  caption?: string;
};

export function ImageLightbox({
  src,
  alt,
  children,
  triggerClassName,
  caption,
}: ImageLightboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  function closeLightbox() {
    setIsOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        closeRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    const frameId = window.requestAnimationFrame(() => closeRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const dialog =
    isOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-3 backdrop-blur-[2px] sm:p-6"
            onClick={(event) => {
              if (event.currentTarget === event.target) {
                closeLightbox();
              }
            }}
          >
            <h2 id={titleId} className="sr-only">
              {caption ?? alt}
            </h2>

            <button
              ref={closeRef}
              type="button"
              onClick={() => closeLightbox()}
              className="absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-full bg-white/95 text-neutral-800 shadow-lg transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-6 sm:top-6"
              aria-label="Tutup foto"
            >
              <X className="size-5" />
            </button>

            <div
              className="flex max-h-[calc(100dvh-24px)] w-full max-w-6xl flex-col items-center justify-center gap-3 sm:max-h-[calc(100dvh-48px)]"
              onClick={(event) => event.stopPropagation()}
            >
              {/* Route media internal/public yang sama dipakai supaya policy akses foto tetap tidak berubah. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt}
                className="max-h-[calc(100dvh-80px)] max-w-full rounded-xl object-contain shadow-2xl sm:max-h-[calc(100dvh-110px)]"
              />

              {caption ? (
                <p className="max-w-3xl rounded-full bg-black/45 px-4 py-2 text-center text-xs font-medium text-white/90 backdrop-blur sm:text-sm">
                  {caption}
                </p>
              ) : null}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "group/lightbox relative block cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2",
          triggerClassName,
        )}
        aria-label={`Perbesar ${alt}`}
        aria-haspopup="dialog"
      >
        {children}
        <span className="pointer-events-none absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-lg bg-black/55 text-white opacity-0 shadow-sm backdrop-blur-sm transition group-hover/lightbox:opacity-100 group-focus-visible/lightbox:opacity-100">
          <Maximize2 className="size-3.5" />
        </span>
      </button>
      {dialog}
    </>
  );
}
