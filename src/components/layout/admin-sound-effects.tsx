"use client";

import { useEffect, useRef } from "react";

type AdminLiveCounts = {
  notificationUnreadCount: number;
};

type AdminSoundEffectsProps = {
  initialNotificationUnreadCount: number;
  onCountsChange?: (counts: AdminLiveCounts) => void;
};

const POLL_INTERVAL_MS = 20_000;
const NOTIFICATION_SOUND_PATH = "/sounds/admin-notification.mp3";

function isValidCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function playAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.currentTime = 0;
  void audio.play().catch(() => {
    // Autoplay dapat diblokir sampai user berinteraksi; badge tetap ter-update.
  });
}

export function AdminSoundEffects({
  initialNotificationUnreadCount,
  onCountsChange,
}: AdminSoundEffectsProps) {
  const countRef = useRef(initialNotificationUnreadCount);
  const hasUserInteractionRef = useRef(false);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const onCountsChangeRef = useRef(onCountsChange);

  useEffect(() => {
    onCountsChangeRef.current = onCountsChange;
  }, [onCountsChange]);

  useEffect(() => {
    countRef.current = initialNotificationUnreadCount;
  }, [initialNotificationUnreadCount]);

  useEffect(() => {
    const notificationAudio = new Audio(NOTIFICATION_SOUND_PATH);
    notificationAudio.preload = "auto";
    notificationAudio.volume = 0.65;
    notificationAudioRef.current = notificationAudio;

    const activateAudio = () => {
      hasUserInteractionRef.current = true;
    };
    window.addEventListener("pointerdown", activateAudio, { once: true });
    window.addEventListener("keydown", activateAudio, { once: true });

    let isDisposed = false;

    const pollCounts = async () => {
      try {
        const response = await fetch("/api/admin/live-counts", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as Partial<AdminLiveCounts>;
        if (!isValidCount(payload.notificationUnreadCount) || isDisposed) return;

        const previous = countRef.current;
        const next = payload.notificationUnreadCount;
        countRef.current = next;
        onCountsChangeRef.current?.({ notificationUnreadCount: next });

        if (hasUserInteractionRef.current && next > previous) {
          playAudio(notificationAudioRef.current);
        }
      } catch {
        // Polling tetap resilien jika jaringan/auth refresh sementara bermasalah.
      }
    };

    const interval = window.setInterval(pollCounts, POLL_INTERVAL_MS);
    return () => {
      isDisposed = true;
      window.clearInterval(interval);
      window.removeEventListener("pointerdown", activateAudio);
      window.removeEventListener("keydown", activateAudio);
      notificationAudioRef.current = null;
    };
  }, []);

  return null;
}
