export const LIVE_WORLD_COUNTRY_IDS = [
  "aurora",
  "borealis",
  "cyrenia",
  "demeria",
] as const;

export const LIVE_WORLD_ROLE_IDS = [
  "central_bank_governor",
  "finance_domestic_minister",
  "trade_industry_investment_minister",
] as const;

export const LIVE_WORLD_DIMENSIONS = [
  "activity",
  "livelihoods",
  "prices",
  "fiscal",
  "financial",
  "stability",
] as const;

export type LiveWorldCountryId = (typeof LIVE_WORLD_COUNTRY_IDS)[number];
export type LiveWorldRoleId = (typeof LIVE_WORLD_ROLE_IDS)[number];
export type LiveWorldDimension = (typeof LIVE_WORLD_DIMENSIONS)[number];
export type LiveWorldRoomStatus = "waiting" | "live" | "paused" | "ended";
export type LiveWorldAccessType = "player" | "admin" | "observer";
export type LiveWorldAgreementDepth = "limited" | "standard" | "deep";
export type LiveWorldAgreementStatus = "proposed" | "active" | "rejected" | "withdrawn";

export type LiveWorldDimensions = Record<LiveWorldDimension, number>;
export type LiveWorldPolicyValues = Record<string, number>;

export type LiveWorldStructure = {
  technology: number;
  manufacturing: number;
  resources: number;
  domesticMarket: number;
  financialDepth: number;
  exportDependence: number;
  energyDependence: number;
  capitalDependence: number;
};

export type LiveWorldCountry = {
  id: LiveWorldCountryId;
  name: string;
  shortDescription: string;
  structure: LiveWorldStructure;
  baseline: LiveWorldDimensions;
};

export type LiveWorldPolicyControl = {
  key: string;
  role: LiveWorldRoleId;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit?: string;
};

export type LiveWorldCountryPolicyState = Partial<
  Record<LiveWorldRoleId, LiveWorldPolicyValues>
>;

export type LiveWorldAgreement = {
  id: string;
  proposerCountry: LiveWorldCountryId;
  receiverCountry: LiveWorldCountryId;
  depth: LiveWorldAgreementDepth;
  status: LiveWorldAgreementStatus;
  createdAt: string;
  decidedAt?: string | null;
};

export type LiveWorldCrisis = {
  id: string;
  label: string;
  description: string;
  affectedCountries: LiveWorldCountryId[];
  effects: Partial<LiveWorldDimensions>;
  active: boolean;
};

export type LiveWorldRoomState = {
  publishedPolicies: Partial<Record<LiveWorldCountryId, LiveWorldCountryPolicyState>>;
  agreements: LiveWorldAgreement[];
  crises: LiveWorldCrisis[];
};

export type LiveWorldSeat = {
  countryId: LiveWorldCountryId;
  role: LiveWorldRoleId;
  displayName: string | null;
  mine: boolean;
};

export type LiveWorldRoomView = {
  room: {
    id: string;
    name: string;
    status: LiveWorldRoomStatus;
    durationSeconds: number;
    remainingSeconds: number;
    startedAt: string | null;
    endedAt: string | null;
    createdAt: string;
  };
  access: {
    type: LiveWorldAccessType;
    displayName: string;
    countryId: LiveWorldCountryId | null;
    role: LiveWorldRoleId | null;
  };
  seats: LiveWorldSeat[];
  state: LiveWorldRoomState;
  drafts: Partial<Record<LiveWorldCountryId, LiveWorldCountryPolicyState>>;
  events: Array<{
    id: string;
    type: string;
    message: string;
    countryId: LiveWorldCountryId | null;
    createdAt: string;
  }>;
};
