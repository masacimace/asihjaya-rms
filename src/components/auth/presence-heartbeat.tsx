"use client";

import { useEffect } from "react";

const HEARTBEAT_INTERVAL_MS = 60_000;

export function PresenceHeartbeat() {
  useEffect(() => {
    let disposed = false;
    let requestInFlight = false;

    async function sendHeartbeat() {
      if (
        disposed ||
        requestInFlight ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      requestInFlight = true;

      try {
        const response = await fetch("/api/presence/heartbeat", {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          keepalive: true,
        });

        if (response.ok) {
          window.dispatchEvent(new Event("asihjaya:presence-heartbeat"));
        }
      } catch {
        // Presence is best-effort and must never interrupt POS/Admin workflows.
      } finally {
        requestInFlight = false;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void sendHeartbeat();
    }

    function handleFocus() {
      void sendHeartbeat();
    }

    void sendHeartbeat();

    const intervalId = window.setInterval(
      () => void sendHeartbeat(),
      HEARTBEAT_INTERVAL_MS,
    );

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return null;
}
