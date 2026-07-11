"use client";

import { useEffect, useRef } from "react";

type AdminLiveCounts = {
  approvalPendingCount: number;
  notificationUnreadCount: number;
};

type AdminSoundEffectsProps = {
  initialApprovalPendingCount: number;
  initialNotificationUnreadCount: number;
  onCountsChange?: (counts: AdminLiveCounts) => void;
};

const POLL_INTERVAL_MS = 20_000;
const APPROVAL_SOUND_PATH = "/sounds/admin-approval.mp3";
const NOTIFICATION_SOUND_PATH = "/sounds/admin-notification.mp3";

function isValidCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function playAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;

  audio.currentTime = 0;

  void audio.play().catch(() => {
    // Browser autoplay policy can block sound until the user interacts with the page.
    // The drawer badges still update through polling, so this can fail silently.
  });
}

export function AdminSoundEffects({
  initialApprovalPendingCount,
  initialNotificationUnreadCount,
  onCountsChange,
}: AdminSoundEffectsProps) {
  const countsRef = useRef<AdminLiveCounts>({
    approvalPendingCount: initialApprovalPendingCount,
    notificationUnreadCount: initialNotificationUnreadCount,
  });
  const hasUserInteractionRef = useRef(false);
  const approvalAudioRef = useRef<HTMLAudioElement | null>(null);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const onCountsChangeRef = useRef(onCountsChange);

  useEffect(() => {
    onCountsChangeRef.current = onCountsChange;
  }, [onCountsChange]);

  useEffect(() => {
    countsRef.current = {
      approvalPendingCount: initialApprovalPendingCount,
      notificationUnreadCount: initialNotificationUnreadCount,
    };
  }, [initialApprovalPendingCount, initialNotificationUnreadCount]);

  useEffect(() => {
    const approvalAudio = new Audio(APPROVAL_SOUND_PATH);
    approvalAudio.preload = "auto";
    approvalAudio.volume = 0.75;

    const notificationAudio = new Audio(NOTIFICATION_SOUND_PATH);
    notificationAudio.preload = "auto";
    notificationAudio.volume = 0.65;

    approvalAudioRef.current = approvalAudio;
    notificationAudioRef.current = notificationAudio;

    const activateAudio = () => {
      hasUserInteractionRef.current = true;
    };

    window.addEventListener("pointerdown", activateAudio, { once: true });
    window.addEventListener("keydown", activateAudio, { once: true });

    let isDisposed = false;
    let notificationTimer: ReturnType<typeof setTimeout> | null = null;

    const pollCounts = async () => {
      try {
        const response = await fetch("/api/admin/live-counts", {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (!response.ok) return;

        const payload = (await response.json()) as Partial<AdminLiveCounts>;

        if (
          !isValidCount(payload.approvalPendingCount) ||
          !isValidCount(payload.notificationUnreadCount)
        ) {
          return;
        }

        if (isDisposed) return;

        const nextCounts: AdminLiveCounts = {
          approvalPendingCount: payload.approvalPendingCount,
          notificationUnreadCount: payload.notificationUnreadCount,
        };
        const previousCounts = countsRef.current;
        const hasNewApproval =
          nextCounts.approvalPendingCount > previousCounts.approvalPendingCount;
        const hasNewNotification =
          nextCounts.notificationUnreadCount > previousCounts.notificationUnreadCount;

        countsRef.current = nextCounts;
        onCountsChangeRef.current?.(nextCounts);

        if (!hasUserInteractionRef.current) return;

        if (hasNewApproval) {
          playAudio(approvalAudioRef.current);
        }

        if (hasNewNotification) {
          notificationTimer = setTimeout(
            () => playAudio(notificationAudioRef.current),
            hasNewApproval ? 650 : 0,
          );
        }
      } catch {
        // Keep polling resilient; a temporary network or auth refresh issue should not break admin UI.
      }
    };

    const interval = window.setInterval(pollCounts, POLL_INTERVAL_MS);

    return () => {
      isDisposed = true;
      window.clearInterval(interval);
      if (notificationTimer) {
        window.clearTimeout(notificationTimer);
      }
      window.removeEventListener("pointerdown", activateAudio);
      window.removeEventListener("keydown", activateAudio);
      approvalAudioRef.current = null;
      notificationAudioRef.current = null;
    };
  }, []);

  return null;
}
