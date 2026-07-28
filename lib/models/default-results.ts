import { calculateAdAs, DEFAULT_AD_AS } from "@/lib/economics/ad-as";
import { calculateCournot, DEFAULT_COURNOT } from "@/lib/economics/cournot";
import { calculateElasticity } from "@/lib/economics/elasticity";
import { calculateExternality, DEFAULT_EXTERNALITY } from "@/lib/economics/externalities";
import { analyzePrisonersDilemma, DEFAULT_PRISONERS_DILEMMA, DEFAULT_REPEATED_GAME, simulateRepeatedGame } from "@/lib/economics/game-theory";
import { calculateIsLm, DEFAULT_IS_LM } from "@/lib/economics/is-lm";
import { calculateLorenz, DEFAULT_LORENZ } from "@/lib/economics/lorenz";
import { calculateMonopoly, DEFAULT_MONOPOLY } from "@/lib/economics/monopoly";
import { calculatePpf, DEFAULT_PPF } from "@/lib/economics/ppf";
import { calculatePhillips, DEFAULT_PHILLIPS } from "@/lib/economics/phillips";
import { calculatePolicyOutcome } from "@/lib/economics/policy";
import { calculatePriceControl, DEFAULT_PRICE_CONTROLS } from "@/lib/economics/price-controls";
import { calculateSolow, DEFAULT_SOLOW } from "@/lib/economics/solow";
import { DEFAULT_MARKET, calculateMarketEquilibrium } from "@/lib/economics/supply-demand";
import { BASELINE_PARAMETERS } from "@/lib/economics/sandbox/defaults";
import { simulateSandbox } from "@/lib/economics/sandbox/simulation";
import type { SupportedModelKey } from "@/lib/models/change-tracking";

/** Baseline result vectors remain local and make comparisons independent of saved scenarios. */
export function defaultModelResults(modelKey: SupportedModelKey): Record<string, number> {
  switch (modelKey) {
    case "supply-demand": { const r = calculateMarketEquilibrium(DEFAULT_MARKET); return { price: r.price, quantity: r.quantity, consumerSurplus: r.consumerSurplus, producerSurplus: r.producerSurplus, totalSurplus: r.totalSurplus }; }
    case "policy": { const r = calculatePolicyOutcome({ ...DEFAULT_MARKET, wedge: 10 }); return { consumerPrice: r.consumerPrice, producerPrice: r.producerPrice, quantity: r.quantity, governmentBalance: r.governmentBalance, deadweightLoss: r.deadweightLoss }; }
    case "price-controls": { const r = calculatePriceControl(DEFAULT_PRICE_CONTROLS); return { price: r.controlledPrice, quantityTraded: r.quantityTraded, shortage: r.shortage, surplus: r.surplus, deadweightLoss: r.deadweightLoss, totalSurplus: r.totalSurplus }; }
    case "elasticity": { const r = calculateElasticity({ demandIntercept: 100, demandSlope: 2, price: 25 }); return { price: 25, quantity: r.quantity, elasticity: r.elasticity, totalRevenue: r.totalRevenue, revenueMaximizingPrice: r.revenueMaximizingPrice }; }
    case "externalities": { const r = calculateExternality(DEFAULT_EXTERNALITY); return { marketQuantity: r.marketQuantity, efficientQuantity: r.efficientQuantity, correctivePolicy: r.correctivePolicy, externalImpact: r.externalImpactAtMarket, welfareGain: r.welfareGain, socialWelfare: r.socialWelfareEfficient }; }
    case "monopoly": { const r = calculateMonopoly(DEFAULT_MONOPOLY); return { monopolyPrice: r.monopolyPrice, monopolyQuantity: r.monopolyQuantity, competitiveQuantity: r.competitiveQuantity, profit: r.profit, markup: r.markup, deadweightLoss: r.deadweightLoss }; }
    case "ppf": { const r = calculatePpf(DEFAULT_PPF); return { outputX: r.outputX, outputY: r.outputY, opportunityCost: r.opportunityCost, capacityGap: r.capacityGap, capacityX: r.shiftedCapacityX, capacityY: r.shiftedCapacityY }; }
    case "ad-as": { const r = calculateAdAs(DEFAULT_AD_AS); return { output: r.output, priceLevel: r.priceLevel, outputGap: r.outputGap, inflationPressure: r.inflationPressure, unemploymentGap: r.unemploymentGap }; }
    case "is-lm": { const r = calculateIsLm(DEFAULT_IS_LM); return { output: r.output, interestRate: r.interestRate, consumption: r.consumption, investment: r.investment, fiscalMultiplier: r.fiscalMultiplier, crowdingOut: r.crowdingOut }; }
    case "phillips-curve": { const r = calculatePhillips(DEFAULT_PHILLIPS); return { inflation: r.inflation, unemploymentGap: r.unemploymentGap, inflationSurprise: r.inflationSurprise }; }
    case "solow-growth": { const r = calculateSolow(DEFAULT_SOLOW); return { capital: r.capital, output: r.output, consumption: r.consumption, steadyCapital: r.steadyCapital, steadyOutput: r.steadyOutput, goldenRuleSavings: r.goldenRuleSavings }; }
    case "lorenz-gini": { const r = calculateLorenz(DEFAULT_LORENZ); return { preGini: r.preGini, postGini: r.postGini, giniChange: r.giniChange, revenue: r.revenue, transferCost: r.transferCost, netFiscalImpact: r.netFiscalImpact }; }
    case "cournot": { const r = calculateCournot(DEFAULT_COURNOT); return { price: r.price, totalOutput: r.totalOutput, profit1: r.profit1, profit2: r.profit2, equilibriumTotal: r.equilibriumTotal, deadweightLoss: r.deadweightLoss }; }
    case "prisoners-dilemma": { const r = analyzePrisonersDilemma(DEFAULT_PRISONERS_DILEMMA); return { nashCount: r.nash.length, paretoCount: r.pareto.length, jointMaximumCount: r.jointMaximum.length }; }
    case "repeated-games": { const r = simulateRepeatedGame(DEFAULT_REPEATED_GAME); return { cooperationRate: r.cooperationRate, cumulativeA: r.cumulativeA, cumulativeB: r.cumulativeB, punishmentPeriods: r.punishmentPeriods }; }
    case "sandbox": return { ...simulateSandbox(BASELINE_PARAMETERS).indicators };
    case "policy-lab": { const r = simulateSandbox(BASELINE_PARAMETERS).indicators; return { score: 0, inflation: r.inflationRate, unemployment: r.unemploymentRate, gdp: r.gdpIndex, emissions: r.carbonEmissions, consumerWelfare: r.consumerWelfare }; }
  }
}
