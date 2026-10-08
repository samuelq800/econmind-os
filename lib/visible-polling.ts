/** Keep fallback reads at their existing cadence while a page is visible.
 * Initial loads, realtime notifications and writes remain owned by the caller.
 */
export function startVisiblePolling(refresh: () => void, intervalMs: number) {
  let active = true;
  const refreshVisible = () => {
    if (active && document.visibilityState === "visible") refresh();
  };
  const interval = window.setInterval(refreshVisible, intervalMs);
  document.addEventListener("visibilitychange", refreshVisible);
  window.addEventListener("online", refreshVisible);
  return () => {
    active = false;
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", refreshVisible);
    window.removeEventListener("online", refreshVisible);
  };
}
