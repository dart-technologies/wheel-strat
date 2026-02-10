import { useEffect, useMemo, useRef } from 'react';
import { useResultSortedRowIds, useResultTable } from 'tinybase/ui-react';
import { queries } from '@/data/store';
import { Position } from '@wheel-strat/shared';
import { PositionSortMode } from './types';

export function useSortedPositions(
    positions: Record<string, Position>,
    sortMode: PositionSortMode = 'marketValue'
) {
    const sortCellId = useMemo(() => {
        switch (sortMode) {
            case 'cspYield':
                return 'cspYield';
            case 'ccYield':
                return 'ccYield';
            case 'marketValue':
            default:
                return 'marketValue';
        }
    }, [sortMode]);

    const queryId = 'positions_by_value';
    const sortedRowIds = useResultSortedRowIds(queryId, sortCellId, true, 0, undefined, queries);

    const resultTable = useResultTable(queryId, queries);

    const sortedPositions = useMemo(() => {
        return sortedRowIds.map(rowId => resultTable[rowId] as Position);
    }, [sortedRowIds, resultTable]);

    const hasPositions = Object.keys(positions || {}).length > 0;
    const lastStablePositions = useRef<Position[]>([]);

    useEffect(() => {
        if (sortedPositions.length > 0 || !hasPositions) {
            lastStablePositions.current = sortedPositions;
        }
    }, [sortedPositions, hasPositions]);

    if (sortedPositions.length === 0 && hasPositions) {
        return lastStablePositions.current;
    }

    return sortedPositions;
}
