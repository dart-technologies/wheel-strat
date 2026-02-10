import { store } from '@/data/store';
import { Opportunity } from '@wheel-strat/shared';

const mapOpportunityRow = (opp: Opportunity): Record<string, string | number | boolean> => {
    const row: Record<string, string | number | boolean> = {
        symbol: opp.symbol,
        strategy: opp.strategy,
        strike: opp.strike,
        expiration: opp.expiration,
        premium: opp.premium,
        winProb: opp.winProb,
        reasoning: opp.reasoning,
        analysis: opp.analysis ? JSON.stringify(opp.analysis) : '',
        context: opp.context ? JSON.stringify(opp.context) : '',
        createdAt: typeof opp.createdAt === 'object' && opp.createdAt !== null
            ? (opp.createdAt as any).toDate?.().toISOString() || new Date().toISOString()
            : String(opp.createdAt)
    };
    if (typeof opp.description === 'string') {
        row.description = opp.description;
    }
    if (typeof opp.ivRank === 'number') {
        row.ivRank = opp.ivRank;
    }
    if (typeof opp.currentPrice === 'number') {
        row.currentPrice = opp.currentPrice;
    }
    if (typeof opp.delta === 'number') {
        row.delta = opp.delta;
    }
    if (typeof opp.gamma === 'number') {
        row.gamma = opp.gamma;
    }
    if (typeof opp.theta === 'number') {
        row.theta = opp.theta;
    }
    if (typeof opp.vega === 'number') {
        row.vega = opp.vega;
    }
    if (typeof opp.impliedVol === 'number') {
        row.impliedVol = opp.impliedVol;
    }
    if (typeof opp.annualizedYield === 'number') {
        row.annualizedYield = opp.annualizedYield;
    }
    if (typeof opp.priority === 'number') {
        row.priority = opp.priority;
    }
    return row;
};

export const syncOpportunities = (opps: Opportunity[]) => {
    store.transaction(() => {
        opps.forEach((opp) => {
            const rowId = `${opp.symbol}-${opp.strategy}-${opp.strike}`;
            store.setRow('opportunities', rowId, mapOpportunityRow(opp));
        });

        if (opps.length > 0) {
            const latestOpp = opps
                .slice()
                .sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime())[0];
            if (latestOpp?.createdAt) {
                const scanTime = typeof latestOpp.createdAt === 'object'
                    ? (latestOpp.createdAt as any).toDate?.().toISOString() || new Date().toISOString()
                    : String(latestOpp.createdAt);
                store.setCell('syncMetadata', 'main', 'lastStrategiesScan', scanTime);
            }
        }
    });
};
