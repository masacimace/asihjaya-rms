"use client";

import { useCallback, useEffect, useRef } from "react";

const POS_CHECKOUT_SUCCESS_SOUND_PATH = "/sounds/admin-notification.mp3";

export function usePosCheckoutSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedSaleIdRef = useRef<string | null>(null);

  useEffect(() => {
    const audio = new Audio(POS_CHECKOUT_SUCCESS_SOUND_PATH);
    audio.preload = "auto";
    audio.volume = 0.72;
    audioRef.current = audio;

    return () => {
      audioRef.current = null;
    };
  }, []);

  return useCallback((saleId: string) => {
    if (!saleId || lastPlayedSaleIdRef.current === saleId) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    lastPlayedSaleIdRef.current = saleId;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Browser dapat memblokir autoplay jika belum ada interaksi user.
      // Checkout tetap sukses; sound hanya enhancement UX.
    });
  }, []);
}
