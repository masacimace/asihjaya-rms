export const POS_SHELL_STATUS_REFRESH_EVENT =
  "asihjaya:pos-shell-status-refresh";

export function requestPosShellStatusRefresh() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(POS_SHELL_STATUS_REFRESH_EVENT));
}
