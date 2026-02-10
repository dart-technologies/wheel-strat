import { useEffect, useMemo, useRef } from 'react';
import { useTable } from 'tinybase/ui-react';
import { store } from '@/data/store';
import { OptionPosition, Position } from '@wheel-strat/shared';
import { getOptionMarketValue, getStableOptionPrice, getStablePositionPrice, normalizeExpiration } from './portfolioUtils';
import { PositionGroup, PositionSortMode } from './types';

const optionSortRank = (right?: string) => {
    const normalized = (right || '').toUpperCase();
    if (normalized === 'P') return 0;
    if (normalized === 'C') return 1;
    return 2;
};

export function useGroupedPositions(sortMode: PositionSortMode = 'marketValue') {
    const positions = useTable('positions', store) as Record<string, Position> | undefined;
    const optionPositions = useTable('optionPositions', store) as Record<string, OptionPosition> | undefined;

    const groups = useMemo(() => {
        const map = new Map<string, PositionGroup>();

        Object.values(positions || {}).forEach((pos) => {
            if (!pos?.symbol) return;
            const symbol = pos.symbol.toUpperCase();
            const group = map.get(symbol) || {
                symbol,
                options: [],
                contractCount: 0,
                marketValue: 0,
                dailyPnL: 0,
                costBasis: 0,
                unrealizedPnL: 0
            };
            group.stock = pos;
            group.ccYield = typeof pos.ccYield === 'number' ? pos.ccYield : group.ccYield;
            group.cspYield = typeof pos.cspYield === 'number' ? pos.cspYield : group.cspYield;

            const price = getStablePositionPrice(pos);
            const close = Number(pos.closePrice) || price;
            const quantity = Number(pos.quantity) || 0;
            const avgCost = Number(pos.averageCost) || 0;
            const marketVal = quantity * price;
            const cost = quantity * avgCost;

            group.marketValue += marketVal;
            group.costBasis += cost;
            group.dailyPnL += (price - close) * quantity;
            group.unrealizedPnL += (marketVal - cost);

            map.set(symbol, group);
        });

        Object.values(optionPositions || {}).forEach((option) => {
            if (!option?.symbol) return;
            const symbol = option.symbol.toUpperCase();
            const group = map.get(symbol) || {
                symbol,
                options: [],
                contractCount: 0,
                marketValue: 0,
                dailyPnL: 0,
                costBasis: 0,
                unrealizedPnL: 0
            };
            group.options = [...group.options, option];
            group.contractCount += Math.abs(option.quantity || 0);

            const marketVal = getOptionMarketValue(option);
            const qty = Number(option.quantity) || 0;
            const mult = Number(option.multiplier) || 100;
            const avgCost = Number(option.averageCost) || 0;
            const cost = avgCost * qty * mult;
            const price = getStableOptionPrice(option);
            const close = Number(option.closePrice) || price;

            group.marketValue += marketVal;
            group.costBasis += cost;
            group.dailyPnL += (price - close) * qty * mult;
            group.unrealizedPnL += (marketVal - cost);

            map.set(symbol, group);
        });

        return Array.from(map.values()).map((group) => ({
            ...group,
            options: [...group.options].sort((a, b) => {
                const rankDiff = optionSortRank(a.right) - optionSortRank(b.right);
                if (rankDiff !== 0) return rankDiff;
                const expA = normalizeExpiration(a.expiration);
                const expB = normalizeExpiration(b.expiration);
                if (expA !== expB) return expA.localeCompare(expB);
                return (Number(a.strike) || 0) - (Number(b.strike) || 0);
            })
        }));
    }, [positions, optionPositions]);

    const sortedGroups = useMemo(() => {
        const list = [...groups];
        switch (sortMode) {
            case 'marketValue':
                return list.sort((a, b) => b.marketValue - a.marketValue);
            case 'dailyPnL':
                return list.sort((a, b) => b.dailyPnL - a.dailyPnL);
            case 'costBasis':
                return list.sort((a, b) => b.costBasis - a.costBasis);
            case 'unrealizedPnL':
                return list.sort((a, b) => b.unrealizedPnL - a.unrealizedPnL);
            case 'symbol':
                return list.sort((a, b) => a.symbol.localeCompare(b.symbol));
            case 'cspYield':
            case 'ccYield': {
                const key = sortMode;
                return list.sort((a, b) => {
                    const aValue = typeof a[key] === 'number' ? (a[key] as number) : -Infinity;
                    const bValue = typeof b[key] === 'number' ? (b[key] as number) : -Infinity;
                    if (aValue !== bValue) return bValue - aValue;
                    return a.symbol.localeCompare(b.symbol);
                });
            }
            default:
                return list;
        }
    }, [groups, sortMode]);

    const hasPositions = (Object.keys(positions || {}).length > 0)
        || (Object.keys(optionPositions || {}).length > 0);
    const lastStablePositions = useRef<PositionGroup[]>([]);

    useEffect(() => {
        if (sortedGroups.length > 0 || !hasPositions) {
            lastStablePositions.current = sortedGroups;
        }
    }, [sortedGroups, hasPositions]);

    if (sortedGroups.length === 0 && hasPositions) {
        return lastStablePositions.current;
    }

    return sortedGroups;
}
