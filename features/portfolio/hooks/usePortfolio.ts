import { useMemo } from 'react';
import { useRow, useTable } from 'tinybase/ui-react';
import { store } from '@/data/store';
import { OptionPosition, Portfolio, Position } from '@wheel-strat/shared';

export function usePortfolio() {
    const portfolio = useRow('portfolio', 'main', store) as Portfolio | undefined;
    const positions = useTable('positions', store) as Record<string, Position> | undefined;
    const optionPositions = useTable('optionPositions', store) as Record<string, OptionPosition> | undefined;

    return {
        portfolio: portfolio || { cash: 0, netLiq: 0, buyingPower: 0 },
        positions: positions || {},
        optionPositions: optionPositions || {}
    };
}

export function usePosition(symbol?: string) {
    const position = useRow('positions', symbol || '__missing__', store) as Position | undefined;
    if (!symbol) return undefined;
    return position;
}

export function useOptionPositionsForSymbol(symbol?: string) {
    const optionPositions = useTable('optionPositions', store) as Record<string, OptionPosition> | undefined;

    return useMemo(() => {
        if (!symbol) return [];
        const normalized = symbol.toUpperCase();
        return Object.values(optionPositions || {}).filter((position) => (
            position?.symbol?.toUpperCase?.() === normalized
        ));
    }, [optionPositions, symbol]);
}
