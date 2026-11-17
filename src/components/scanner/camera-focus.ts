type FocusCapabilities = MediaTrackCapabilities & { focusMode?: string[] };

export async function requestScannerAutoFocus(track: MediaStreamTrack): Promise<void> {
  if (track.readyState !== "live" || typeof track.getCapabilities !== "function") return;
  try {
    const capabilities = track.getCapabilities() as FocusCapabilities;
    if (!capabilities.focusMode?.includes("continuous")) return;
    await track.applyConstraints({
      advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
    });
  } catch {
    // Fixed-focus webcams and browsers may reject this optional enhancement.
    // Keep the stream and normal barcode decoding running.
  }
}
