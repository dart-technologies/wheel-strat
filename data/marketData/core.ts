import type { Opportunity } from '@wheel-strat/shared';
import type { LiveOptionLeg, LiveOptionSnapshot, MarketDataStore, MarketSnapshot } from './types';

function toNumber(value?: unknown) {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function shouldApplyPriceUpdate(
    currentPrice: number,
    nextPrice: number,
    ivRank?: number,
    beta?: number
) {
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) return true;
    if (!Number.isFinite(nextPrice)) return false;
    const ivValue = Number.isFinite(ivRank ?? NaN)
        ? Math.min(100, Math.max(0, Number(ivRank))) / 100
        : null;
    const betaValue = Number.isFinite(beta ?? NaN)
        ? Math.min(2, Math.max(0.5, Math.abs(Number(beta))))
        : 1;
    const basePct = 0.0005;
    const volPct = ivValue !== null ? (0.002 * ivValue) : 0.001;
    const thresholdPct = (basePct + volPct) * betaValue;
    const deltaPct = Math.abs(nextPrice - currentPrice) / currentPrice;
    return deltaPct >= thresholdPct;
}

function buildPriceMap(opportunities: Opportunity[]) {
    const map: Record<string, number> = {};

    opportunities.forEach((opp) => {
        if (!opp.symbol) return;
        if (typeof opp.currentPrice !== 'number' || Number.isNaN(opp.currentPrice)) return;
        if (map[opp.symbol] === undefined) {
            map[opp.symbol] = opp.currentPrice;
        }
    });

    return map;
}

export function refreshPortfolioNetLiq(storeInstance: MarketDataStore) {
    const portfolio = storeInstance.getRow('portfolio', 'main');
    if (!portfolio || Object.keys(portfolio).length === 0) return 0;

    const cash = Number(portfolio.cash) || 0;
    const positionsTable = storeInstance.getTable('positions');
    const optionPositionsTable = storeInstance.getTable('optionPositions');
    let positionsValue = 0;
    let optionsValue = 0;

    Object.values(positionsTable).forEach((pos) => {
        const quantity = Number(pos.quantity) || 0;
        const rawPrice = Number(pos.currentPrice);
        const averageCost = Number(pos.averageCost);
        const price = Number.isFinite(rawPrice) && rawPrice > 0
            ? rawPrice
            : (Number.isFinite(averageCost) ? averageCost : 0);
        positionsValue += quantity * price;
    });

    Object.values(optionPositionsTable).forEach((pos) => {
        if (!pos) return;
        const quantity = Number(pos.quantity) || 0;
        if (!Number.isFinite(quantity) || quantity === 0) return;
        const multiplier = Number(pos.multiplier) || 100;
        const marketValue = Number(pos.marketValue);
        if (Number.isFinite(marketValue) && marketValue !== 0) {
            optionsValue += marketValue;
            return;
        }
        const rawPrice = Number(pos.currentPrice);
        const averageCost = Number(pos.averageCost);
        const price = Number.isFinite(rawPrice) && rawPrice > 0
            ? rawPrice
            : (Number.isFinite(averageCost) ? averageCost : 0);
        optionsValue += quantity * price * multiplier;
    });

    const netLiq = cash + positionsValue + optionsValue;
    storeInstance.setCell('portfolio', 'main', 'netLiq', netLiq);
    return netLiq;
}

function updateOptionLeg(
    storeInstance: MarketDataStore,
    symbol: string,
    prefix: 'cc' | 'csp',
    leg?: LiveOptionLeg | null
) {
    const yieldKey = `${prefix}Yield`;
    const premiumKey = `${prefix}Premium`;
    const premiumSourceKey = `${prefix}PremiumSource`;
    const strikeKey = `${prefix}Strike`;
    const expirationKey = `${prefix}Expiration`;
    const winProbKey = `${prefix}WinProb`;
    const deltaKey = `${prefix}Delta`;
    const gammaKey = `${prefix}Gamma`;
    const thetaKey = `${prefix}Theta`;
    const vegaKey = `${prefix}Vega`;

    if (!leg) {
        storeInstance.delCell('positions', symbol, yieldKey);
        storeInstance.delCell('positions', symbol, premiumKey);
        storeInstance.delCell('positions', symbol, premiumSourceKey);
        storeInstance.delCell('positions', symbol, strikeKey);
        storeInstance.delCell('positions', symbol, expirationKey);
        storeInstance.delCell('positions', symbol, winProbKey);
        storeInstance.delCell('positions', symbol, deltaKey);
        storeInstance.delCell('positions', symbol, gammaKey);
        storeInstance.delCell('positions', symbol, thetaKey);
        storeInstance.delCell('positions', symbol, vegaKey);
        return;
    }

    const yieldValue = toNumber(leg.annualizedYield);
    const premiumValue = toNumber(leg.premium);
    const strikeValue = toNumber(leg.strike);
    const winProbValue = toNumber(leg.winProb);

    if (yieldValue !== undefined) {
        storeInstance.setCell('positions', symbol, yieldKey, yieldValue);
    } else {
        storeInstance.delCell('positions', symbol, yieldKey);
    }

    if (premiumValue !== undefined) {
        storeInstance.setCell('positions', symbol, premiumKey, premiumValue);
    } else {
        storeInstance.delCell('positions', symbol, premiumKey);
    }

    if (leg.premiumSource) {
        storeInstance.setCell('positions', symbol, premiumSourceKey, leg.premiumSource);
    } else {
        storeInstance.delCell('positions', symbol, premiumSourceKey);
    }

    if (strikeValue !== undefined) {
        storeInstance.setCell('positions', symbol, strikeKey, strikeValue);
    } else {
        storeInstance.delCell('positions', symbol, strikeKey);
    }

    if (leg.expiration) {
        storeInstance.setCell('positions', symbol, expirationKey, leg.expiration);
    } else {
        storeInstance.delCell('positions', symbol, expirationKey);
    }

    if (winProbValue !== undefined) {
        storeInstance.setCell('positions', symbol, winProbKey, winProbValue);
    } else {
        storeInstance.delCell('positions', symbol, winProbKey);
    }

    const deltaValue = toNumber(leg.delta);
    if (deltaValue !== undefined) {
        storeInstance.setCell('positions', symbol, deltaKey, deltaValue);
    } else {
        storeInstance.delCell('positions', symbol, deltaKey);
    }

    const gammaValue = toNumber(leg.gamma);
    if (gammaValue !== undefined) {
        storeInstance.setCell('positions', symbol, gammaKey, gammaValue);
    } else {
        storeInstance.delCell('positions', symbol, gammaKey);
    }

    const thetaValue = toNumber(leg.theta);
    if (thetaValue !== undefined) {
        storeInstance.setCell('positions', symbol, thetaKey, thetaValue);
    } else {
        storeInstance.delCell('positions', symbol, thetaKey);
    }

    const vegaValue = toNumber(leg.vega);
    if (vegaValue !== undefined) {
        storeInstance.setCell('positions', symbol, vegaKey, vegaValue);
    } else {
        storeInstance.delCell('positions', symbol, vegaKey);
    }
}

export function applyOpportunityMarketData(
    opportunities: Opportunity[],
    storeInstance: MarketDataStore
): MarketSnapshot {
    const priceMap = buildPriceMap(opportunities);
    const updatedSymbols: string[] = [];

    storeInstance.transaction(() => {
        Object.entries(priceMap).forEach(([symbol, price]) => {
            if (!Number.isFinite(price) || price <= 0) return;
            const existing = storeInstance.getRow('positions', symbol);
            if (!existing || Object.keys(existing).length === 0) return;

            const currentPrice = typeof existing.currentPrice === 'number'
                ? existing.currentPrice
                : Number(existing.currentPrice);

            if (!Number.isNaN(currentPrice) && currentPrice === price) return;

            storeInstance.setRow('positions', symbol, {
                ...existing,
                currentPrice: price,
            });
            updatedSymbols.push(symbol);
        });
    });

    const netLiq = refreshPortfolioNetLiq(storeInstance);
    return { updatedSymbols, netLiq };
}

export function applyLiveOptionMarketData(
    results: LiveOptionSnapshot[],
    storeInstance: MarketDataStore
): MarketSnapshot {
    const updatedSymbols: string[] = [];

    storeInstance.transaction(() => {
        results.forEach((snapshot) => {
            if (!snapshot?.symbol) return;
            const symbol = snapshot.symbol.toUpperCase();
            const existing = storeInstance.getRow('positions', symbol);
            if (!existing || Object.keys(existing).length === 0) return;

            let didUpdate = false;

            const currentPriceValue = toNumber(snapshot.currentPrice);
            if (currentPriceValue !== undefined && currentPriceValue > 0) {
                const currentPrice = typeof existing.currentPrice === 'number'
                    ? existing.currentPrice
                    : Number(existing.currentPrice);
                const ivRank = toNumber(existing.ivRank);
                const beta = toNumber(existing.beta);

                const shouldUpdate = Number.isNaN(currentPrice)
                    || shouldApplyPriceUpdate(currentPrice, currentPriceValue, ivRank, beta);

                if (shouldUpdate && currentPrice !== currentPriceValue) {
                    // Save old currentPrice as closePrice before updating
                    if (Number.isFinite(currentPrice) && currentPrice > 0) {
                        storeInstance.setCell('positions', symbol, 'closePrice', currentPrice);
                    } else {
                        // First time setting price for placeholder position - set both to same value
                        // This allows subsequent refreshes to calculate daily change
                        const existingClose = toNumber(existing.closePrice);
                        if (!existingClose || existingClose === 0) {
                            storeInstance.setCell('positions', symbol, 'closePrice', currentPriceValue);
                        }
                    }
                    storeInstance.setCell('positions', symbol, 'currentPrice', currentPriceValue);
                    didUpdate = true;
                }
            }

            if (Object.prototype.hasOwnProperty.call(snapshot, 'cc')) {
                updateOptionLeg(storeInstance, symbol, 'cc', snapshot.cc ?? null);
                didUpdate = true;
            }

            if (Object.prototype.hasOwnProperty.call(snapshot, 'csp')) {
                updateOptionLeg(storeInstance, symbol, 'csp', snapshot.csp ?? null);
                didUpdate = true;
            }

            if (didUpdate) updatedSymbols.push(symbol);
        });
    });

    const netLiq = refreshPortfolioNetLiq(storeInstance);
    return { updatedSymbols, netLiq };
}
