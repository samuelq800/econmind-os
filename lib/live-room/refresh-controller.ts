export type RoomRealtimeStatus = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";

type Options<View, Channel> = {
  fetch: () => Promise<View>;
  onView: (view: View) => void;
  onError: (error: unknown) => void;
  terminal: (view: View) => boolean;
  subscribe: (change: () => void, status: (status: RoomRealtimeStatus) => void, disposed: () => boolean) => Promise<Channel | null>;
  unsubscribe: (channel: Channel) => Promise<unknown>;
  visible: () => boolean;
  listenVisibility: (callback: () => void) => () => void;
};

/** One coordinator per room identity. Mutations remain on their original RPC paths. */
export function createRoomRefreshController<View, Channel>(options: Options<View, Channel>) {
  let disposed = false;
  let terminal = false;
  let healthy = false;
  let failures = 0;
  let queued = false;
  let followingUp = false;
  let flight: Promise<void> | null = null;
  let channel: Channel | null = null;
  let subscribing = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let removeVisibility = () => {};

  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }
  function schedule() {
    clearTimer();
    if (disposed || flight || terminal || !options.visible()) return;
    const delay = failures ? [5000, 10000, 30000, 60000][Math.min(failures - 1, 3)] : healthy ? 15000 : 5000;
    timer = setTimeout(() => { timer = null; void refresh(); }, delay);
  }
  function removeChannel(next: Channel) {
    void options.unsubscribe(next).catch(() => undefined);
  }
  function connect() {
    if (disposed || subscribing || channel !== null) return;
    subscribing = true;
    void options.subscribe(
      () => { if (!disposed && options.visible()) void refresh(); },
      (status) => {
        if (disposed) return;
        healthy = status === "SUBSCRIBED";
        schedule();
      },
      () => disposed,
    ).then((next) => {
      subscribing = false;
      if (disposed) { if (next !== null) removeChannel(next); return; }
      channel = next;
      if (next === null) healthy = false;
      schedule();
    }).catch(() => {
      subscribing = false;
      if (!disposed) { healthy = false; schedule(); }
    });
  }
  async function fetchOnce() {
    try {
      const view = await options.fetch();
      if (disposed) return;
      failures = 0;
      terminal = options.terminal(view);
      options.onView(view);
      connect();
    } catch (error) {
      if (disposed) return;
      failures += 1;
      options.onError(error);
    }
  }
  function refresh(): Promise<void> {
    if (disposed) return Promise.resolve();
    if (flight) {
      // Coalesce a burst into at most one trailing fetch, never overlapping RPCs.
      if (!followingUp) queued = true;
      return flight;
    }
    clearTimer();
    flight = Promise.resolve().then(async () => {
      if (disposed) return;
      await fetchOnce();
      if (queued && !disposed) {
        queued = false;
        followingUp = true;
        await fetchOnce();
      }
    }).finally(() => {
      flight = null;
      queued = false;
      followingUp = false;
      schedule();
    });
    return flight;
  }
  return {
    refresh,
    start() {
      removeVisibility = options.listenVisibility(() => {
        clearTimer();
        if (!disposed && options.visible()) void refresh();
      });
      void refresh();
    },
    dispose() {
      disposed = true;
      clearTimer();
      removeVisibility();
      if (channel !== null) { removeChannel(channel); channel = null; }
    },
  };
}
