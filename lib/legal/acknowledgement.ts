import {
  allPoliciesChecked,
  POLICY_ACKNOWLEDGEMENT_RELEASE,
  type PolicyChecks,
} from "./policy-release.ts";
export {
  ACKNOWLEDGEMENT_DOCUMENTS,
  POLICY_ACKNOWLEDGEMENT_RELEASE,
  emptyPolicyChecks,
  allPoliciesChecked,
  type PolicyChecks,
} from "./policy-release.ts";
export type PolicyStatus = {
  user_id: string;
  release_id: string;
  complete: boolean;
};
export type ConfirmationState = {
  userId: string | null;
  status: "idle" | "loading" | "required" | "accepted" | "error";
  saving: boolean;
  error: string;
};
const initialState: ConfirmationState = {
  userId: null,
  status: "idle",
  saving: false,
  error: "",
};
/** One store per app shell, not per page or refreshed Auth user object. */
export class PolicyConfirmationCoordinator {
  private state = initialState;
  private generation = 0;
  private listeners = new Set<() => void>();
  constructor(
    private api: {
      load: (userId: string) => Promise<PolicyStatus>;
      save: (userId: string, checks: PolicyChecks) => Promise<PolicyStatus>;
    },
  ) {}
  getSnapshot = () => this.state;
  getServerSnapshot = () => initialState;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<ConfirmationState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  setUser(userId: string | null) {
    if (this.state.userId === userId) return;
    this.generation++;
    this.update({
      userId,
      status: userId ? "loading" : "idle",
      saving: false,
      error: "",
    });
    if (userId) void this.load(userId, this.generation);
  }
  private validate(result: PolicyStatus, userId: string) {
    if (
      result.user_id !== userId ||
      result.release_id !== POLICY_ACKNOWLEDGEMENT_RELEASE ||
      typeof result.complete !== "boolean"
    )
      throw new Error("Unverified policy version");
  }
  private async load(userId: string, generation: number) {
    try {
      const result = await this.api.load(userId);
      if (generation !== this.generation) return;
      this.validate(result, userId);
      this.update({
        status: result.complete ? "accepted" : "required",
        error: "",
      });
    } catch {
      if (generation === this.generation)
        this.update({
          status: "error",
          error:
            "Could not verify your policy confirmation. Please retry. No confirmation has been assumed.",
        });
    }
  }
  retry() {
    if (
      !this.state.userId ||
      this.state.status === "loading" ||
      this.state.saving
    )
      return;
    this.update({ status: "loading", error: "" });
    void this.load(this.state.userId, this.generation);
  }
  async accept(checks: PolicyChecks) {
    const { userId, status, saving } = this.state;
    if (
      !userId ||
      status !== "required" ||
      saving ||
      !allPoliciesChecked(checks)
    )
      return false;
    const generation = this.generation;
    this.update({ saving: true, error: "" });
    try {
      const result = await this.api.save(userId, { ...checks });
      if (generation !== this.generation) return false;
      this.validate(result, userId);
      if (!result.complete) throw new Error("Incomplete acknowledgement");
      this.update({ status: "accepted", saving: false });
      return true;
    } catch {
      if (generation === this.generation)
        this.update({
          saving: false,
          error:
            "Could not save your confirmation. Your selections are retained; please try again.",
        });
      return false;
    }
  }
}
