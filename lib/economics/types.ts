export type MarketParameters={demandIntercept:number;demandSlope:number;supplyIntercept:number;supplySlope:number};
export type MarketOutcome={price:number;quantity:number;consumerSurplus:number;producerSurplus:number;totalSurplus:number;valid:boolean};
export type ModelParameter={id:string;label:string;symbol:string;description:string;min:number;max:number;step:number;defaultValue:number};
export type ScenarioSnapshot={label:"A"|"B";parameters:Record<string,number>;results:Record<string,number>;savedAt:string};
export const clamp=(value:number,min=0,max=Number.POSITIVE_INFINITY)=>Math.min(max,Math.max(min,Number.isFinite(value)?value:min));
export const round=(value:number,digits=2)=>{if(!Number.isFinite(value))return 0;const factor=10**digits;return Math.round((value+Number.EPSILON)*factor)/factor};
export const safePercentChange=(from:number,to:number)=>!Number.isFinite(from)||!Number.isFinite(to)||Math.abs(from)<1e-9?null:((to-from)/Math.abs(from))*100;
