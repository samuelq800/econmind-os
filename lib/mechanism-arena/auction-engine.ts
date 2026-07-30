export type AuctionRule = "first-price" | "second-price";
export type AuctionMode = "observe" | "play" | "compare";
export type ValueDistribution = "uniform" | "low-value" | "high-value";
export type BotStrategy = "equilibrium" | "truthful" | "conservative" | "aggressive" | "random";

export type AuctionParameters = {
  bidderCount: number;
  maxValue: number;
  distribution: ValueDistribution;
  allowOverbidding: boolean;
  sharedBotStrategy: BotStrategy;
};

export type AuctionParticipant = {
  id: number;
  label: string;
  value: number;
  bid: number;
  strategy: BotStrategy | "manual";
  payment: number;
  payoff: number;
  won: boolean;
};

export type AuctionResult = {
  rule: AuctionRule;
  participants: AuctionParticipant[];
  winnerId: number;
  payment: number;
  sellerRevenue: number;
  allocativeEfficiency: number;
  winnerSurplus: number;
  totalBidderSurplus: number;
  fairnessGini: number;
  participationRate: number;
  profitableExPostDeviations: number;
  highestValueId: number;
  highestBid: number;
  secondHighestBid: number;
  tieBreakUsed: boolean;
};

export type RepeatedAuctionSummary = {
  count: number;
  meanSellerRevenue: number;
  meanAllocativeEfficiency: number;
  meanWinnerSurplus: number;
  meanBidShading: number;
  inefficientAllocationFrequency: number;
  firstPriceRevenue: number;
  secondPriceRevenue: number;
  revenueSeries: Array<{ run: number; firstPrice: number; secondPrice: number }>;
};

export const defaultAuctionParameters: AuctionParameters = {
  bidderCount: 3,
  maxValue: 100,
  distribution: "uniform",
  allowOverbidding: false,
  sharedBotStrategy: "equilibrium",
};

function seededRandom(seed: number) {
  let state = (Math.floor(seed) >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const round = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export function valuesFromSeed(seed: number, parameters: AuctionParameters) {
  const random = seededRandom(seed);
  return Array.from({ length: parameters.bidderCount }, () => {
    const draw = random();
    const scaled = parameters.distribution === "low-value"
      ? draw * draw
      : parameters.distribution === "high-value"
        ? 1 - (1 - draw) * (1 - draw)
        : draw;
    return round(scaled * parameters.maxValue);
  });
}

export function bidForStrategy(value: number, bidderCount: number, strategy: BotStrategy, seed: number, allowOverbidding = false) {
  const random = seededRandom(seed)();
  const raw = strategy === "truthful"
    ? value
    : strategy === "equilibrium"
      ? value * (bidderCount - 1) / bidderCount
      : strategy === "conservative"
        ? value * 0.55
        : strategy === "aggressive"
          ? value * (allowOverbidding ? 1.08 : 0.9)
          : value * (0.2 + random * 0.72);
  return round(clamp(raw, 0, allowOverbidding ? value * 1.25 : value));
}

function gini(values: number[]) {
  const minimum = Math.min(...values);
  const shifted = values.map((value) => value - minimum);
  const total = shifted.reduce((sum, value) => sum + value, 0);
  if (!total) return 0;
  const sorted = [...shifted].sort((a, b) => a - b);
  return sorted.reduce((sum, value, index) => sum + (2 * (index + 1) - sorted.length - 1) * value, 0) / (sorted.length * total);
}

export function settleAuction({ rule, values, bids, strategies }: { rule: AuctionRule; values: number[]; bids: number[]; strategies?: Array<BotStrategy | "manual"> }): AuctionResult {
  if (values.length < 2 || values.length !== bids.length) throw new Error("An auction needs matching values and bids for at least two bidders.");
  const ranked = bids.map((bid, index) => ({ bid, id: index + 1 })).sort((a, b) => b.bid - a.bid || a.id - b.id);
  const winnerId = ranked[0].id;
  const winnerIndex = winnerId - 1;
  const highestBid = ranked[0].bid;
  const secondHighestBid = ranked[1]?.bid ?? 0;
  const payment = rule === "first-price" ? highestBid : secondHighestBid;
  const highestValue = Math.max(...values);
  const highestValueId = values.findIndex((value) => value === highestValue) + 1;
  const tieBreakUsed = ranked.length > 1 && ranked[0].bid === ranked[1].bid;
  const participants = values.map((value, index) => {
    const won = index === winnerIndex;
    return {
      id: index + 1,
      label: `Bidder ${index + 1}`,
      value,
      bid: bids[index],
      strategy: strategies?.[index] ?? "equilibrium",
      payment: won ? payment : 0,
      payoff: won ? round(value - payment) : 0,
      won,
    };
  });
  const profitableExPostDeviations = participants.filter((participant) => {
    const otherHighest = Math.max(...participants.filter((other) => other.id !== participant.id).map((other) => other.bid));
    const minimumWinningBid = round(otherHighest + 0.01);
    if (minimumWinningBid > participant.value) return false;
    const alternativePayoff = rule === "first-price" ? participant.value - minimumWinningBid : participant.value - otherHighest;
    return alternativePayoff > participant.payoff + 0.009;
  }).length;
  const payoffs = participants.map((participant) => participant.payoff);
  return {
    rule,
    participants,
    winnerId,
    payment,
    sellerRevenue: payment,
    allocativeEfficiency: winnerId === highestValueId ? 1 : 0,
    winnerSurplus: participants[winnerIndex].payoff,
    totalBidderSurplus: round(payoffs.reduce((sum, payoff) => sum + payoff, 0)),
    fairnessGini: round(gini(payoffs)),
    participationRate: 1,
    profitableExPostDeviations,
    highestValueId,
    highestBid,
    secondHighestBid,
    tieBreakUsed,
  };
}

export function prepareBotBids(seed: number, values: number[], parameters: AuctionParameters, strategies: Array<BotStrategy | "manual">) {
  return values.map((value, index) => strategies[index] === "manual"
    ? 0
    : bidForStrategy(value, values.length, strategies[index] as BotStrategy, seed + 1009 * (index + 1), parameters.allowOverbidding));
}

export function runRepeatedAuctionTrials({ seed, parameters, strategy, count }: { seed: number; parameters: AuctionParameters; strategy: BotStrategy; count: 10 | 50 | 100 }): RepeatedAuctionSummary {
  const revenueSeries: RepeatedAuctionSummary["revenueSeries"] = [];
  let totalFirstRevenue = 0;
  let totalSecondRevenue = 0;
  let totalEfficiency = 0;
  let totalWinnerSurplus = 0;
  let totalShading = 0;
  let inefficient = 0;
  for (let index = 0; index < count; index += 1) {
    const runSeed = seed + index * 7919;
    const values = valuesFromSeed(runSeed, parameters);
    const bids = values.map((value, bidder) => bidForStrategy(value, parameters.bidderCount, strategy, runSeed + 1009 * (bidder + 1), parameters.allowOverbidding));
    const first = settleAuction({ rule: "first-price", values, bids, strategies: values.map(() => strategy) });
    const second = settleAuction({ rule: "second-price", values, bids, strategies: values.map(() => strategy) });
    totalFirstRevenue += first.sellerRevenue;
    totalSecondRevenue += second.sellerRevenue;
    totalEfficiency += first.allocativeEfficiency;
    totalWinnerSurplus += first.winnerSurplus;
    totalShading += values.reduce((sum, value, bidder) => sum + (value - bids[bidder]), 0) / values.length;
    if (!first.allocativeEfficiency) inefficient += 1;
    revenueSeries.push({ run: index + 1, firstPrice: first.sellerRevenue, secondPrice: second.sellerRevenue });
  }
  return {
    count,
    meanSellerRevenue: round(totalFirstRevenue / count),
    meanAllocativeEfficiency: round(totalEfficiency / count),
    meanWinnerSurplus: round(totalWinnerSurplus / count),
    meanBidShading: round(totalShading / count),
    inefficientAllocationFrequency: round(inefficient / count),
    firstPriceRevenue: round(totalFirstRevenue / count),
    secondPriceRevenue: round(totalSecondRevenue / count),
    revenueSeries,
  };
}
