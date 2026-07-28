export type Action = "C" | "D";
export type Strategy = "always-cooperate" | "always-defect" | "tit-for-tat" | "grim-trigger" | "win-stay-lose-shift";

export type PrisonersDilemmaParameters = {
  ccA: number; ccB: number; cdA: number; cdB: number;
  dcA: number; dcB: number; ddA: number; ddB: number;
};

export const DEFAULT_PRISONERS_DILEMMA: PrisonersDilemmaParameters = {
  ccA: 3, ccB: 3, cdA: 0, cdB: 5, dcA: 5, dcB: 0, ddA: 1, ddB: 1,
};

export type PayoffCell = {
  id: "CC" | "CD" | "DC" | "DD";
  aAction: Action; bAction: Action; a: number; b: number;
  aBestResponse: boolean; bBestResponse: boolean; nash: boolean; pareto: boolean;
};

const actions: Action[] = ["C", "D"];
const cellId = (a: Action, b: Action) => (a + b) as PayoffCell["id"];

function payoff(p: PrisonersDilemmaParameters, a: Action, b: Action) {
  const key = cellId(a, b);
  if (key === "CC") return { a: p.ccA, b: p.ccB };
  if (key === "CD") return { a: p.cdA, b: p.cdB };
  if (key === "DC") return { a: p.dcA, b: p.dcB };
  return { a: p.ddA, b: p.ddB };
}

export function analyzePrisonersDilemma(p: PrisonersDilemmaParameters) {
  const aBest = new Set<string>();
  const bBest = new Set<string>();
  for (const b of actions) {
    const values = actions.map((a) => payoff(p, a, b).a);
    const max = Math.max(...values);
    actions.forEach((a, index) => { if (values[index] === max) aBest.add(cellId(a, b)); });
  }
  for (const a of actions) {
    const values = actions.map((b) => payoff(p, a, b).b);
    const max = Math.max(...values);
    actions.forEach((b, index) => { if (values[index] === max) bBest.add(cellId(a, b)); });
  }
  const raw = actions.flatMap((a) => actions.map((b) => {
    const values = payoff(p, a, b);
    return { id: cellId(a, b), aAction: a, bAction: b, ...values };
  }));
  const cells: PayoffCell[] = raw.map((cell) => {
    const pareto = !raw.some((other) => (other.a >= cell.a && other.b >= cell.b) && (other.a > cell.a || other.b > cell.b));
    return { ...cell, aBestResponse: aBest.has(cell.id), bBestResponse: bBest.has(cell.id), nash: aBest.has(cell.id) && bBest.has(cell.id), pareto };
  });
  const strictlyDominant = (player: "a" | "b", action: Action) => actions.every((opponent) => {
    const alternative = action === "C" ? "D" : "C";
    const current = player === "a" ? payoff(p, action, opponent).a : payoff(p, opponent, action).b;
    const other = player === "a" ? payoff(p, alternative, opponent).a : payoff(p, opponent, alternative).b;
    return current > other;
  });
  const weaklyDominant = (player: "a" | "b", action: Action) => actions.every((opponent) => {
    const alternative = action === "C" ? "D" : "C";
    const current = player === "a" ? payoff(p, action, opponent).a : payoff(p, opponent, action).b;
    const other = player === "a" ? payoff(p, alternative, opponent).a : payoff(p, opponent, alternative).b;
    return current >= other;
  }) && actions.some((opponent) => {
    const alternative = action === "C" ? "D" : "C";
    const current = player === "a" ? payoff(p, action, opponent).a : payoff(p, opponent, action).b;
    const other = player === "a" ? payoff(p, alternative, opponent).a : payoff(p, opponent, alternative).b;
    return current > other;
  });
  const bestJoint = Math.max(...cells.map((cell) => cell.a + cell.b));
  const cc = cells.find((cell) => cell.id === "CC")!;
  const dd = cells.find((cell) => cell.id === "DD")!;
  const socialDilemma = strictlyDominant("a", "D") && strictlyDominant("b", "D") && cc.a + cc.b > dd.a + dd.b;
  return {
    cells,
    nash: cells.filter((cell) => cell.nash).map((cell) => cell.id),
    aStrictDominant: actions.filter((action) => strictlyDominant("a", action)),
    bStrictDominant: actions.filter((action) => strictlyDominant("b", action)),
    aWeakDominant: actions.filter((action) => weaklyDominant("a", action)),
    bWeakDominant: actions.filter((action) => weaklyDominant("b", action)),
    aDominated: actions.filter((action) => strictlyDominant("a", action === "C" ? "D" : "C")),
    bDominated: actions.filter((action) => strictlyDominant("b", action === "C" ? "D" : "C")),
    pareto: cells.filter((cell) => cell.pareto).map((cell) => cell.id),
    jointMaximum: cells.filter((cell) => cell.a + cell.b === bestJoint).map((cell) => cell.id),
    socialDilemma,
  };
}

export type RepeatedGameParameters = PrisonersDilemmaParameters & {
  rounds: number; discountFactor: number; futureInteractionProbability: number; mistakeProbability: number;
  strategyA: Strategy; strategyB: Strategy;
};

export const DEFAULT_REPEATED_GAME: RepeatedGameParameters = {
  ...DEFAULT_PRISONERS_DILEMMA,
  rounds: 12, discountFactor: 0.92, futureInteractionProbability: 0.9, mistakeProbability: 0,
  strategyA: "tit-for-tat", strategyB: "always-defect",
};

function ownPayoff(p: PrisonersDilemmaParameters, player: "a" | "b", ownAction: Action, opponentAction: Action) {
  return player === "a" ? payoff(p, ownAction, opponentAction).a : payoff(p, opponentAction, ownAction).b;
}

function proposedAction(strategy: Strategy, ownHistory: Action[], opponentHistory: Action[], payoffs: PrisonersDilemmaParameters, player: "a" | "b"): Action {
  if (strategy === "always-cooperate") return "C";
  if (strategy === "always-defect") return "D";
  if (strategy === "tit-for-tat") return opponentHistory.length ? opponentHistory[opponentHistory.length - 1] : "C";
  if (strategy === "grim-trigger") return opponentHistory.includes("D") ? "D" : "C";
  if (!ownHistory.length) return "C";
  const previous = ownHistory.length - 1;
  const ownAction = ownHistory[previous];
  const opponentAction = opponentHistory[previous];
  const alternative = ownAction === "C" ? "D" : "C";
  // Generalise Pavlov/Win-Stay, Lose-Shift to an edited payoff matrix: stay
  // after an action that was a best response to the observed opponent action;
  // otherwise switch.  A fixed payoff threshold only works for one canonical
  // Prisoner's Dilemma matrix.
  const received = ownPayoff(payoffs, player, ownAction, opponentAction);
  const alternativePayoff = ownPayoff(payoffs, player, alternative, opponentAction);
  return received >= alternativePayoff ? ownAction : alternative;
}

function deterministicMistake(round: number, player: number, probability: number) {
  const pseudo = ((round * 9301 + player * 49297) % 233280) / 233280;
  return pseudo < probability;
}

export function simulateRepeatedGame(p: RepeatedGameParameters) {
  const historyA: Action[] = [];
  const historyB: Action[] = [];
  let payoffA = 0; let payoffB = 0; let discountedA = 0; let discountedB = 0;
  const rounds = Array.from({ length: Math.max(1, Math.round(p.rounds)) }, (_, index) => {
    const round = index + 1;
    let a = proposedAction(p.strategyA, historyA, historyB, p, "a");
    let b = proposedAction(p.strategyB, historyB, historyA, p, "b");
    if (deterministicMistake(round, 1, p.mistakeProbability)) a = a === "C" ? "D" : "C";
    if (deterministicMistake(round, 2, p.mistakeProbability)) b = b === "C" ? "D" : "C";
    const values = payoff(p, a, b);
    const weight = (p.discountFactor * p.futureInteractionProbability) ** index;
    payoffA += values.a; payoffB += values.b; discountedA += values.a * weight; discountedB += values.b * weight;
    historyA.push(a); historyB.push(b);
    return { round, a, b, payoffA: values.a, payoffB: values.b, cumulativeA: payoffA, cumulativeB: payoffB };
  });
  const cooperation = rounds.filter((item) => item.a === "C" && item.b === "C").length;
  const punishmentPeriods = rounds.filter((item) => item.a === "D" && item.b === "D").length;
  return {
    rounds,
    cumulativeA: payoffA,
    cumulativeB: payoffB,
    discountedA: Math.round(discountedA * 100) / 100,
    discountedB: Math.round(discountedB * 100) / 100,
    cooperationRate: Math.round((cooperation / rounds.length) * 100),
    defectionRate: Math.round((rounds.filter((item) => item.a === "D" || item.b === "D").length / rounds.length) * 100),
    punishmentPeriods,
    winner: payoffA === payoffB ? "Tie" : payoffA > payoffB ? "Player A" : "Player B",
  };
}
