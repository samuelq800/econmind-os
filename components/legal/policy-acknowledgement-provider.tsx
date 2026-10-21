"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PolicyConfirmationCoordinator } from "@/lib/legal/acknowledgement";
import { policyAcknowledgementApi } from "@/lib/supabase/policy-acknowledgement";
const Context = createContext<PolicyConfirmationCoordinator | null>(null);
export function PolicyAcknowledgementProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const userId = user && !user.is_anonymous ? user.id : null;
  const [coordinator] = useState(
    () => new PolicyConfirmationCoordinator(policyAcknowledgementApi),
  );
  useEffect(() => {
    coordinator.setUser(userId);
  }, [coordinator, userId]);
  useEffect(() => {
    const updated = (event: StorageEvent) => {
      if (userId && event.key === `econmind.policy-confirmation.${userId}`)
        coordinator.retry();
    };
    window.addEventListener("storage", updated);
    return () => window.removeEventListener("storage", updated);
  }, [coordinator, userId]);
  return <Context.Provider value={coordinator}>{children}</Context.Provider>;
}
export function usePolicyAcknowledgement() {
  const coordinator = useContext(Context);
  if (!coordinator) throw new Error("Policy acknowledgement provider required");
  const state = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getServerSnapshot,
  );
  return { state, coordinator };
}
