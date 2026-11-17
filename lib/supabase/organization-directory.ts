import { getSupabaseBrowserClient } from "./client";

export type OrganizationAppointment = {
  id: string;
  name: string;
  title: string;
  organizational_group: string;
  region: string | null;
  legacy_name: string | null;
  description: string | null;
  focus: string[];
  portrait_path: string | null;
  sort_order: number;
  updated_at: string;
};

export type OrganizationDirectory = { activated: boolean; appointments: OrganizationAppointment[] };

/**
 * The database directory is an independent, opt-in authority. An empty or
 * unactivated directory must not silently erase the existing Team page.
 */
export function watchOrganizationDirectory(
  onUpdate: (data: OrganizationDirectory) => void,
  onError: (error: Error) => void,
): () => void {
  const client = getSupabaseBrowserClient();
  if (!client) {
    onError(new Error("Directory connection is not configured."));
    return () => {};
  }
  let disposed = false;
  let running = false;
  let queued = false;
  async function refresh() {
    if (disposed) return;
    if (running) { queued = true; return; }
    running = true;
    try {
      const { data, error } = await client!.rpc("read_organization_directory");
      if (error) throw error;
      if (!data || typeof data.activated !== "boolean" || !Array.isArray(data.appointments)) {
        throw new Error("The directory returned an invalid response.");
      }
      if (!disposed) onUpdate(data as OrganizationDirectory);
    } catch (error) {
      if (!disposed) onError(error instanceof Error ? error : new Error("Could not load the directory."));
    } finally {
      running = false;
      if (queued && !disposed) { queued = false; void refresh(); }
    }
  }
  const channel = client.channel("public-organization-directory")
    .on("postgres_changes", { event: "*", schema: "public", table: "organization_directory" }, () => { void refresh(); })
    .subscribe((status) => { if (status === "SUBSCRIBED") void refresh(); });
  void refresh();
  const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15000);
  const onVisibility = () => { if (document.visibilityState === "visible") void refresh(); };
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    disposed = true;
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibility);
    void client.removeChannel(channel);
  };
}
