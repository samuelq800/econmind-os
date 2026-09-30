/** Coalesce chat notifications and serialize reads so old responses cannot win. */
export function createChatSync<T>(options: {
  read: () => Promise<T>;
  onData: (data: T) => void;
  onError: (error: unknown) => void;
}) {
  let active = true;
  let queued = false;
  let running: Promise<void> | null = null;

  async function drain() {
    while (active && queued) {
      queued = false;
      try {
        const data = await options.read();
        if (active) options.onData(data);
      } catch (error) {
        if (active) options.onError(error);
      }
    }
  }

  return {
    refresh() {
      if (!active) return Promise.resolve();
      queued = true;
      if (!running) running = drain().finally(() => { running = null; });
      return running;
    },
    dispose() { active = false; queued = false; },
  };
}
