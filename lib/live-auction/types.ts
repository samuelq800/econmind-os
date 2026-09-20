export type LiveAuctionAccessType = "player" | "admin" | "observer";
export type AuctionType = "OPEN" | "SEALED";
export type OpenBiddingMode = "ONLINE" | "OFFLINE";
export type AuctionItemStatus = "DRAFT" | "LIVE" | "CLOSED" | "DEBRIEF";

export type LiveAuctionParticipant = {
  id: string;
  displayName: string;
  currentBalance: number;
  mine: boolean;
};

export type LiveAuctionBid = {
  id: string;
  participantId: string;
  participantName: string;
  amount: number;
  createdAt: string;
};

export type LiveAuctionPricePoint = {
  id: string;
  price: number;
  leaderId: string | null;
  leaderName: string | null;
  createdAt: string;
};

export type LiveAuctionDebriefRow = {
  participantId: string;
  displayName: string;
  privateValue: number;
  bid: number | null;
  difference: number | null;
};

export type LiveAuctionHostValue = { participantId: string; displayName: string; privateValue: number };
export type LiveAuctionSettlementPreview = { winnerId: string | null; winnerName: string | null; winningPrice: number | null; currentBalance: number | null; privateValue: number | null };

export type LiveAuctionItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  presetId: string | null;
  startingPrice: number;
  currentPrice: number;
  bidIncrement: number;
  auctionType: AuctionType;
  openBiddingMode: OpenBiddingMode | null;
  status: AuctionItemStatus;
  currentLeaderId: string | null;
  currentLeaderName: string | null;
  winnerId: string | null;
  winnerName: string | null;
  winningPrice: number | null;
  myPrivateValue: number | null;
  mySealedBid: number | null;
  submittedCount: number;
  bidHistory: LiveAuctionBid[];
  priceHistory: LiveAuctionPricePoint[];
  debriefRows: LiveAuctionDebriefRow[];
  hostValues: LiveAuctionHostValue[];
};

export type LiveAuctionRoomView = {
  room: {
    id: string;
    name: string;
    participantCapacity: number;
    startingBalance: number;
    createdAt: string;
  };
  access: { type: LiveAuctionAccessType; displayName: string; participantId: string | null };
  participants: LiveAuctionParticipant[];
  items: LiveAuctionItem[];
};

export type AuctionValueAssignment =
  | { mode: "same"; value: number }
  | { mode: "random"; min: number; max: number }
  | { mode: "manual"; values: Record<string, number> };
