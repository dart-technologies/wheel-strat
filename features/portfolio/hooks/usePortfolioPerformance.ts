import { useMemo } from 'react';
import { OptionPosition, Portfolio, Position } from '@wheel-strat/shared';
import { getOptionMarketValue, getStableOptionPrice, getStablePositionPrice } from './portfolioUtils';

export function usePortfolioPerformance(
    portfolio: Portfolio,
    positions: Record<string, Position>,
    optionPositions: Record<string, OptionPosition> = {}
) {
    const performance = useMemo(() => {
        const cash = portfolio.cash || 0;
        let positionsValue = 0;
        let totalCost = 0;
        let unrealizedPnL = 0;

        Object.values(positions).forEach((pos) => {
            const price = getStablePositionPrice(pos);
            positionsValue += pos.quantity * price;
            totalCost += pos.quantity * pos.averageCost;
            unrealizedPnL += (price - pos.averageCost) * pos.quantity;
        });

        let optionValue = 0;
        Object.values(optionPositions).forEach((pos) => {
            if (!pos) return;
            const quantity = Number(pos.quantity) || 0;
            if (!Number.isFinite(quantity) || quantity === 0) return;
            const multiplier = Number(pos.multiplier) || 100;
            const averageCost = Number(pos.averageCost) || 0;
            const price = getStableOptionPrice(pos) || averageCost;
            optionValue += getOptionMarketValue(pos);
            totalCost += Math.abs(quantity) * averageCost * multiplier;
            unrealizedPnL += (price - averageCost) * quantity * multiplier;
        });



        // Diagnosis: Find the positions causing negative drag
        const allPos = [
            ...Object.values(positions).map(p => ({
                s: p.symbol,
                mv: p.quantity * getStablePositionPrice(p)
            })),
            ...Object.values(optionPositions).map(p => ({
                s: `${p.symbol} ${p.right}${p.strike}`,
                mv: (Number(p.quantity)||0) * getStableOptionPrice(p) * (Number(p.multiplier)||100)
            }))
        ];
        // Sort by MV ascending (most negative first)
        allPos.sort((a, b) => a.mv - b.mv);



        const calculatedNetLiq = cash + positionsValue + optionValue;

        // Prefer IBKR Store values if available (Source of Truth)
        // Only use calculated values as fallback or for un-synced latency updates
        const storeNetLiq = Number(portfolio.netLiq);
        const storeUnrealized = Number(portfolio.unrealizedPnL);
        const hasStoreValues = Number.isFinite(storeNetLiq) && storeNetLiq !== 0; // Basic validity check

        const finalNetLiq = hasStoreValues ? storeNetLiq : calculatedNetLiq;

        // If we have store unrealized, use it. Otherwise calc.
        // Note: Store Unrealized might be total, ours is sum of positions. Usually close.
        const hasStoreUnrealized = Number.isFinite(storeUnrealized) && hasStoreValues;
        const shouldUseStoreUnrealized = hasStoreUnrealized && (
            storeUnrealized !== 0 || Math.abs(unrealizedPnL) < 0.0001
        );
        const finalUnrealized = shouldUseStoreUnrealized ? storeUnrealized : unrealizedPnL;

        const finalRetPct = totalCost > 0 ? (finalUnrealized / totalCost) * 100 : 0;

        return {
            totalNetLiq: finalNetLiq,
            totalReturn: finalUnrealized,
            totalReturnPct: finalRetPct
        };
    }, [portfolio, positions, optionPositions]);

    // DIAGNOSTIC LOGGING (Silenced)
    /*
    useEffect(() => {
        if (performance.totalNetLiq !== portfolio.netLiq) {
            console.log('[usePortfolioPerformance] Mismatch or Update:', {
                storeNetLiq: portfolio.netLiq,
                calcNetLiq: performance.totalNetLiq,
                diff: (portfolio.netLiq || 0) - performance.totalNetLiq
            });
        }
    }, [performance, portfolio.netLiq]);
    */

    return performance;
}
